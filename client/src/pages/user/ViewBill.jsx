import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import Navbar from "../../components/user/Navbar";
import io from "socket.io-client";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { XCircle } from "lucide-react";
const socket = io("http://localhost:3000");
const API_URL_IMAGE = "http://localhost:3000/uploads/bill"; // Base URL สำหรับรูปภาพ

const ViewBill = ({ tableNumber: propTableNumber }) => {
  const { order_code } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState({});
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentSlip, setPaymentSlip] = useState(null);
  const [tableNumber, setTableNumber] = useState(null);
  const [showSlipModal, setShowSlipModal] = useState(false); // เพิ่ม state สำหรับ modal สลิป
  const [selectedSlipOrder, setSelectedSlipOrder] = useState(null); // เก็บ order ที่จะแสดงสลิป

  // ชำระทั้งหมด
  const [showPayAllModal, setShowPayAllModal] = useState(false);

  const orderStatuses = {
    pending: { label: "รอดำเนินการ" },
    preparing: { label: "กำลังเตรียม" },
    ready: { label: "พร้อมเสิร์ฟ" },
    completed: { label: "เสร็จสิ้น" },
    cancelled: { label: "ยกเลิก" },
  };

  const paymentStatusInfo = {
    uncash: { label: "ยังไม่ได้กำหนด", color: "bg-red-100 text-red-800" },
    cash: { label: "เงินสด", color: "bg-green-100 text-green-800" },
    transfer_money: { label: "โอนเงิน", color: "bg-blue-100 text-blue-800" },
  };

  useEffect(() => {
    if (propTableNumber) {
      console.log("propTableNumber จาก props:", propTableNumber);
      setTableNumber(propTableNumber);
    } else {
      const storedTableNumber = sessionStorage.getItem("table_number");
      console.log("table_number จาก sessionStorage:", storedTableNumber);
      setTableNumber(storedTableNumber);
    }
  }, [propTableNumber]);

  // ฟังก์ชันดึงข้อมูลบิล
  const fetchBill = async () => {
    try {
      console.log("เรียก API ด้วย order_code:", order_code);
      const res = await axios.get(
        `http://localhost:3000/api/user/viewOrder-list/${order_code}`
      );
      console.log("ข้อมูลที่ได้จาก API:", res.data);
      console.log(
        "status_pay จาก orders:",
        res.data.orders.map((order) => ({
          order_id: order.order_id,
          status_pay: order.status_pay,
          payment_slip: order.payment_slip,
        }))
      );
      setBill(res.data);
    } catch (error) {
      console.error("Fetch bill error:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      toast.error("ไม่พบคำสั่งซื้อนี้");
    }
  };

  useEffect(() => {
    console.log("useEffect ทำงานด้วย order_code:", order_code);
    fetchBill();
  }, [order_code]);

  // รีเฟรชบิลเมื่อมีการอัปเดตจาก socket.io
  useEffect(() => {
    socket.on("order_status_updated", (data) => {
      console.log("ได้รับการอัปเดตสถานะ:", data);
      fetchBill();
    });
    socket.on("order_payment_updated", (data) => {
      console.log("ได้รับการอัปเดตการชำระเงิน:", data);
      fetchBill();
    });
    return () => {
      socket.off("order_status_updated");
      socket.off("order_payment_updated");
    };
  }, []);

  // ฟังก์ชันยกเลิกออเดอร์ (เปิด modal)
  const handleCancelOrder = (orderId) => {
    if (!orderId || !bill.orders.some((o) => o.order_id === orderId)) {
      toast.error("ไม่พบคำสั่งซื้อนี้ในบิล");
      return;
    }
    setSelectedOrderId(orderId);
    setShowCancelModal(true);
  };

  // ฟังก์ชันยืนยันการยกเลิก
  const confirmCancelOrder = async () => {
    if (!selectedOrderId) return;
    setShowCancelModal(false);
    setLoading((prev) => ({ ...prev, [selectedOrderId]: true }));
    try {
      await axios.put(
        `http://localhost:3000/api/user/viewOrder-list/cancel-order/${selectedOrderId}`,
        {
          status: "cancelled",
        }
      );
      await fetchBill();
      toast.success(`ยกเลิกคำสั่งซื้อ #${selectedOrderId} เรียบร้อยแล้ว!`);
    } catch (error) {
      console.error("Cancel order error:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      const errorMessage =
        error.response?.data?.message ||
        `ไม่สามารถยกเลิกคำสั่งซื้อ #${selectedOrderId} ได้`;
      toast.error(errorMessage);
    } finally {
      setLoading((prev) => ({ ...prev, [selectedOrderId]: false }));
    }
  };

  // ฟังก์ชันเปิด modal จ่ายบิล
  const handlePayOrder = (orderId) => {
    if (!orderId || !bill.orders.some((o) => o.order_id === orderId)) {
      toast.error("ไม่พบคำสั่งซื้อนี้ในบิล");
      return;
    }
    setSelectedOrderId(orderId);
    setPaymentMethod("cash");
    setPaymentSlip(null);
    setShowPayModal(true);
  };

  // ฟังก์ชันยืนยันการชำระเงิน
  const confirmPayOrder = async () => {
    if (!selectedOrderId) return;
    if (paymentMethod === "transfer_money" && !paymentSlip) {
      toast.error("กรุณาอัปโหลดสลิปการโอนเงิน");
      return;
    }

    setShowPayModal(false);
    setLoading((prev) => ({ ...prev, [selectedOrderId]: true }));
    try {
      const formData = new FormData();
      formData.append("status_pay", paymentMethod);
      if (paymentSlip) {
        console.log("อัปโหลดไฟล์สลิป:", paymentSlip);
        formData.append("payment_slip", paymentSlip);
      }

      const response = await axios.put(
        `http://localhost:3000/api/user/viewOrder-list/pay-order/${selectedOrderId}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      console.log("ผลลัพธ์จากการอัปโหลด:", response.data);
      await fetchBill();
      toast.success(`ชำระเงินคำสั่งซื้อ #${selectedOrderId} เรียบร้อยแล้ว!`);
    } catch (error) {
      console.error("Pay order error:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      const errorMessage =
        error.response?.data?.message ||
        `ไม่สามารถชำระเงินคำสั่งซื้อ #${selectedOrderId} ได้`;
      toast.error(errorMessage);
    } finally {
      setLoading((prev) => ({ ...prev, [selectedOrderId]: false }));
    }
  };

  // ฟังก์ชันเปิด modal สลิป
  const handleViewSlip = (order) => {
    setSelectedSlipOrder(order);
    setShowSlipModal(true);
  };

  if (!bill) return <p className="text-center py-10">กำลังโหลด...</p>;

  const { temp_receipt, orders } = bill;

  const formatPrice = (num) =>
    new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
    }).format(num || 0);

  const totalPrice = formatPrice(
    orders
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + parseFloat(o.total_price || 0), 0)
  );

  // ฟังก์ชันเปิด modal ชำระทั้งหมด
  const handlePayAllOrders = () => {
    setPaymentMethod("cash");
    setPaymentSlip(null);
    setShowPayAllModal(true);
  };

  // ฟังก์ชันยืนยันชำระทั้งหมด
  const confirmPayAllOrders = async () => {
    if (paymentMethod === "transfer_money" && !paymentSlip) {
      toast.error("กรุณาอัปโหลดสลิปการโอนเงิน");
      return;
    }

    setShowPayAllModal(false);
    setLoading((prev) => ({ ...prev, payAll: true }));
    try {
      const formData = new FormData();
      formData.append("status_pay", paymentMethod);
      if (paymentSlip) {
        formData.append("payment_slip", paymentSlip);
      }

      const response = await axios.put(
        `http://localhost:3000/api/user/viewOrder-list/pay-all-orders/${order_code}`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      await fetchBill();
      toast.success("ชำระเงินทุกคำสั่งซื้อเรียบร้อยแล้ว!");
    } catch (error) {
      console.error("Pay all orders error:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      toast.error(
        error.response?.data?.message || "ไม่สามารถชำระเงินทุกคำสั่งซื้อได้"
      );
    } finally {
      setLoading((prev) => ({ ...prev, payAll: false }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100">
      <Navbar />
      <div className="container mx-auto px-4 py-8 pt-20">
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl p-6 shadow-xl relative">
          <h2 className="text-3xl font-bold mb-2">ใบรวมรายการคำสั่งซื้อ</h2>
          <p className="text-lg text-orange-100 mb-4">
            รหัสบิล:{" "}
            <span className="font-semibold text-white">
              {temp_receipt.temp_receipt_code}
            </span>
          </p>
          <div className="flex gap-4 text-sm text-orange-100">
            <div>เลขโต๊ะ: {temp_receipt.table_number}</div>
            <div>
              วันที่/เวลา:{" "}
              {new Date(temp_receipt.temp_receipt_time).toLocaleString("th-TH")}
            </div>
          </div>
        </div>

        {/* Orders */}
        {orders.map((order, idx) => (
          <div
            key={idx}
            className={`mt-6 ${
              order.status === "cancelled" ? "opacity-50" : ""
            }`}
          >
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-orange-700 mb-2">
                คำสั่งซื้อที่ {order.order_id} - สถานะ:{" "}
                {orderStatuses[order.status]?.label || order.status}
              </h3>
              <div className="flex gap-2">
                {order.status === "pending" && (
                  <button
                    onClick={() => handleCancelOrder(order.order_id)}
                    disabled={loading[order.order_id]}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl"
                  >
                    {loading[order.order_id] ? "กำลังยกเลิก..." : "ยกเลิก"}
                  </button>
                )}
                {order.status !== "completed" &&
                  order.status !== "cancelled" &&
                  order.status_pay !== "cash" &&
                  order.status_pay !== "transfer_money" && (
                    <button
                      onClick={() => handlePayOrder(order.order_id)}
                      disabled={loading[order.order_id]}
                      className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl"
                    >
                      {loading[order.order_id]
                        ? "กำลังดำเนินการ..."
                        : "จ่ายบิล"}
                    </button>
                  )}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 mb-2">
              <p className="text-gray-600">
                วิธีชำระ:{" "}
                <span
                  className={`px-2 py-1 rounded ${
                    paymentStatusInfo[order.status_pay || "uncash"].color
                  }`}
                >
                  {paymentStatusInfo[order.status_pay || "uncash"].label}
                </span>
              </p>
              {order.payment_slip && (
                <div className="mt-2">
                  <p className="text-gray-600">สลิปการชำระเงิน:</p>
                  <button
                    onClick={() => handleViewSlip(order)}
                    className="text-blue-600 hover:underline"
                  >
                    ดูสลิป
                  </button>
                </div>
              )}
            </div>
            {order.items.map((item, i) => (
              <div
                key={i}
                className="bg-white rounded-xl shadow-lg border border-orange-100 p-4 mb-2 flex justify-between"
              >
                <div>
                  <h4 className="text-orange-800 font-bold">
                    {item.menu_name}
                  </h4>
                  <p>จำนวน: {item.quantity} จาน</p>
                  {item.note && <p>รายละเอียดเพิ่มเติม: {item.note}</p>}
                  {item.specialRequest && (
                    <p>ระดับการเสิร์ฟ: {item.specialRequest}</p>
                  )}
                </div>
                <div className="text-orange-600 font-bold">
                  {formatPrice(item.subtotal)}
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Total */}
        <div className="mt-6 bg-white rounded-xl shadow-xl border-2 border-orange-200 p-4 flex justify-between text-xl font-bold">
          <span>ยอดรวมทั้งหมด:</span>
          <span>{totalPrice}</span>
        </div>

        {/* <div className="flex justify-center mt-4">
          <Link
            to={`/user-menu/table/${tableNumber}`}
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl"
          >
            หน้าหลัก
          </Link>
        </div> */}
        <div className="flex justify-center mt-4 gap-4">
          <Link
            to={`/user-menu/table/${tableNumber}`}
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl"
          >
            หน้าหลัก
          </Link>
          <button
            onClick={handlePayAllOrders}
            disabled={
              loading.payAll ||
              orders.every(
                (o) =>
                  o.status_pay === "cash" || o.status_pay === "transfer_money"
              )
            }
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl disabled:bg-gray-400"
          >
            {loading.payAll ? "กำลังดำเนินการ..." : "ชำระทั้งหมด"}
          </button>
        </div>

        {/* Modal ยกเลิกออเดอร์ */}
        {showCancelModal && (
          <div className="fixed inset-0 bg-black/30 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 shadow-xl w-full max-w-md">
              <h3 className="text-lg font-bold text-orange-700 mb-4">
                ยืนยันการยกเลิก
              </h3>
              <p className="text-gray-600 mb-6">
                คุณแน่ใจหรือไม่ว่าต้องการยกเลิกคำสั่งซื้อ #
                <span className="font-bold">{selectedOrderId}</span>?
              </p>
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={confirmCancelOrder}
                  disabled={loading[selectedOrderId]}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg"
                >
                  {loading[selectedOrderId] ? "กำลังยกเลิก..." : "ยืนยัน"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal จ่ายบิล */}
        {showPayModal && (
          <div
            className="fixed inset-0 bg-black/30 bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setShowPayModal(null)}
          >
            <div
              className="bg-white rounded-lg p-6 shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-orange-700 mb-4">
                ชำระเงินคำสั่งซื้อ #{selectedOrderId}
              </h3>
              <p className="text-gray-600 mb-4">
                โปรดเลือกวิธีชำระเงินสำหรับคำสั่งซื้อ #{selectedOrderId}
              </p>
              <div className="mb-4">
                <label className="block text-gray-600 mb-2">
                  วิธีชำระเงิน:
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-400"
                >
                  <option value="cash">เงินสด</option>
                  <option value="transfer_money">โอนเงิน</option>
                </select>
              </div>
              {paymentMethod === "transfer_money" && (
                <div className="mb-4">
                  <p className="text-gray-600 mb-2">
                    สแกน QR Code เพื่อโอนเงิน:
                  </p>
                  <img
                    src="http://localhost:3000/uploads/bill/slip_test.jpg"
                    alt=""
                    className="w-full max-w-xs mx-auto rounded-lg"
                  />
                  <label className="block text-gray-600 mt-4 mb-2">
                    อัปโหลดสลิปการโอนเงิน:
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      console.log("เลือกไฟล์สลิป:", file);
                      setPaymentSlip(file);
                    }}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg"
                  />
                  {paymentSlip && (
                    <p className="text-gray-600 mt-2">
                      ไฟล์ที่เลือก: {paymentSlip.name}
                    </p>
                  )}
                </div>
              )}
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => setShowPayModal(false)}
                  className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={confirmPayOrder}
                  disabled={loading[selectedOrderId]}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg"
                >
                  {loading[selectedOrderId] ? "กำลังดำเนินการ..." : "ยืนยัน"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal ชำระทั้งหมด */}
        {showPayAllModal && (
          <div
            className="fixed inset-0 bg-black/30 bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setShowPayAllModal(false)}
          >
            <div
              className="bg-white rounded-lg p-6 shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-orange-700 mb-4">
                ชำระเงินทุกคำสั่งซื้อ
              </h3>
              <p className="text-gray-600 mb-4">
                โปรดเลือกวิธีชำระเงินสำหรับทุกคำสั่งซื้อในบิลนี้
              </p>
              <div className="mb-4">
                <label className="block text-gray-600 mb-2">
                  วิธีชำระเงิน:
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-400"
                >
                  <option value="cash">เงินสด</option>
                  <option value="transfer_money">โอนเงิน</option>
                </select>
              </div>
              {paymentMethod === "transfer_money" && (
                <div className="mb-4">
                  <p className="text-gray-600 mb-2">
                    สแกน QR Code เพื่อโอนเงิน:
                  </p>
                  <img
                    src="http://localhost:3000/uploads/bill/slip_test.jpg"
                    alt=""
                    className="w-full max-w-xs mx-auto rounded-lg"
                  />
                  <label className="block text-gray-600 mt-4 mb-2">
                    อัปโหลดสลิปการโอนเงิน:
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      console.log("เลือกไฟล์สลิป:", file);
                      setPaymentSlip(file);
                    }}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg"
                  />
                  {paymentSlip && (
                    <p className="text-gray-600 mt-2">
                      ไฟล์ที่เลือก: {paymentSlip.name}
                    </p>
                  )}
                </div>
              )}
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => setShowPayAllModal(false)}
                  className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={confirmPayAllOrders}
                  disabled={loading.payAll}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg"
                >
                  {loading.payAll ? "กำลังดำเนินการ..." : "ยืนยัน"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal ดูสลิป */}
        {showSlipModal &&
          selectedSlipOrder &&
          selectedSlipOrder.payment_slip && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">
                    สลิปการชำระเงิน - คำสั่งซื้อ #{selectedSlipOrder.order_id}
                  </h2>
                  <button
                    onClick={() => setShowSlipModal(false)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
                <div className="flex justify-center">
                  <img
                    src={`${API_URL_IMAGE}/${selectedSlipOrder.payment_slip}`}
                    alt="Payment Slip"
                    className="max-w-full h-auto rounded-lg"
                    style={{ maxHeight: "70vh" }}
                  />
                </div>
                <div className="mt-6 text-center">
                  <button
                    onClick={() => setShowSlipModal(false)}
                    className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-8 py-3 rounded-xl hover:from-orange-600 hover:to-orange-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl font-medium"
                  >
                    ปิด
                  </button>
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
};

export default ViewBill;
