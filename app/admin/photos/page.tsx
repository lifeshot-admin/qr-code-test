"use client";

import { FolderOpen } from "lucide-react";

export default function PhotosAdmin() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900">사진 & AI 관리</h2>
        <p className="text-sm text-gray-400 mt-1">폴더 목록, 사진 조회, AI 보정 모니터링, 전송 상태</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mx-auto mb-4">
          <FolderOpen className="w-8 h-8 text-teal-500/40" />
        </div>
        <h3 className="font-bold text-gray-700 mb-1">사진 관리 기능 준비 중</h3>
        <p className="text-xs text-gray-400">Java Backend + Bubble Workflow와 연동됩니다.</p>
        <div className="mt-4 text-xs text-gray-400">
          <p>Java: <span className="font-bold text-gray-600">folder-detail, folder-photos, folder-status, transfer-photo</span></p>
          <p className="mt-1">Bubble: <span className="font-bold text-gray-600">ai-folder (Workflow), ai-trigger (Workflow)</span></p>
          <p className="mt-1">저장소: AWS S3 (cheiz-public-images-prod)</p>
        </div>
      </div>
    </div>
  );
}
