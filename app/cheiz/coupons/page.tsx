"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

// TODO: Bubble DB의 실제 쿠폰 테이블 구조에 맞춰 타입 정의
type Coupon = {
  _id: string;
  code?: string;
  discount?: number;
  description?: string;
  expiresAt?: string;
  isUsed?: boolean;
};

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Bubble DB에서 쿠폰 데이터 가져오기
    // 현재는 예시 데이터로 표시
    setTimeout(() => {
      setCoupons([
        {
          _id: "1",
          code: "WELCOME20",
          discount: 20,
          description: "첫 방문 고객 20% 할인",
          expiresAt: "2026-03-31",
          isUsed: false,
        },
        {
          _id: "2",
          code: "CHEIZ10",
          discount: 10,
          description: "친구 추천 10% 할인",
          expiresAt: "2026-02-28",
          isUsed: false,
        },
      ]);
      setLoading(false);
    }, 500);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-skyblue border-solid mx-auto mb-4"></div>
          <p className="text-gray-600">쿠폰을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <motion.section
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-gradient-to-r from-skyblue to-blue-500 text-white py-12 px-6"
      >
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-4">🎫 쿠폰 조회</h1>
          <p className="text-lg opacity-90">사용 가능한 쿠폰을 확인하세요</p>
        </div>
      </motion.section>

      {/* Coupons List */}
      <section className="py-12 px-6">
        <div className="max-w-4xl mx-auto">
          {coupons.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-gray-50 rounded-3xl p-12 text-center"
            >
              <div className="text-5xl mb-4">🎁</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">
                사용 가능한 쿠폰이 없습니다
              </h3>
              <p className="text-gray-600 mb-8">
                새로운 쿠폰이 등록되면 알려드릴게요!
              </p>
              <Link
                href="/cheiz"
                className="inline-block bg-skyblue text-white font-bold py-3 px-8 rounded-3xl hover:bg-opacity-90 transition-all"
              >
                홈으로 돌아가기
              </Link>
            </motion.div>
          ) : (
            <div className="space-y-6">
              {coupons.map((coupon, index) => (
                <motion.div
                  key={coupon._id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                  className="bg-gradient-to-r from-skyblue to-blue-500 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden"
                >
                  {/* Background Pattern */}
                  <div className="absolute top-0 right-0 opacity-10">
                    <svg
                      width="200"
                      height="200"
                      viewBox="0 0 200 200"
                      className="text-white"
                    >
                      <circle cx="100" cy="100" r="80" fill="currentColor" />
                    </svg>
                  </div>

                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="inline-block bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full mb-3">
                          <span className="font-mono font-bold text-lg">
                            {coupon.code}
                          </span>
                        </div>
                        <h3 className="text-2xl font-bold mb-2">
                          {coupon.discount}% 할인
                        </h3>
                        <p className="opacity-90">{coupon.description}</p>
                      </div>
                      <div className="text-5xl">🎫</div>
                    </div>

                    <div className="flex items-center justify-between mt-6 pt-6 border-t border-white/30">
                      <p className="text-sm opacity-80">
                        {coupon.expiresAt
                          ? `유효기간: ${new Date(
                              coupon.expiresAt
                            ).toLocaleDateString()}`
                          : ""}
                      </p>
                      <button
                        className="bg-white text-skyblue font-bold py-2 px-6 rounded-full hover:bg-opacity-90 transition-all"
                        onClick={() => {
                          navigator.clipboard.writeText(coupon.code || "");
                          alert("쿠폰 코드가 복사되었습니다!");
                        }}
                      >
                        복사하기
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Info */}
      <section className="py-12 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <h3 className="text-2xl font-bold text-gray-800 mb-4">
              쿠폰 사용 안내
            </h3>
            <ul className="text-gray-600 space-y-2">
              <li>• 쿠폰은 예약 시 자동으로 적용됩니다</li>
              <li>• 중복 사용이 불가능합니다</li>
              <li>• 유효기간이 지난 쿠폰은 사용할 수 없습니다</li>
            </ul>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
