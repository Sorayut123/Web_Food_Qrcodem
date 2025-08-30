const express = require("express");
const router = express.Router();
const db = require("../../config/db");

// ยอดขายวันนี้
router.get("/today-revenue", async (req, res) => {
  console.log("เรียก today-revenue แล้ว");
  try {
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
    const [result] = await db.promise().query(
      `SELECT 
         COALESCE(SUM(total_price), 0) AS totalRevenue, 
         COUNT(DISTINCT order_id) AS totalOrders 
       FROM orders 
       WHERE DATE(order_time) = ? AND status = 'completed'`,
      [today]
    );

    res.json({
      totalRevenue: parseFloat(result[0].totalRevenue) || 0,
      totalOrders: parseInt(result[0].totalOrders) || 0,
      date: new Date().toLocaleDateString("th-TH", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "Asia/Bangkok",
      }),
    });
  } catch (err) {
    console.error("ดึงยอดขายวันนี้ล้มเหลว:", err.message);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงยอดขาย", error: err.message });
  }
});

// ดึงข้อมูลจาก temp_receipts พร้อม join เดียวกัน (รายวัน)
router.get("/all", async (req, res) => {
  try {
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
    const [receipts] = await db.promise().query(
      `SELECT 
        tr.temp_receipt_id, tr.temp_receipt_code, tr.temp_receipt_time, tr.table_number,
        o.order_id, o.order_time, o.status, o.total_price, o.order_code, o.status_pay, o.payment_slip,
        oi.item_id, oi.menu_id, COALESCE(m.menu_name, 'ไม่พบชื่อเมนู') as menu_name, 
        oi.quantity, oi.price, oi.note, oi.specialRequest
      FROM temp_receipts tr 
      LEFT JOIN orders o ON tr.temp_receipt_code = o.order_code 
      LEFT JOIN order_items oi ON o.order_id = oi.order_id
      LEFT JOIN menu m ON oi.menu_id = m.menu_id
      WHERE DATE(tr.temp_receipt_time) = ?`,
      [today]
    );

    const groupedReceipts = receipts.reduce((acc, row) => {
      if (!acc[row.temp_receipt_code]) {
        acc[row.temp_receipt_code] = {
          temp_receipt_id: row.temp_receipt_id,
          temp_receipt_code: row.temp_receipt_code,
          table_number: row.table_number,
          temp_receipt_time: row.temp_receipt_time,
          orders: [],
        };
      }
      if (row.order_id) {
        let order = acc[row.temp_receipt_code].orders.find(o => o.order_id === row.order_id);
        if (!order) {
          order = {
            order_id: row.order_id,
            table_number: row.table_number,
            order_time: row.order_time,
            status: row.status,
            total_price: parseFloat(row.total_price) || 0,
            order_code: row.order_code,
            status_pay: row.status_pay,
            payment_slip: row.payment_slip,
            items: [],
          };
          acc[row.temp_receipt_code].orders.push(order);
        }
        if (row.item_id) {
          order.items.push({
            item_id: row.item_id,
            menu_id: row.menu_id,
            menu_name: row.menu_name,
            quantity: row.quantity,
            price: parseFloat(row.price) || 0,
            note: row.note || '',
            specialRequest: row.specialRequest || '',
          });
        }
      }
      return acc;
    }, {});

    res.json(Object.values(groupedReceipts));
  } catch (err) {
    console.error("ดึง temp_receipts ล้มเหลว:", err.message);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงข้อมูล", error: err.message });
  }
});
// อัปเดตสถานะออเดอร์เดี่ยว
router.put("/:orderId/status", async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ message: "กรุณาระบุสถานะ" });
  }

  try {
    const [result] = await db.promise().query(
      `UPDATE orders SET status = ? WHERE order_id = ?`,
      [status, orderId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "ไม่พบออเดอร์นี้" });
    }

    if (status === "completed") {
      const [orderRows] = await db.promise().query(
        `SELECT order_code, table_number, order_time, status, total_price, status_pay, payment_slip 
         FROM orders 
         WHERE order_id = ?`,
        [orderId]
      );

      if (orderRows.length === 0) {
        return res.status(404).json({ message: "ไม่พบข้อมูลออเดอร์" });
      }

      const [pendingOrderInsertResult] = await db.promise().query(
        `INSERT INTO pending_orders (order_code, table_number, order_time, status, total_price, status_pay, payment_slip)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          orderRows[0].order_code,
          orderRows[0].table_number,
          orderRows[0].order_time,
          orderRows[0].status,
          orderRows[0].total_price,
          orderRows[0].status_pay,
          orderRows[0].payment_slip,
        ]
      );

      const newPendingOrderId = pendingOrderInsertResult.insertId;

      await db.promise().query(
        `INSERT INTO pending_order_items (pending_order_id, menu_id, quantity, price, note, specialRequest)
         SELECT ?, menu_id, quantity, price, note, specialRequest 
         FROM order_items 
         WHERE order_id = ?`,
        [newPendingOrderId, orderId]
      );

      const [existingReceipt] = await db.promise().query(
        `SELECT 1 FROM receipts WHERE receipt_code = ? LIMIT 1`,
        [orderRows[0].order_code]
      );

      if (existingReceipt.length === 0) {
        await db.promise().query(
          `INSERT INTO receipts (receipt_code, receipt_order_id) VALUES (?, ?)`,
          [orderRows[0].order_code, newPendingOrderId]
        );
      }
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("order_status_updated", { orderId: parseInt(orderId), status });

      const { getTodayRevenue } = require("./getTodayRevenue");
      const revenueData = await getTodayRevenue();
      io.to(orderRows[0].order_code).emit("today_revenue_updated", revenueData);

      const { getTodayCount } = require("./getTodayCount");
      const count = await getTodayCount();
      io.to(orderRows[0].order_code).emit("orderCountUpdated", { count });
    }

    res.json({ message: "อัปเดตสถานะสำเร็จ", orderId: parseInt(orderId), status });
  } catch (err) {
    console.error("อัปเดตสถานะล้มเหลว:", err.message);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการอัปเดตสถานะ", error: err.message });
  }
});

// ดึงรายละเอียดออเดอร์เดี่ยว
router.get("/:orderId", async (req, res) => {
  const { orderId } = req.params;
  try {
    const [orderDetails] = await db.promise().query(
      `SELECT o.*, tr.temp_receipt_code, tr.temp_receipt_time, tr.table_number 
       FROM orders o 
       LEFT JOIN temp_receipts tr ON o.order_code = tr.temp_receipt_code 
       WHERE o.order_id = ?`,
      [orderId]
    );

    if (orderDetails.length === 0) {
      return res.status(404).json({ message: "ไม่พบออเดอร์นี้" });
    }

    const [items] = await db.promise().query(
      `SELECT oi.item_id, oi.menu_id, COALESCE(m.menu_name, 'ไม่พบชื่อเมนู') as menu_name, 
       oi.quantity, oi.price, oi.note, oi.specialRequest 
       FROM order_items oi 
       LEFT JOIN menu m ON oi.menu_id = m.menu_id 
       WHERE oi.order_id = ?`,
      [orderId]
    );

    res.json({
      success: true,
      order: {
        ...orderDetails[0],
        total_price: parseFloat(orderDetails[0].total_price) || 0,
      },
      items: items.map(item => ({
        ...item,
        price: parseFloat(item.price) || 0,
        note: item.note || '',
        specialRequest: item.specialRequest || '',
      })),
      orderId: parseInt(orderId),
    });
  } catch (err) {
    console.error("ดึงออเดอร์ล้มเหลว:", err.message);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงข้อมูลออเดอร์", error: err.message });
  }
});


// อัปเดตสถานะทุกออเดอร์ใน temp_receipt_code เป็น completed
router.put("/:tempReceiptCode/complete-all", async (req, res) => {
  const { tempReceiptCode } = req.params;

  try {
    const [orders] = await db.promise().query(
      `SELECT order_id, order_code, table_number, order_time, status, total_price, status_pay, payment_slip 
       FROM orders 
       WHERE order_code = ? AND status NOT IN ('completed', 'cancelled')`,
      [tempReceiptCode]
    );

    if (orders.length === 0) {
      return res.status(404).json({ message: "ไม่พบคำสั่งซื้อที่ยังไม่เสร็จสิ้น" });
    }

    const completedOrderIds = [];

    await db.promise().beginTransaction();

    try {
      for (const order of orders) {
        const [result] = await db.promise().query(
          `UPDATE orders SET status = 'completed' WHERE order_id = ?`,
          [order.order_id]
        );

        if (result.affectedRows > 0) {
          completedOrderIds.push(order.order_id);

          const [pendingOrderInsertResult] = await db.promise().query(
            `INSERT INTO pending_orders (order_code, table_number, order_time, status, total_price, status_pay, payment_slip)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              order.order_code,
              order.table_number,
              order.order_time,
              'completed',
              order.total_price,
              order.status_pay,
              order.payment_slip,
            ]
          );

          const newPendingOrderId = pendingOrderInsertResult.insertId;

          await db.promise().query(
            `INSERT INTO pending_order_items (pending_order_id, menu_id, quantity, price, note, specialRequest)
             SELECT ?, menu_id, quantity, price, note, specialRequest 
             FROM order_items 
             WHERE order_id = ?`,
            [newPendingOrderId, order.order_id]
          );

          const [existingReceipt] = await db.promise().query(
            `SELECT 1 FROM receipts WHERE receipt_code = ? LIMIT 1`,
            [order.order_code]
          );

          if (existingReceipt.length === 0) {
            await db.promise().query(
              `INSERT INTO receipts (receipt_code, receipt_order_id) 
               VALUES (?, ?)`,
              [order.order_code, newPendingOrderId]
            );
          }
        }
      }

      await db.promise().commit();

      const io = req.app.get("io");
      if (io) {
        io.to(tempReceiptCode).emit("temp_receipt_updated", { temp_receipt_code: tempReceiptCode });
        io.to(tempReceiptCode).emit("order_status_updated", { orderIds: completedOrderIds, status: "completed" });

        const { getTodayRevenue } = require("./getTodayRevenue");
        const revenueData = await getTodayRevenue();
        io.to(tempReceiptCode).emit("today_revenue_updated", revenueData);

        const { getTodayCount } = require("./getTodayCount");
        const count = await getTodayCount();
        io.to(tempReceiptCode).emit("orderCountUpdated", { count });
      }

      res.json({
        message: "อัปเดตสถานะทุกออเดอร์เป็นเสร็จสิ้นเรียบร้อย",
        temp_receipt_code: tempReceiptCode,
        completedOrderIds,
        success: true,
      });
    } catch (err) {
      await db.promise().rollback();
      throw err;
    }
  } catch (err) {
    console.error("อัปเดตสถานะล้มเหลว:", err.message);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการอัปเดตสถานะ", error: err.message });
  }
});

// ยอดขายวันนี้


module.exports = router;