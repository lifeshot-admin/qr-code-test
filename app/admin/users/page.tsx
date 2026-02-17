"use client";

import { Users } from "lucide-react";

export default function UsersAdmin() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900">사용자 관리</h2>
        <p className="text-sm text-gray-400 mt-1">유저 목록, 역할 변경, 크레딧 관리, 탈퇴 처리</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto mb-4">
          <Users className="w-8 h-8 text-purple-500/40" />
        </div>
        <h3 className="font-bold text-gray-700 mb-1">사용자 관리 기능 준비 중</h3>
        <p className="text-xs text-gray-400">Java Backend의 유저 API와 연동됩니다.</p>
        <div className="mt-4 text-xs text-gray-400">
          <p>데이터 소스: <span className="font-bold text-gray-600">Java Backend</span> (user/me, wallet, issued-coupons)</p>
          <p className="mt-1">역할: User, Photographer (ROLE_SNAP), Admin, SuperAdmin</p>
        </div>
      </div>
    </div>
  );
}
