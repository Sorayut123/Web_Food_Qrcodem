import React, { useState, useEffect } from "react";
import { Save, Edit2, User, Phone, Shield, Eye, EyeOff } from "lucide-react";
import useAuthStore from "../../stores/authStore";
import axios from "axios";
import toast from "react-hot-toast";

const UserProfileManagement = () => {
  const [userData, setUserData] = useState({
    id: "",
    first_name: "",
    last_name: "",
    username: "",
    phone_number: "",
    role: "",
    created_at: "",
    updated_at: "",
    password: "",
  });
  const [formData, setFormData] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const roleOptions = {
    owner: { name: "เจ้าของร้าน", color: "red", bgColor: "bg-red-50 border-red-200" },
  };

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        setIsLoading(true);
        const token = useAuthStore.getState().token;
        if (!token) {
          toast.error("ไม่พบ token การเข้าสู่ระบบ กรุณา login ใหม่");
          return;
        }

        const res = await axios.get("http://localhost:3000/api/owner/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUserData(res.data);
        setFormData(res.data);
        console.log("✅ โหลดข้อมูลผู้ใช้สำเร็จ:", res.data);
      } catch (error) {
        console.error("❌ โหลดข้อมูลผู้ใช้ล้มเหลว:", error);
        const errMsg =
          error.response?.data?.message || "โหลดข้อมูลผู้ใช้ล้มเหลว กรุณาลองใหม่";
        toast.error(errMsg);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, []);

  useEffect(() => {
    const { role: userRole, ...userDataWithoutRole } = userData;
    const { role: formRole, ...formDataWithoutRole } = formData;
    const hasChanged =
      JSON.stringify(formDataWithoutRole) !== JSON.stringify(userDataWithoutRole);
    setIsDirty(hasChanged);
  }, [formData, userData]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const validatePhoneNumber = (phone) => {
    const phoneRegex = /^[0-9]{10}$/;
    return phoneRegex.test(phone);
  };

  const handleSave = async () => {
    if (!isDirty) {
      toast.error("ไม่มีข้อมูลที่เปลี่ยนแปลง");
      return;
    }

    if (!formData.first_name?.trim()) {
      toast.error("กรุณากรอกชื่อ");
      return;
    }

    if (!formData.last_name?.trim()) {
      toast.error("กรุณากรอกนามสกุล");
      return;
    }

    if (!formData.username?.trim()) {
      toast.error("กรุณากรอกชื่อผู้ใช้");
      return;
    }

    if (!formData.phone_number?.trim()) {
      toast.error("กรุณากรอกเบอร์โทร");
      return;
    }

    if (!validatePhoneNumber(formData.phone_number)) {
      toast.error("กรุณากรอกเบอร์โทรให้ถูกต้อง (10 หลัก, ตัวเลขเท่านั้น)");
      return;
    }

    if (formData.password && formData.password.length < 6) {
      toast.error("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }

    try {
      setIsLoading(true);
      const token = useAuthStore.getState().token;
      if (!token) {
        toast.error("ไม่พบ token การเข้าสู่ระบบ กรุณา login ใหม่");
        return;
      }

      const updatedUser = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        username: formData.username,
        phone_number: formData.phone_number,
        password: formData.password || undefined,
      };

      const response = await axios.put(
        "http://localhost:3000/api/owner/profile",
        updatedUser,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setUserData((prev) => ({
        ...prev,
        ...updatedUser,
        role: prev.role,
        updated_at: new Date().toISOString(),
      }));

      setIsEditing(false);
      setIsDirty(false);
      setShowPassword(false);
      toast.success(response.data.message || "บันทึกข้อมูลสำเร็จ");
    } catch (error) {
      console.error("❌ Error saving user:", error);
      const errMsg =
        error.response?.data?.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล";
      toast.error(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({ ...userData });
    setIsEditing(false);
    setIsDirty(false);
    setShowPassword(false);
  };

  const getAccountAge = () => {
    const createdDate = new Date(userData.created_at);
    const now = new Date();
    const diffTime = Math.abs(now - createdDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
          </div>
        )}

        {!isLoading && (
          <>
            {/* Header */}
            <div className="bg-white rounded-2xl shadow-xl mb-6 p-6 border-l-4 border-orange-500">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-3xl font-bold text-gray-800 mb-2">โปรไฟล์ผู้ใช้</h1>
                  <p className="text-gray-600">จัดการข้อมูลส่วนตัวและการตั้งค่าบัญชี</p>
                </div>
                <div className="flex gap-3">
                  {isEditing ? (
                    <>
                      <button
                        onClick={handleCancel}
                        disabled={isLoading}
                        className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ยกเลิก
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={!isDirty || isLoading}
                        className={`px-6 py-3 rounded-xl font-semibold shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center gap-2 ${
                          isDirty && !isLoading
                            ? "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
                            : "bg-gray-300 text-gray-500 cursor-not-allowed"
                        }`}
                      >
                        <Save size={20} />
                        บันทึก
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsEditing(true)}
                      disabled={isLoading}
                      className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Edit2 size={20} />
                      แก้ไขข้อมูล
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              {/* Profile Header */}
              <div className="relative bg-gradient-to-r from-orange-400 to-orange-500 p-8">
                <div className="flex items-center gap-6">
                  <div className="text-white">
                    <h2 className="text-3xl font-bold mb-2">
                      {userData.first_name} {userData.last_name}
                    </h2>
                    <p className="text-orange-100 text-lg">@{userData.username}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Shield size={16} className="text-orange-200" />
                      <span className="text-orange-100">
                        {roleOptions[userData.role]?.name || userData.role}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* User Info Section */}
              <div className="p-8">
                <div className="space-y-8">
                  {/* Personal Information */}
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-4">ข้อมูลส่วนตัว</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* First Name */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                          ชื่อ *
                        </label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={formData.first_name || ""}
                            onChange={(e) => handleInputChange("first_name", e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                            placeholder="ชื่อ"
                            required
                          />
                        ) : (
                          <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
                            <p className="text-orange-600 font-semibold">
                              {userData.first_name || "ยังไม่ระบุชื่อ"}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Last Name */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                          นามสกุล *
                        </label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={formData.last_name || ""}
                            onChange={(e) => handleInputChange("last_name", e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                            placeholder="นามสกุล"
                            required
                          />
                        ) : (
                          <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
                            <p className="text-orange-600 font-semibold">
                              {userData.last_name || "ยังไม่ระบุนามสกุล"}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Phone Number */}
                      {/* <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                          เบอร์โทรศัพท์ *
                        </label>
                        {isEditing ? (
                          <input
                            type="tel"
                            value={formData.phone_number || ""}
                            onChange={(e) => handleInputChange("phone_number", e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                            placeholder="0812345678"
                            maxLength="10"
                          />
                        ) : (
                          <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                            <div className="flex items-center gap-3">
                              <Phone size={20} className="text-green-600" />
                              <p className="text-green-600 font-semibold">
                                {userData.phone_number || "ยังไม่ระบุเบอร์โทร"}
                              </p>
                            </div>
                          </div>
                        )}
                      </div> */}
                    </div>
                  </div>

                  {/* Account Information */}
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-4">ข้อมูลบัญชี</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Username */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                          ชื่อผู้ใช้ *
                        </label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={formData.username || ""}
                            onChange={(e) => handleInputChange("username", e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                            placeholder="ชื่อผู้ใช้"
                            required
                          />
                        ) : (
                          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                            <div className="flex items-center gap-3">
                              <User size={20} className="text-gray-600" />
                              <p className="text-gray-700 font-semibold">
                                {userData.username || "ยังไม่ระบุชื่อผู้ใช้"}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Password */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                          รหัสผ่าน
                        </label>
                        {isEditing ? (
                          <div className="relative">
                            <input
                              type={showPassword ? "text" : "password"}
                              value={formData.password || ""}
                              onChange={(e) => handleInputChange("password", e.target.value)}
                              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all pr-12"
                              placeholder="รหัสผ่าน (เว้นว่างหากไม่เปลี่ยน)"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                            >
                              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                          </div>
                        ) : (
                          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                            <p className="text-gray-700 font-semibold">••••••••••</p>
                          </div>
                        )}
                      </div>

                      {/* Role - Read Only */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                          บทบาท <span className="text-xs text-gray-500">(ไม่สามารถแก้ไขได้)</span>
                        </label>
                        <div
                          className={`p-4 rounded-xl border ${
                            roleOptions[userData.role]?.bgColor || "bg-gray-50 border-gray-200"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Shield
                              size={20}
                              className={`text-${roleOptions[userData.role]?.color || "gray"}-600`}
                            />
                            <p
                              className={`font-semibold text-${
                                roleOptions[userData.role]?.color || "gray"
                              }-600`}
                            >
                              {roleOptions[userData.role]?.name || userData.role}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Timestamps */}
                  <div className="pt-6 border-t border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-500">
                      <div>
                        <p className="font-semibold">วันที่สร้างบัญชี:</p>
                        <p>
                          {userData.created_at
                            ? new Date(userData.created_at).toLocaleString("th-TH", {
                                timeZone: "Asia/Bangkok",
                              })
                            : "ยังไม่ระบุ"}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold">อัปเดตล่าสุด:</p>
                        <p>
                          {userData.updated_at
                            ? new Date(userData.updated_at).toLocaleString("th-TH", {
                                timeZone: "Asia/Bangkok",
                              })
                            : "ยังไม่ระบุ"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default UserProfileManagement;