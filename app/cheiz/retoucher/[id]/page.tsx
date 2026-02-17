"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Star, Camera, Award, Clock, ChevronRight,
  Palette,
} from "lucide-react";

// ━━━ 리터쳐 데이터 (추후 API로 동적 로드 가능) ━━━
const RETOUCHERS: Record<number, {
  id: number;
  name: string;
  title: string;
  avatar: string;
  coverImage: string;
  description: string;
  longDescription: string;
  specialties: string[];
  rating: number;
  reviewCount: number;
  completedCount: number;
  avgDeliveryDays: number;
  pricePerPhoto: number;
  beforeAfterSamples: { before: string; after: string; caption: string }[];
}> = {
  7: {
    id: 7,
    name: "박환",
    title: "CHEIZ 전속 리터쳐",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80",
    coverImage: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=800&q=80",
    description: "10년 경력의 전문 리터칭 작가. 자연스러운 피부 보정과 톤 교정이 강점입니다.",
    longDescription: "사진 한 장에 담긴 순간의 감정을 가장 아름답게 살리는 것이 제 일입니다. 10년간 2만 장 이상의 인물 사진을 리터칭하며 얻은 노하우로, 자연스러우면서도 드라마틱한 결과물을 만들어 드립니다. 피부 톤 보정, 색감 교정, 배경 정리까지 꼼꼼하게 작업합니다.",
    specialties: ["피부 보정", "컬러 그레이딩", "배경 정리", "라이팅 보정"],
    rating: 4.9,
    reviewCount: 312,
    completedCount: 2847,
    avgDeliveryDays: 3,
    pricePerPhoto: 15000,
    beforeAfterSamples: [
      {
        before: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&q=80",
        after: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&q=80",
        caption: "자연광 인물 보정",
      },
      {
        before: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&q=80",
        after: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=600&q=80",
        caption: "스튜디오 컬러 그레이딩",
      },
      {
        before: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&q=80",
        after: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&q=80",
        caption: "아웃도어 톤 교정",
      },
    ],
  },
};

