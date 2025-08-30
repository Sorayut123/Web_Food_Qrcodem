const express = require("express");
const router = express.Router();
const db = require("../../config/db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// config multer สำหรับอัปโหลดสลิป
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../../public/uploads/bill");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);
  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error("เฉพาะไฟล์รูปภาพ (.jpg, .jpeg, .png) เท่านั้น"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// อัปเดตการชำระเงิน
router.put(
  "/pay-order/:order_id",
  upload.single("payment_slip"),
  async (req, res) => {
    const { order_id } = req.params;
    const { status_pay } = req.body;

    console.log("รับข้อมูลใน pay-order:", {
      order_id,
      status_pay,
      file: req.file,
    });

    if (!status_pay) {
      return res.status(400).json({ message: "กรุณาระบุ status_pay" });
    }

    let payment_slip = null;
    if (req.file) {
      payment_slip = req.file.filename; // บันทึกแค่ชื่อไฟล์ เช่น "1756027037886-681248685.png"
    }

    try {
      const [result] = await db
        .promise()
        .query(
          `UPDATE orders SET status_pay = ?, payment_slip = ? WHERE order_id = ?`,
          [status_pay, payment_slip, order_id]
        );

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ message: `ไม่พบคำสั่งซื้อ #${order_id}` });
      }

      // แจ้ง socket ไปยัง frontend
      const [order] = await db
        .promise()
        .query(`SELECT order_code FROM orders WHERE order_id = ?`, [order_id]);
      const order_code = order[0]?.order_code;

      const io = req.app.get("io");
      if (io) {
        io.emit("order_payment_updated", {
          orderId: order_id,
          status_pay,
          payment_slip: payment_slip,
          order_code,
        });
      }

      res.json({
        message: "อัปเดตการชำระเงินสำเร็จ",
        status_pay,
        payment_slip,
      });
    } catch (err) {
      console.error("Error in pay-order:", err);
      res
        .status(500)
        .json({
          message: "เกิดข้อผิดพลาดในการอัปเดตการชำระเงิน",
          error: err.message,
        });
    }
  }
);

// ดึงบิลจาก temp_receipts (คงเดิม)
router.get("/:order_code", async (req, res) => {
  const { order_code } = req.params;

  try {
    const [tempBills] = await db
      .promise()
      .query(`SELECT * FROM temp_receipts WHERE temp_receipt_code = ?`, [
        order_code,
      ]);

    console.log("ข้อมูล temp_receipts:", tempBills);

    if (!tempBills.length) {
      return res.status(404).json({ message: "ไม่พบบิลนี้" });
    }

    const tempBill = tempBills[0];

    const [orders] = await db
      .promise()
      .query(`SELECT * FROM orders WHERE order_code = ?`, [order_code]);

    console.log("ข้อมูล orders:", orders);

    if (!orders.length) {
      return res.status(404).json({ message: "ไม่พบคำสั่งซื้อที่เกี่ยวข้อง" });
    }

    const orderDetails = await Promise.all(
      orders.map(async (order) => {
        const [items] = await db.promise().query(
          `SELECT 
             oi.item_id,
             oi.menu_id,
             m.menu_name,
             oi.quantity,
             oi.price,
             oi.note,
             oi.specialRequest,
             (oi.quantity * oi.price) AS subtotal
           FROM order_items oi
           JOIN menu m ON oi.menu_id = m.menu_id
           WHERE oi.order_id = ?
           ORDER BY oi.item_id`,
          [order.order_id]
        );

        console.log(
          `รายการ order_items สำหรับ order_id ${order.order_id}:`,
          items
        );

        return {
          order_id: order.order_id,
          status: order.status,
          table_number: order.table_number,
          total_price: order.total_price,
          order_time: order.order_time,
          status_pay: order.status_pay,
          payment_slip: order.payment_slip, // ใช้ชื่อไฟล์อย่างเดียว
          items,
        };
      })
    );

    console.log("ข้อมูล orderDetails ที่รวมทุกอย่าง:", orderDetails);

    res.json({
      success: true,
      temp_receipt: tempBill,
      orders: orderDetails,
    });
  } catch (err) {
    console.error("ดึงข้อมูลบิลล้มเหลว:", err);
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการดึงบิล",
      error: err.message,
    });
  }
});

