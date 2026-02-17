"use client";

/**
 * TourSection — 추천 투어 가로 스크롤 컴포넌트
 *
 * 카드 구성 (깔끔하게):
 * - 썸네일 이미지
 * - 투어 제목 (강조)
 * - 장소 (location/locationDetail 조합, 예: 교토 / 아라시야마)
 * - 가격 (예: 1,000원/장)
 *
 * 제거된 항목:
 * - 회사명 (株式会社LIFESHOT)
 * - 위도/경도 좌표
 * - 날짜 범위 (2025...~2099...)
 * - "자세히 보기" 버튼
 */

import { motion } from "framer-motion";
import { MapPin, Calendar } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { TourDetail } from "@/lib/tour-api";

// ==================== Props ====================

export type TourSectionProps = {
  tours: TourDetail[];
  loading?: boolean;
  locale?: string;
};

// ==================== Skeleton ====================

function TourCardSkeleton() {
  return (
    <div className="flex-shrink-0 w-[220px] bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 animate-pulse">
      <div className="w-full aspect-[4/3] bg-gray-200" />
      <div className="p-3 space-y-2">
        <div className="h-4 w-3/4 bg-gray-200 rounded-full" />
        <div className="h-3 w-1/2 bg-gray-100 rounded-full" />
        <div className="h-3 w-1/3 bg-gray-100 rounded-full" />
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex gap-3 overflow-hidden pb-1 -mx-4 px-4">
      <TourCardSkeleton />
      <TourCardSkeleton />
      <TourCardSkeleton />
    </div>
  );
}

// ==================== Empty State ====================

function EmptyState() {
  return (
    <div className="bg-gray-50 rounded-2xl p-8 text-center">
      <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-[#0055FF]/10 flex items-center justify-center">
        <Calendar className="w-7 h-7 text-[#0055FF]/40" />
      </div>
      <p className="text-sm font-medium text-gray-700 mb-1">
        현재 예약 가능한 투어가 없습니다
      </p>
      <p className="text-xs text-gray-400">
        새로운 투어가 오픈되면 여기에 표시됩니다
      </p>
    </div>
  );
}

// ==================== Tour Card ====================

function TourCard({
  tour,
  locale,
  index,
}: {
  tour: TourDetail;
  locale: string;
  index: number;
}) {
  const thumbnailUrl =
    tour.thumbnailImageUrl ||
    (tour.images?.length > 0 ? tour.images[0]?.imageUrl : null);

  // 장소: location / locationDetail 조합 (예: "교토 / 아라시야마")
  const locationLabel = [tour.location, tour.locationDetail]
    .filter(Boolean)
    .join(" / ");

  // 기본 단가: 백엔드에 가격 데이터가 없을 경우 1,000원/장 적용
  const DEFAULT_PRICE_PER_PHOTO = 1000;
  const priceValue = tour.pricePerPhoto || tour.price || DEFAULT_PRICE_PER_PHOTO;
  const currency = tour.currency || "KRW";

  function fmtPrice(val: number, cur: string) {
    if (cur === "KRW") return `${val.toLocaleString()}원/장`;
    if (cur === "JPY") return `¥${val.toLocaleString()}/장`;
    return `$${val.toLocaleString()}/장`;
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.07, 0.35), duration: 0.4 }}
      className="flex-shrink-0 snap-start"
    >
      <Link
        href={`/${locale}/tours/${tour.id}`}
        className="block w-[220px] bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100
                   hover:shadow-md transition-all duration-300 group"
      >
        {/* Thumbnail */}
        <div className="relative w-full aspect-[4/3] bg-gray-100 overflow-hidden">
          {thumbnailUrl ? (
            <Image
              src={thumbnailUrl}
              alt={tour.name || "투어"}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              quality={60}
              sizes="220px"
              priority={index < 3}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100">
              <Calendar className="w-8 h-8 text-gray-300" />
            </div>
          )}

          {tour.isClosed && (
            <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              마감
            </div>
          )}
        </div>

        {/* Content — 제목 + 장소 + 가격만 */}
        <div className="p-3">
          <h3 className="font-bold text-[#1A1A1A] text-sm leading-snug mb-1.5 line-clamp-2 group-hover:text-[#0055FF] transition-colors">
            {tour.name}
          </h3>

          {locationLabel && (
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
              <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
              <span className="truncate">{locationLabel}</span>
            </div>
          )}

          <p className="text-sm font-bold text-[#0055FF]">
            {fmtPrice(priceValue, currency)}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}

// ==================== Main Component ====================

export default function TourSection({
  tours,
  loading = false,
  locale = "ko",
}: TourSectionProps) {
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-[#1A1A1A] flex items-center gap-2">
          <div className="w-1 h-5 bg-[#0055FF] rounded-full" />
          추천 투어
        </h2>
        {tours.length > 0 && !loading && (
          <span className="text-xs text-gray-400">
            {tours.filter((t) => !t.isClosed).length}개 예약 가능
          </span>
        )}
      </div>

      {loading ? (
        <SkeletonRow />
      ) : tours.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory no-scrollbar">
          {tours.map((tour, index) => (
            <TourCard
              key={tour.id}
              tour={tour}
              locale={locale}
              index={index}
            />
          ))}
        </div>
      )}

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </section>
  );
}
