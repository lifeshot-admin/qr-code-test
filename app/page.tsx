"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Camera, ArrowRight, Settings } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-md w-full text-center"
      >
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-8"
        >
          <div className="w-20 h-20 bg-[#0055FF] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Camera className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-[#1A1A1A]">
            <span className="text-[#0055FF]">Cheiz</span>
          </h1>
          <p className="text-gray-500 text-sm mt-2">일본 포토 투어 예약 서비스</p>
        </motion.div>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-[#1A1A1A] text-lg mb-10 leading-relaxed"
        >
          오늘 우리,<br />
          어떤 포즈로 찍어볼까?
        </motion.p>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="space-y-3"
        >
          <Link
            href="/cheiz"
            className="flex items-center justify-center gap-2 w-full h-14 bg-[#0055FF] hover:bg-[#0055FF]/90 text-white font-semibold rounded-xl transition-all shadow-lg"
          >
            Cheiz 메인 서비스 시작하기
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/photographer"
            className="flex items-center justify-center gap-2 w-full h-14 bg-[#F8F9FA] hover:bg-gray-200 text-[#1A1A1A] font-semibold rounded-xl transition-all"
          >
            <Camera className="w-5 h-5" />
            포토그래퍼 앱
          </Link>
          <Link
            href="/admin"
            className="flex items-center justify-center gap-2 w-full h-14 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-xl transition-all"
          >
            <Settings className="w-5 h-5" />
            관리자 페이지
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
