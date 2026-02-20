"use client";

import { ShoppingCart } from "lucide-react";

export default function OrdersAdmin() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900">주문 & 결제 관리</h2>
        <p className="text-sm text-gray-400 mt-1">주문 목록, 결제 현황, 환불 처리, 매출 통계</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
          <ShoppingCart className="w-8 h-8 text-amber-500/40" />
        </div>
        <h3 className="font-bold text-gray-700 mb-1">주문 관리 기능 준비 중</h3>
        <p className="text-xs text-gray-400">Java Backend + Stripe API와 연동됩니다.</p>
        <div className="mt-4 text-xs text-gray-400">
          <p>데이터 소스: <span className="font-bold text-gray-600">Java Backend</span> (orders, payments)</p>
          <p className="mt-1">결제: <span className="font-bold text-gray-600">Stripe</span> (webhook, checkout)</p>
        </div>
      </div>
    </div>
  );
}
