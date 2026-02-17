"use client";

import { CalendarCheck } from "lucide-react";

export default function ReservationsAdmin() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900">예약 관리</h2>
        <p className="text-sm text-gray-400 mt-1">전체 예약 조회, 상태 변경, QR 코드 확인, 취소 처리</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
          <CalendarCheck className="w-8 h-8 text-green-500/40" />
        </div>
        <h3 className="font-bold text-gray-700 mb-1">예약 관리 기능 준비 중</h3>
        <p className="text-xs text-gray-400">Bubble DB의 pose_reservation 테이블과 연동됩니다.</p>
        <div className="mt-4 text-xs text-gray-400">
          <p>데이터 소스: <span className="font-bold text-gray-600">Bubble DB</span> (pose_reservation, reserved_pose)</p>
          <p className="mt-1">+ <span className="font-bold text-gray-600">Java Backend</span> (folders, folder-status)</p>
        </div>
      </div>
    </div>
  );
}
