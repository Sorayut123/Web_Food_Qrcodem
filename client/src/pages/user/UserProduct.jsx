import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import Navbar from "../../components/user/Navbar";
import Footer from "../../components/user/Footer";

import toast from "react-hot-toast";

const generateOrderCode = (table_number) => {
  const now = new Date();
  const timestamp =
    now.getFullYear().toString().slice(-2) +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0");

  return `T${table_number}-${timestamp}`;
};

const API_URL_IMAGE = "http://localhost:3000/uploads/food";

// ConfirmModal Component ย่อยในไฟล์เดียวกัน
const ConfirmModal = ({ show, title, message, onConfirm, onCancel }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black/40 bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-lg">
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        <p className="mb-6">{message}</p>
        <div className="flex justify-end gap-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400"
          >
            ยกเลิก
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded bg-green-500 text-white hover:bg-green-600"
          >
            ยืนยัน
          </button>
        </div>
      </div>
    </div>
  );
};

const CancelModal = ({ show, title, message, onConfirm, onCancel }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl text-center animate-fade-in">
        <h2 className="text-xl font-semibold mb-4 text-orange-700">{title}</h2>
        <p className="mb-6 text-gray-700">{message}</p>
        <div className="flex justify-center gap-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-gray-300 hover:bg-gray-400"
          >
            ยกเลิก
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600"
          >
            ยืนยัน
          </button>
        </div>
      </div>
    </div>
  );
};

const CancelAllModal = ({ show, onConfirm, onCancel }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl text-center animate-fade-in">
        <div className="text-5xl text-red-500 mb-4">⚠️</div>
        <h2 className="text-xl font-semibold mb-2 text-orange-800">
          ยกเลิกคำสั่งซื้อทั้งหมด
        </h2>
        <p className="text-gray-700 mb-6">
          คุณแน่ใจหรือไม่ว่าต้องการยกเลิกคำสั่งซื้อทั้งหมด?
          การกระทำนี้ไม่สามารถย้อนกลับได้
        </p>
        <div className="flex justify-center gap-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-gray-300 hover:bg-gray-400"
          >
            ยกเลิก
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600"
          >
            ยืนยัน
          </button>
        </div>
      </div>
    </div>
  );
};