// อัปเดตสถานะยกเลิกสำหรับ order_id เฉพาะ (คงเดิม)
router.put("/cancel-order/:order_id", async (req, res) => {
  const { order_id } = req.params;
  const { status } = req.body;

  console.log(`Attempting to cancel order_id: ${order_id}`);

  if (!order_id || !status) {
    return res.status(400).json({ message: "กรุณาระบุ order_id และ status" });
  }

  try {
    const [result] = await db
      .promise()
      .query(
        `UPDATE orders SET status = ? WHERE order_id = ? AND status = 'pending'`,
        [status, order_id]
      );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({
          message: `ไม่พบคำสั่งซื้อ #${order_id} หรือไม่สามารถยกเลิกได้ (ไม่ใช่ pending)`,
        });
    }

    const [order] = await db
      .promise()
      .query(`SELECT order_code FROM orders WHERE order_id = ?`, [order_id]);
    const order_code = order[0].order_code;

    const io = req.app.get("io");
    if (io) {
      io.emit("order_status_updated", {
        orderId: order_id,
        status,
        order_code,
      });
    }

    res.json({ message: `ยกเลิกคำสั่งซื้อ #${order_id} เรียบร้อยแล้ว` });
  } catch (err) {
    console.error("Error in cancel-order:", err);
    res
      .status(500)
      .json({
        message: "เกิดข้อผิดพลาดในการยกเลิกคำสั่งซื้อ",
        error: err.message,
      });
  }
});

// อัปเดตการชำระเงินสำหรับทุกออเดอร์ใน order_code
router.put(
  "/pay-all-orders/:order_code",
  upload.single("payment_slip"),
  async (req, res) => {
    const { order_code } = req.params;
    const { status_pay } = req.body;

    console.log("รับข้อมูลใน pay-all-orders:", {
      order_code,
      status_pay,
      file: req.file,
    });

    if (!status_pay) {
      return res.status(400).json({ message: "กรุณาระบุ status_pay" });
    }

    let payment_slip = null;
    if (req.file) {
      payment_slip = req.file.filename; // บันทึกชื่อไฟล์สลิป
    }

    try {
      // อัปเดตทุกออเดอร์ที่มี order_code เดียวกัน และ status_pay ยังไม่ใช่ cash หรือ transfer_money
      const [result] = await db.promise().query(
        `UPDATE orders 
       SET status_pay = ?, payment_slip = ? 
       WHERE order_code = ? AND status_pay NOT IN ('cash', 'transfer_money')`,
        [status_pay, payment_slip, order_code]
      );

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({
            message: `ไม่พบคำสั่งซื้อที่ยังไม่ได้ชำระสำหรับรหัสบิล ${order_code}`,
          });
      }

      // ดึง order_id ทั้งหมดที่ถูกอัปเดต
      const [updatedOrders] = await db
        .promise()
        .query(
          `SELECT order_id FROM orders WHERE order_code = ? AND status_pay = ?`,
          [order_code, status_pay]
        );

      // แจ้ง socket ไปยัง frontend สำหรับทุก order_id
      const io = req.app.get("io");
      if (io) {
        updatedOrders.forEach((order) => {
          io.emit("order_payment_updated", {
            orderId: order.order_id,
            status_pay,
            payment_slip,
            order_code,
          });
        });
      }

      res.json({
        message: `ชำระเงินทุกคำสั่งซื้อสำหรับรหัสบิล ${order_code} สำเร็จ`,
        status_pay,
        payment_slip,
      });
    } catch (err) {
      console.error("Error in pay-all-orders:", err);
      res
        .status(500)
        .json({
          message: "เกิดข้อผิดพลาดในการชำระเงินทุกคำสั่งซื้อ",
          error: err.message,
        });
    }
  }
);
// ในไฟล์ routes/user/viewOrder.js
// router.get("/:order_code", async (req, res) => {
//   const { order_code } = req.params;
//   try {
//     const [tempBills] = await db.promise().query(
//       `SELECT * FROM temp_receipts WHERE temp_receipt_code = ?`,
//       [order_code]
//     );

//     if (!tempBills.length) return res.status(404).json({ message: "ไม่พบบิลนี้" });

//     const tempBill = tempBills[0];

//     const [orders] = await db.promise().query(
//       `SELECT * FROM orders WHERE order_code = ?`,
//       [order_code]
//     );

//     res.json({ success: true, temp_receipt: tempBill, orders });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "เกิดข้อผิดพลาด", error: err.message });
//   }
// });

module.exports = router;
