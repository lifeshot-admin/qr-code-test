"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import Link from "next/link";

type Reservation = {
  _id: string;
  status?: string;
  "Created Date"?: string;
  auth_photo_url?: string;
};

export default function MyPage() {
  const { data: session } = useSession();
  const [reservations, setReservations] = useState<Reservation[]>([]);

  useEffect(() => {
    if (session?.user) {
      // TODO: 사용자의 예약 목록 가져오기
      // fetch(`/api/bubble/my-reservations?userId=${session.user.id}`)
      setReservations([]);
    }
  }, [session]);

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-lg p-12 text-center max-w-md"
        >
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            로그인이 필요합니다
          </h2>
          <p className="text-gray-600 mb-8">
            마이페이지를 이용하려면 로그인해주세요.
          </p>
          <Link
            href="/api/auth/signin"
            className="inline-block bg-skyblue text-white font-bold py-3 px-8 rounded-3xl hover:bg-opacity-90 transition-all"
          >
            로그인하기
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-lg p-8 mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-800 mb-4">마이페이지</h1>
          <p className="text-gray-600">
            {session.user?.email || session.user?.name}님, 환영합니다!
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-3xl shadow-lg p-8"
        >
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            나의 예약 내역
          </h2>
          
          {reservations.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-6">예약 내역이 없습니다.</p>
              <Link
                href="/cheiz/booking"
                className="inline-block bg-skyblue text-white font-bold py-3 px-8 rounded-3xl hover:bg-opacity-90 transition-all"
              >
                예약하러 가기
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {reservations.map((reservation) => (
                <div
                  key={reservation._id}
                  className="border border-gray-200 rounded-3xl p-6 hover:border-skyblue transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-lg font-semibold text-gray-800">
                        예약 ID: {reservation._id}
                      </p>
                      <p className="text-gray-600">
                        상태: {reservation.status || "대기 중"}
                      </p>
                      {reservation["Created Date"] && (
                        <p className="text-sm text-gray-500 mt-2">
                          예약일: {new Date(reservation["Created Date"]).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    {reservation.auth_photo_url && (
                      <img
                        src={reservation.auth_photo_url}
                        alt="인증사진"
                        className="w-20 h-20 rounded-3xl object-cover"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