const UserProduct = () => {
  const [cart, setCart] = useState([]);
  const [hasPendingOrder, setHasPendingOrder] = useState(false);
  const { table_number } = useParams();
  const navigate = useNavigate();

  //modal cancle เมนูเดียว
  const [itemToRemove, setItemToRemove] = useState(null);
  const [showRemoveItemModal, setShowRemoveItemModal] = useState(false);

  //ยินยันคำสั่งซื้อ
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  //ลบคำสั่งซื้อทั้งหมด
  const [showCancelAllModal, setShowCancelAllModal] = useState(false);

  useEffect(() => {
    // เช็คว่ามี order_code อยู่ใน sessionStorage หรือไม่
    const existingOrderCode = sessionStorage.getItem("order_code");
    // setHasPendingOrder(!!existingOrderCode);

    const storedCart = JSON.parse(sessionStorage.getItem("cart")) || {
      items: [],
    };
    const validCart = Array.isArray(storedCart.items) ? storedCart.items : [];
    const updatedCart = validCart.map((item) => ({
      ...item,
      quantity: item.quantity || 1,
    }));
    setCart(updatedCart);

    if (!/^\d+$/.test(table_number)) {
      toast.error("เลขโต๊ะไม่ถูกต้อง")
      navigate("/404");
      return;
    }

    axios
      .get(`http://localhost:3000/api/user/check-table/${table_number}`)
      .then(() => {})
      .catch(() => {

        toast.error("ไม่พบโต๊ะนี้ในระบบ")
        navigate("/404");
      });
  }, [table_number, navigate]);

  const updateQuantity = (cartItemId, newQuantity) => {
    if (newQuantity < 1) return;

    const updatedCart = cart.map((item) =>
      item.cartItemId === cartItemId ? { ...item, quantity: newQuantity } : item
    );

    setCart(updatedCart);
    sessionStorage.setItem(
      "cart",
      JSON.stringify({ table_number, items: updatedCart })
    );

    window.dispatchEvent(new Event("cartUpdated"));
  };

  const handleRemoveItem = (cartItemIdToDelete) => {
    const updatedItems = cart.filter(
      (item) => item.cartItemId !== cartItemIdToDelete
    );
    sessionStorage.setItem(
      "cart",
      JSON.stringify({ table_number, items: updatedItems })
    );
    setCart(updatedItems);
    toast.error("ยกเลิกรายการเรียบร้อยแล้ว!");
    window.dispatchEvent(new Event("cartUpdated"));
  };

  const handleCancelAll = () => {
    sessionStorage.removeItem("cart");
    setCart([]);
    toast.error("ยกเลิกคำสั่งซื้อเรียบร้อยแล้ว!");
    setShowCancelAllModal(false);
    window.dispatchEvent(new Event("cartUpdated"));
  };

  // ฟังก์ชันส่งคำสั่งซื้อจริง ๆ หลัง confirm
  const handleConfirmSubmitOrder = async () => {
    setShowConfirmModal(false);

    if (!cart.length) {
      toast.error("เกิดข้อผิดพลาดในการส่งคำสั่งซื้อ!");
      return;
    }

    // ถ้ามี orderCode ใน sessionStorage ให้ใช้, ไม่สร้างใหม่
    let orderCode = sessionStorage.getItem("order_code");
    if (!orderCode) {
      orderCode = generateOrderCode(table_number);
      sessionStorage.setItem("order_code", orderCode);
    }

    const orderData = {
      order_code: orderCode,
      table_number,
      items: cart.map((item) => ({
        menu_id: item.id,
        quantity: item.quantity,
        price: parseFloat(item.price),
        note: item.note,
        specialRequest: item.specialRequest,
      })),
    };

    try {
      await axios.post("http://localhost:3000/api/user/order", orderData);
      toast.success("ยืนยันคำสั่งซื้อสำเร็จ!");
      sessionStorage.removeItem("cart");
      setCart([]);
      setHasPendingOrder(true);

      navigate(`/user/viewOrder-list/${orderCode}`);
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการส่งคำสั่งซื้อ!");
    }
    window.dispatchEvent(new Event("cartUpdated"));
  };

  const totalPrice = cart.reduce(
    (sum, item) => sum + (parseFloat(item.price) || 0) * (item.quantity || 1),
    0
  );

  return (
    <div className="min-h-screen bg-orange-50">
      <Navbar tableNumber={table_number} />

      <div className="container mx-auto px-4 py-8 pt-18">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-gradient-to-br from-orange-900 via-black/90 to-orange-800 text-white px-6 py-4">
            <h1 className="text-2xl font-bold">รายการรอคําสั่งซื้อ</h1>
            <p className="text-xl font-bold">โต๊ะที่ {table_number}</p>
          </div>

          <div className="p-6">
            {cart.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-lg">
                ยังไม่มีสินค้าในคําสั่งซื้อ
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map((item, index) => (
                  <div
                    key={item.cartItemId || index}
                    className="border-b border-orange-100 pb-4 last:border-0"
                  >
                    <div className="flex flex-col md:flex-row gap-4 p-4 border border-orange-100 rounded-lg bg-white shadow-sm">
                      <div className="w-full md:w-1/3">
                        <img
                          src={`${API_URL_IMAGE}/${item.image}`}
                          alt={item.name || "image"}
                          className="w-full h-48 object-cover rounded-lg"
                        />
                      </div>

                      <div className="flex-1 flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-orange-800 mb-2">
                            {item.name}
                          </h3>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="text-gray-500">
                              รายละเอียดเพิ่มเติมจานอาหาร :
                            </div>
                            <div>{item.note || "ไม่มี"}</div>
                            <div className="text-gray-500">คำสั่งพิเศษ :</div>
                            <div>{item.specialRequest || "ไม่มี"}</div>
                            <div className="text-gray-500">จำนวน :</div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() =>
                                  updateQuantity(
                                    item.cartItemId,
                                    item.quantity - 1
                                  )
                                }
                                className="px-2 py-1 bg-orange-200 rounded hover:bg-orange-300"
                                disabled={item.quantity <= 1}
                              >
                                -
                              </button>
                              <span className="text-lg">{item.quantity}</span>
                              <button
                                onClick={() =>
                                  updateQuantity(
                                    item.cartItemId,
                                    item.quantity + 1
                                  )
                                }
                                className="px-2 py-1 bg-orange-200 rounded hover:bg-orange-300"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end justify-between">
                          <p className="text-2xl font-bold text-orange-600 mb-2">
                            {(parseFloat(item.price) * item.quantity).toFixed(
                              2
                            )}{" "}
                            บาท
                          </p>
                          <button
                            className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors flex items-center gap-2"
                            onClick={() => {
                              setItemToRemove(item);
                              setShowRemoveItemModal(true);
                            }}
                          >
                            ยกเลิกรายการ
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-orange-50 px-6 py-4 border-t border-orange-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-orange-800">ราคารวม :</h3>
              <p className="text-2xl font-bold text-orange-600">
                {totalPrice.toFixed(2)} บาท
              </p>
            </div>

            <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:space-x-4">
              {/* ปุ่มยืนยันคำสั่งซื้อ */}
              <button
                className={`flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-4 rounded-lg transition-colors ${
                  hasPendingOrder ? "opacity-50 cursor-not-allowed" : ""
                }`}
                onClick={() => setShowConfirmModal(true)}
                disabled={hasPendingOrder}
              >
                ยืนยันการสั่งซื้อ
              </button>

              {/* ปุ่มยกเลิกคำสั่งซื้อทั้งหมด */}
              <button
                className={`flex-1 bg-white border border-orange-500 text-orange-500 hover:bg-orange-50 font-bold py-3 px-4 rounded-lg transition-colors ${
                  hasPendingOrder ? "opacity-50 cursor-not-allowed" : ""
                }`}
                onClick={() => setShowCancelAllModal(true)}
                disabled={hasPendingOrder}
              >
                ยกเลิกคําสั่งซื้อทั้งหมด
              </button>
            </div>

            {hasPendingOrder && (
              <p className="mt-2 text-red-600 font-medium text-center">
                ⚠️ คุณมีคำสั่งซื้อค้างอยู่ กรุณายกเลิกคำสั่งซื้อก่อนทำรายการใหม่
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      <ConfirmModal
        show={showConfirmModal}
        onConfirm={handleConfirmSubmitOrder}
        onCancel={() => setShowConfirmModal(false)}
        title="ยืนยันคำสั่งซื้อ"
        message="คุณแน่ใจว่าต้องการยืนยันคำสั่งซื้อนี้หรือไม่?"
      />

      <Footer />

      <CancelModal
        show={showRemoveItemModal}
        onConfirm={() => {
          if (itemToRemove) {
            handleRemoveItem(itemToRemove.cartItemId);
            setItemToRemove(null);
            setShowRemoveItemModal(false);
          }
        }}
        onCancel={() => setShowRemoveItemModal(false)}
        title="ยกเลิกรายการ"
        message={`คุณแน่ใจว่าต้องการลบเมนู "${itemToRemove?.name}" หรือไม่?`}
      />

      <CancelAllModal
        show={showCancelAllModal}
        onConfirm={handleCancelAll}
        onCancel={() => setShowCancelAllModal(false)}
      />
    </div>
  );
};

export default UserProduct;