export default function RetoucherPage() {
  const router = useRouter();
  const params = useParams();
  const retoucherId = Number(params?.id);
  const retoucher = RETOUCHERS[retoucherId];

  // ━━━ Before/After 슬라이더 ━━━
  const [baIndex, setBaIndex] = useState(0);
  const [sliderPos, setSliderPos] = useState(50); // % 위치
  const sliderRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // 슬라이더 드래그 핸들러
  const handleSliderMove = (clientX: number) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(pct);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current) handleSliderMove(e.clientX);
    };
    const handleMouseUp = () => { isDragging.current = false; };
    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging.current && e.touches[0]) handleSliderMove(e.touches[0].clientX);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, []);

  if (!retoucher) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl mb-4">🎨</p>
          <p className="text-gray-500">작가 정보를 찾을 수 없습니다.</p>
          <button onClick={() => router.back()} className="mt-4 text-[#0055FF] font-bold text-sm">돌아가기</button>
        </div>
      </div>
    );
  }

  const currentSample = retoucher.beforeAfterSamples[baIndex];

  return (
    <div className="min-h-screen bg-[#FAFAF8] pb-24">
      {/* ━━━ 커버 이미지 + 오버레이 헤더 ━━━ */}
      <div className="relative h-56 bg-gray-200">
        <img src={retoucher.coverImage} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* 뒤로가기 */}
        <button onClick={() => router.back()}
          className="absolute top-[env(safe-area-inset-top)] left-4 mt-3 p-2 rounded-xl bg-black/30 backdrop-blur-sm active:scale-95">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        {/* 프로필 정보 오버레이 */}
        <div className="absolute bottom-4 left-5 right-5 flex items-end gap-4">
          <img src={retoucher.avatar} alt={retoucher.name}
            className="w-16 h-16 rounded-2xl object-cover border-3 border-white shadow-xl" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-xl font-extrabold text-white">{retoucher.name} 작가</h1>
              <span className="text-[10px] font-bold bg-amber-400 text-amber-900 px-2 py-0.5 rounded-full">전속</span>
            </div>
            <p className="text-white/70 text-xs">{retoucher.title}</p>
          </div>
        </div>
      </div>

      {/* ━━━ 통계 카드 ━━━ */}
      <div className="max-w-md mx-auto px-5 -mt-3 relative z-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 grid grid-cols-4 gap-2">
          <div className="text-center">
            <div className="flex items-center justify-center gap-0.5 text-amber-500 mb-0.5">
              <Star className="w-3.5 h-3.5 fill-current" />
              <span className="text-sm font-extrabold">{retoucher.rating}</span>
            </div>
            <p className="text-[10px] text-gray-400">평점</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-extrabold text-gray-900">{retoucher.reviewCount}</p>
            <p className="text-[10px] text-gray-400">리뷰</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-extrabold text-gray-900">{retoucher.completedCount.toLocaleString()}</p>
            <p className="text-[10px] text-gray-400">완료</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-extrabold text-gray-900">{retoucher.avgDeliveryDays}일</p>
            <p className="text-[10px] text-gray-400">평균 납기</p>
          </div>
        </motion.div>
      </div>

      {/* ━━━ 소개 ━━━ */}
      <div className="max-w-md mx-auto px-5 pt-5">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">작가 소개</p>
          <p className="text-sm text-gray-600 leading-relaxed">{retoucher.longDescription}</p>

          {/* 전문 분야 */}
          <div className="flex flex-wrap gap-2 mt-4">
            {retoucher.specialties.map(s => (
              <span key={s} className="text-[11px] font-bold px-3 py-1 rounded-full bg-[#0055FF]/5 text-[#0055FF] border border-[#0055FF]/10">
                {s}
              </span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ━━━ Before/After 인터랙티브 슬라이더 ━━━ */}
      <div className="max-w-md mx-auto px-5 pt-5">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Before / After 비교</p>
            <div className="flex gap-1.5">
              {retoucher.beforeAfterSamples.map((_, i) => (
                <button key={i} onClick={() => { setBaIndex(i); setSliderPos(50); }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    baIndex === i ? "bg-[#0055FF] text-white" : "bg-gray-100 text-gray-400"
                  }`}>
                  {i + 1}
                </button>
              ))}
            </div>
          </div>

          {/* ✅ 인터랙티브 Before/After 슬라이더 */}
          <div className="px-5 pb-3">
            <p className="text-xs text-gray-500 text-center mb-2">{currentSample.caption}</p>
          </div>
          <div
            ref={sliderRef}
            className="relative aspect-[3/4] mx-5 mb-5 rounded-xl overflow-hidden cursor-ew-resize select-none"
            onMouseDown={() => { isDragging.current = true; }}
            onTouchStart={() => { isDragging.current = true; }}
          >
            {/* After (전체) */}
            <img src={currentSample.after} alt="After" className="absolute inset-0 w-full h-full object-cover" />

            {/* Before (clip-path로 잘림) */}
            <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}>
              <img src={currentSample.before} alt="Before" className="absolute inset-0 w-full h-full object-cover" />
            </div>

            {/* 슬라이더 라인 + 핸들 */}
            <div className="absolute top-0 bottom-0" style={{ left: `${sliderPos}%` }}>
              <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md -translate-x-1/2" />
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center border-2 border-gray-200">
                <div className="flex gap-0.5">
                  <ChevronRight className="w-3 h-3 text-gray-400 rotate-180" />
                  <ChevronRight className="w-3 h-3 text-gray-400" />
                </div>
              </div>
            </div>

            {/* 라벨 */}
            <span className="absolute top-3 left-3 bg-black/60 text-white text-[9px] font-bold px-2 py-0.5 rounded-md">BEFORE</span>
            <span className="absolute top-3 right-3 bg-amber-500/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-md">AFTER</span>
          </div>
        </motion.div>
      </div>

      {/* ━━━ 가격 카드 ━━━ */}
      <div className="max-w-md mx-auto px-5 pt-5">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-2xl border border-amber-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">리터칭 비용</p>
              <p className="text-2xl font-extrabold text-gray-900">
                {retoucher.pricePerPhoto.toLocaleString()}<span className="text-base font-normal text-gray-500">원 / 장</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center">
              <Palette className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>평균 {retoucher.avgDeliveryDays}일 이내 완료</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Camera className="w-3.5 h-3.5 text-amber-500" />
              <span>피부 보정 + 컬러 그레이딩 + 배경 정리 포함</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Award className="w-3.5 h-3.5 text-amber-500" />
              <span>만족 보장 — 1회 무료 수정</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ━━━ 하단 CTA ━━━ */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-md mx-auto px-5 py-3">
          <button onClick={() => router.back()}
            className="w-full h-12 bg-[#0055FF] text-white text-sm font-bold rounded-xl active:scale-[0.98] transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2">
            <Palette className="w-4 h-4" /> 사진 선택하러 가기
          </button>
        </div>
      </div>
    </div>
  );
}
