"use client";

import Link from "next/link";
import { Image, Star, Gift, Palette, ArrowRight } from "lucide-react";

const CONTENT_SECTIONS = [
  {
    title: "홈 배너 관리",
    description: "메인 페이지 슬라이더 배너 이미지, 제목, 순서, 노출 여부 관리",
    icon: Image,
    color: "bg-cheiz-primary",
    href: "/admin/content/banners",
    status: "CRUD 구현 완료",
    statusColor: "text-green-600 bg-green-50",
  },
  {
    title: "이벤트 & 미션 관리",
    description: "리워드 이벤트 생성/수정, 크레딧 지급 설정, 활성/비활성 토글",
    icon: Gift,
    color: "bg-green-500",
    href: "/admin/content/events",
    status: "CRUD 구현 완료",
    statusColor: "text-green-600 bg-green-50",
  },
  {
    title: "리뷰 관리",
    description: "사용자 리뷰 승인/비승인, 삭제, 이미지 확인",
    icon: Star,
    color: "bg-cheiz-primary",
    href: "/admin/content/reviews",
    status: "R/U/D 구현 완료",
    statusColor: "text-green-600 bg-green-50",
  },
  {
    title: "리터처 프로필 관리",
    description: "리터처 등록/수정, Before/After 샘플 관리, 가격 설정",
    icon: Palette,
    color: "bg-amber-500",
    href: "#",
    status: "Java Backend 테이블 확장 필요",
    statusColor: "text-amber-600 bg-amber-50",
  },
];

export default function ContentManagement() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900">콘텐츠 관리</h2>
        <p className="text-sm text-gray-400 mt-1">
          서비스에 노출되는 콘텐츠를 중앙에서 관리합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CONTENT_SECTIONS.map((section) => {
          const Icon = section.icon;
          const isActive = section.href !== "#";
          const Wrapper = isActive ? Link : "div";
          return (
            <Wrapper
              key={section.title}
              href={section.href}
              className={`bg-white rounded-2xl border border-gray-100 p-5 transition-all ${isActive ? "hover:shadow-md hover:border-gray-200 cursor-pointer group" : "opacity-75"}`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${section.color} flex-shrink-0`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-gray-900 text-sm">{section.title}</h3>
                    {isActive && (
                      <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-cheiz-primary transition-colors" />
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mb-3 leading-relaxed">{section.description}</p>
                  <span className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full ${section.statusColor}`}>
                    {section.status}
                  </span>
                </div>
              </div>
            </Wrapper>
          );
        })}
      </div>

      {/* 하드코딩 이전 상태 안내 */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50/30 rounded-2xl border border-green-200/50 p-5">
        <h3 className="font-bold text-green-800 text-sm mb-3">Bubble DB 연동 현황</h3>
        <div className="space-y-2 text-xs text-green-700">
          <div className="flex items-start gap-2">
            <span className="text-green-500">&#10003;</span>
            <span><code className="bg-green-100 px-1.5 py-0.5 rounded text-[10px]">reward_event</code> 테이블 — 이벤트 CRUD API 완성</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-500">&#10003;</span>
            <span><code className="bg-green-100 px-1.5 py-0.5 rounded text-[10px]">home_banner</code> 테이블 — 배너 CRUD API 완성</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-500">&#10003;</span>
            <span><code className="bg-green-100 px-1.5 py-0.5 rounded text-[10px]">review</code> 테이블 — 리뷰 R/U/D API 완성</span>
          </div>
        </div>
        <p className="text-[10px] text-green-500 mt-3">
          * Bubble DB에 reward_event, home_banner 테이블을 생성한 후 관리 페이지에서 데이터 등록 가능
        </p>
      </div>
    </div>
  );
}
