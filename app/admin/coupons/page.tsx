"use client";

import { Ticket } from "lucide-react";

export default function CouponsAdmin() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900">쿠폰 & 크레딧 관리</h2>
        <p className="text-sm text-gray-400 mt-1">쿠폰 발행, 사용 현황, EXCEL 쿠폰 업로드, 크레딧 통계</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
          <Ticket className="w-8 h-8 text-indigo-500/40" />
        </div>
        <h3 className="font-bold text-gray-700 mb-1">쿠폰 관리 기능 준비 중</h3>
        <p className="text-xs text-gray-400">Java Backend + Bubble DB와 연동됩니다.</p>
        <div className="mt-4 text-xs text-gray-400">
          <p>Java: <span className="font-bold text-gray-600">issued-coupons, redeem-coupon, wallet, gift-register</span></p>
          <p className="mt-1">Bubble: <span className="font-bold text-gray-600">EXCEL 테이블 (search-coupon)</span></p>
          <p className="mt-1">크레딧 타입: Photo / AI / Retouch</p>
        </div>
      </div>
    </div>
  );
}
