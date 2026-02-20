"use client";

import { useState, useEffect, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft, Brush, Star, ChevronRight, Loader2,
  XCircle, Sparkles, Camera, Clock, Award,
} from "lucide-react";

// ━━━ 폴백 데이터 (API 실패 시) ━━━
const FALLBACK = {
  id: 7, name: "박환", title: "CHEIZ 전속 리터쳐",
  avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80",
  description: "10년 경력의 전문 리터칭 작가. 자연스러운 피부 보정과 톤 교정이 강점입니다.",
  rating: 4.9, reviewCount: 312, completedCount: 2847,
  avgDeliveryDays: 3, pricePerPhoto: 15000,
  specialties: ["피부 보정", "컬러 그레이딩", "배경 정리"],
};

function RetoucherSelectContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const folderId = params?.folderId as string;
  const photoIds = searchParams.get("photos") || "";

  const [retoucher, setRetoucher] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showDetail, setShowDetail] = useState(false);

  const N = photoIds.split(",").filter(Boolean).length;

  // ━━━ 리터쳐 API 로드 ━━━
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        console.log("[RETOUCHER_SELECT] 리터쳐 API 호출...");
        const res = await fetch("/api/backend/retouchers");
        const data = await res.json();
        console.log("[RETOUCHER_SELECT] 응답:", JSON.stringify(data).substring(0, 500));

        if (data.success && data.retoucher) {
          console.log("[RETOUCHER_SELECT] ID 7 확보:", data.retoucher.name, "단가:", data.retoucher.pricePerPhoto);
          setRetoucher(data.retoucher);
        } else {
          console.warn("[RETOUCHER_SELECT] ID 7 없음 — 폴백 사용");
          setRetoucher(FALLBACK);
        }
      } catch (e: any) {
        console.error("[RETOUCHER_SELECT] 에러:", e.message);
        setRetoucher(FALLBACK);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const goToRetouchSelect = () => {
    router.push(`/cheiz/folder/${folderId}/retouch?photos=${photoIds}&retoucherId=${retoucher?.id || 7}`);
  };

  const skipRetouch = () => {
    router.push(`/cheiz/folder/${folderId}/redeem?photos=${photoIds}&retouchPhotos=&retoucherId=`);
  };

  const r = retoucher || FALLBACK;

  return (
    <div className="min-h-screen bg-[#FAFAF8] pb-10">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-md mx-auto px-5 py-3 flex items-center justify-between">
          <button onClick={() => router.back()} className="text-gray-500 text-sm flex items-center gap-1 active:scale-95">
            <ArrowLeft className="w-4 h-4" /> 뒤로
          </button>
          <h1 className="text-sm font-bold text-gray-900">보정 옵션</h1>
          <span className="text-xs font-bold text-cheiz-primary bg-cheiz-primary/10 px-2 py-0.5 rounded-full">{N}장</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-cheiz-primary animate-spin" />
        </div>
      ) : (
        <div className="max-w-md mx-auto px-5 pt-6 space-y-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="text-center mb-2">
            <p className="text-lg font-bold text-gray-900">보정 옵션을 선택하세요</p>
            <p className="text-xs text-gray-400 mt-1">전문 작가의 디테일 보정으로 사진을 더 아름답게</p>
          </motion.div>

          {/* ━━━ 카드 1: 박환 작가 ━━━ */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <img src={r.avatar || FALLBACK.avatar} alt={r.name}
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-amber-200 shadow-sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-base font-bold text-gray-900">{r.name || "박환"} 작가</p>
                    <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">전속</span>
                  </div>
                  <p className="text-[11px] text-gray-400">{r.title || FALLBACK.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-0.5">
                      <Star className="w-3 h-3 text-amber-500 fill-current" />
                      <span className="text-xs font-bold text-amber-600">{r.rating || 4.9}</span>
                    </div>
                    <span className="text-[10px] text-gray-300">|</span>
                    <span className="text-[10px] text-gray-400">{(r.reviewCount || 312)}건 리뷰</span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-500 leading-relaxed mb-4">
                {r.description || FALLBACK.description}
              </p>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-amber-50 rounded-xl p-2 text-center">
                  <Camera className="w-3.5 h-3.5 text-amber-500 mx-auto mb-0.5" />
                  <p className="text-[10px] font-bold text-gray-700">{(r.completedCount || 2847).toLocaleString()}</p>
                  <p className="text-[8px] text-gray-400">완료</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-2 text-center">
                  <Clock className="w-3.5 h-3.5 text-amber-500 mx-auto mb-0.5" />
                  <p className="text-[10px] font-bold text-gray-700">{r.avgDeliveryDays || 3}일</p>
                  <p className="text-[8px] text-gray-400">평균 납기</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-2 text-center">
                  <Award className="w-3.5 h-3.5 text-amber-500 mx-auto mb-0.5" />
                  <p className="text-[10px] font-bold text-gray-700">무료수정</p>
                  <p className="text-[8px] text-gray-400">1회</p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-3 flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] text-amber-600 font-medium">리터칭 비용</p>
                  <p className="text-lg font-extrabold text-gray-900">
                    {(r.pricePerPhoto || 15000).toLocaleString()}
                    <span className="text-xs font-normal text-gray-400">원/장</span>
                  </p>
                </div>
                <Sparkles className="w-6 h-6 text-amber-400" />
              </div>

              <div className="flex gap-2">
                <button onClick={() => router.push(`/cheiz/retoucher/${r.id || 7}`)}
                  className="flex-1 h-11 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-xs font-bold active:scale-[0.97] transition-all flex items-center justify-center gap-1">
                  자세히 보기 <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button onClick={goToRetouchSelect}
                  className="flex-1 h-11 rounded-xl bg-amber-500 text-white text-xs font-bold active:scale-[0.97] transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1">
                  <Brush className="w-3.5 h-3.5" /> 의뢰하기
                </button>
              </div>
            </div>
          </motion.div>

          {/* ━━━ 카드 2: 보정 안 함 ━━━ */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            onClick={skipRetouch}
            className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 cursor-pointer hover:bg-gray-50 active:scale-[0.98] transition-all">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <XCircle className="w-7 h-7 text-gray-300" />
              </div>
              <div className="flex-1">
                <p className="text-base font-bold text-gray-700">디테일 보정 안 할래요</p>
                <p className="text-xs text-gray-400 mt-0.5">원본 사진만 다운로드합니다</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300" />
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default function RetoucherSelectPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-3 border-cheiz-primary border-solid" />
      </div>
    }>
      <RetoucherSelectContent />
    </Suspense>
  );
}
