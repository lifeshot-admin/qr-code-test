"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useModal } from "@/components/GlobalModal";

export default function BookingPage() {
  const router = useRouter();
  const { showSuccess, showError } = useModal();
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    date: "",
    time: "",
    peopleCount: 1,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // TODO: pose_reservation API 호출
      const response = await fetch("/api/bubble/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await showSuccess("예약이 완료되었습니다!", { title: "예약 완료" });
        router.push("/cheiz/mypage");
      } else {
        throw new Error("예약 실패");
      }
    } catch (error) {
      await showError("예약에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white py-12 px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md mx-auto bg-white rounded-2xl shadow-sm p-8"
      >
        <h1 className="text-3xl font-bold text-gray-800 mb-8">예약하기</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-gray-700 font-semibold mb-2">
              이름
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-4 py-3 border border-gray-100 rounded-xl focus:outline-none focus:border-[#0055FF]"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-2">
              전화번호
            </label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              className="w-full px-4 py-3 border border-gray-100 rounded-xl focus:outline-none focus:border-[#0055FF]"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-2">
              이메일
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="w-full px-4 py-3 border border-gray-100 rounded-xl focus:outline-none focus:border-[#0055FF]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                날짜
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                className="w-full px-4 py-3 border border-gray-100 rounded-xl focus:outline-none focus:border-[#0055FF]"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                시간
              </label>
              <input
                type="time"
                required
                value={formData.time}
                onChange={(e) =>
                  setFormData({ ...formData, time: e.target.value })
                }
                className="w-full px-4 py-3 border border-gray-100 rounded-xl focus:outline-none focus:border-[#0055FF]"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-2">
              인원
            </label>
            <select
              value={formData.peopleCount}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  peopleCount: parseInt(e.target.value),
                })
              }
              className="w-full px-4 py-3 border border-gray-100 rounded-xl focus:outline-none focus:border-[#0055FF]"
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}명
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#0055FF] text-white font-bold py-4 rounded-xl hover:bg-opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "예약 중..." : "예약하기"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
