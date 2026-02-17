"use client";

import { Map } from "lucide-react";

export default function ToursAdmin() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900">투어 관리</h2>
        <p className="text-sm text-gray-400 mt-1">투어 목록 조회, 생성/수정, 스케줄 관리, 마감 토글</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
          <Map className="w-8 h-8 text-[#0055FF]/40" />
        </div>
        <h3 className="font-bold text-gray-700 mb-1">투어 관리 기능 준비 중</h3>
        <p className="text-xs text-gray-400">Java Backend API와 연동하여 투어 CRUD 기능이 추가됩니다.</p>
        <div className="mt-4 text-xs text-gray-400">
          <p>데이터 소스: <span className="font-bold text-gray-600">Java Backend</span> (api.lifeshot.me)</p>
          <p className="mt-1">관련 API: GET/POST/PATCH /api/v1/tours, GET /api/v1/schedules</p>
        </div>
      </div>
    </div>
  );
}
