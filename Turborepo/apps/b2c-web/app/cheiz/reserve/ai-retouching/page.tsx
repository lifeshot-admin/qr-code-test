"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useState, Suspense } from "react";
import { Sparkles, Camera, Star } from "lucide-react";
import {
  ReactCompareSlider,
  ReactCompareSliderImage,
  ReactCompareSliderHandle,
} from "react-compare-slider";
import { useReservationStore } from "@/lib/reservation-store";
import { useHasMounted } from "@/lib/use-has-mounted";

/**
 * AI 보정 Before/After 인터랙티브 페이지
 *
 * 사용자가 AI 보정 옵션을 선택하거나 건너뛸 수 있는 페이지.
 * react-compare-slider를 사용한 이미지 비교 슬라이더 제공.
 */
function AIRetouchingContent() {
  const hasMounted = useHasMounted();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tourIdParam = searchParams.get("tour_id");
  const folderIdParam = searchParams.get("folder_id");

  const { setAiRetouching, tourId, folderId } = useReservationStore();
  const [selected, setSelected] = useState<boolean | null>(null);

  const AI_PRICE = 4980;

  const safeTourId = tourIdParam || (hasMounted ? tourId : null);
  const safeFolderId = folderIdParam || (hasMounted ? folderId : null);

  const goToCheckout = (withAI: boolean) => {
    setAiRetouching(withAI);
    setSelected(withAI);
    // 짧은 딜레이 후 이동 (선택 피드백 확인)
    setTimeout(() => {
      let checkoutUrl = `/cheiz/reserve/checkout?tour_id=${safeTourId}`;
      if (safeFolderId) checkoutUrl += `&folder_id=${safeFolderId}`;
      router.push(checkoutUrl);
    }, 300);
  };

  // 더미 Before/After 이미지 (실제 이미지로 교체 가능)
  const BEFORE_IMG =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='800' viewBox='0 0 600 800'%3E%3Crect fill='%234a5568' width='600' height='800'/%3E%3Ctext x='50%25' y='35%25' text-anchor='middle' dy='.3em' fill='%23718096' font-size='24' font-family='sans-serif'%3EBefore%3C/text%3E%3Ccircle cx='300' cy='380' r='80' fill='%23718096'/%3E%3Ccircle cx='270' cy='360' r='8' fill='%234a5568'/%3E%3Ccircle cx='330' cy='360' r='8' fill='%234a5568'/%3E%3Cpath d='M275 400 Q300 420 325 400' stroke='%234a5568' stroke-width='3' fill='none'/%3E%3Crect x='200' y='500' width='200' height='150' rx='20' fill='%23718096'/%3E%3Ctext x='50%25' y='90%25' text-anchor='middle' dy='.3em' fill='%23a0aec0' font-size='14' font-family='sans-serif'%3E%EC%9B%90%EB%B3%B8 %EC%82%AC%EC%A7%84%3C/text%3E%3C/svg%3E";
  const AFTER_IMG =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='800' viewBox='0 0 600 800'%3E%3Cdefs%3E%3ClinearGradient id='bg' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%23667eea'/%3E%3Cstop offset='100%25' stop-color='%23764ba2'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23bg)' width='600' height='800'/%3E%3Ctext x='50%25' y='35%25' text-anchor='middle' dy='.3em' fill='%23e2e8f0' font-size='24' font-family='sans-serif'%3EAfter (AI)%3C/text%3E%3Ccircle cx='300' cy='380' r='80' fill='%23e2e8f0'/%3E%3Ccircle cx='270' cy='360' r='8' fill='%23667eea'/%3E%3Ccircle cx='330' cy='360' r='8' fill='%23667eea'/%3E%3Cpath d='M275 400 Q300 420 325 400' stroke='%23667eea' stroke-width='3' fill='none'/%3E%3Crect x='200' y='500' width='200' height='150' rx='20' fill='%23e2e8f0'/%3E%3Ctext x='50%25' y='90%25' text-anchor='middle' dy='.3em' fill='white' font-size='14' font-family='sans-serif'%3EAI %EB%B3%B4%EC%A0%95 %EC%82%AC%EC%A7%84%3C/text%3E%3C/svg%3E";

  return (
    <div className="min-h-screen bg-[#FFF9F5] pb-44">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-orange-100/50">
        <div className="max-w-md mx-auto px-5 py-3 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="text-gray-500 hover:text-cheiz-primary transition-colors text-sm flex items-center gap-1"
          >
            <span className="text-lg">&#8249;</span> 돌아가기
          </button>
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-1.5 rounded-full bg-cheiz-primary/30" />
            <div className="w-8 h-1.5 rounded-full bg-cheiz-primary" />
            <div className="w-8 h-1.5 rounded-full bg-gray-200" />
          </div>
          <span className="text-sm font-bold text-gray-500">AI 보정</span>
        </div>
      </div>

      {/* Title */}
      <div className="max-w-md mx-auto px-5 pt-8 pb-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-[#FF4B2B]" />
            <p className="text-sm font-medium text-[#FF4B2B] tracking-wider uppercase">
              Step 2 of 3
            </p>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2 leading-tight">
            AI가 완성하는<br />화보 급 보정 서비스
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            슬라이더를 좌우로 움직여 보정 전후를 비교해보세요!
          </p>
        </motion.div>
      </div>

      {/* Before/After Slider */}
      <div className="max-w-md mx-auto px-5 py-2">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="rounded-3xl overflow-hidden shadow-xl border-4 border-white"
        >
          <ReactCompareSlider
            itemOne={
              <ReactCompareSliderImage
                src={BEFORE_IMG}
                alt="Before"
              />
            }
            itemTwo={
              <ReactCompareSliderImage
                src={AFTER_IMG}
                alt="After (AI)"
              />
            }
            handle={
              <ReactCompareSliderHandle
                buttonStyle={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  border: "3px solid white",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                  backgroundColor: "var(--cheiz-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                linesStyle={{
                  width: 3,
                  color: "white",
                }}
              />
            }
            position={50}
            style={{ height: 420 }}
          />

          {/* Labels */}
          <div className="flex justify-between px-4 py-3 bg-white/90 backdrop-blur-sm">
            <span className="text-xs font-medium text-gray-500 flex items-center gap-1">
              <Camera className="w-3.5 h-3.5" /> 원본
            </span>
            <span className="text-xs font-medium text-cheiz-primary flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> AI 보정
            </span>
          </div>
        </motion.div>
      </div>

      {/* Features */}
      <div className="max-w-md mx-auto px-5 py-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex gap-3"
        >
          {[
            { icon: "🎨", label: "피부 보정" },
            { icon: "🌅", label: "색감 보정" },
            { icon: "✨", label: "배경 보정" },
          ].map((feat) => (
            <div
              key={feat.label}
              className="flex-1 bg-white rounded-2xl p-3 text-center shadow-sm border border-gray-100/80"
            >
              <div className="text-2xl mb-1">{feat.icon}</div>
              <p className="text-xs font-medium text-gray-700">{feat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Price Card */}
      <div className="max-w-md mx-auto px-5 py-2">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gradient-to-r from-cheiz-primary/5 to-purple-50 rounded-2xl p-5 border border-cheiz-primary/10"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-0.5">AI 보정 서비스</p>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400"
                  />
                ))}
                <span className="text-xs text-gray-400 ml-1">4.9 (128)</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-cheiz-primary">
                {AI_PRICE.toLocaleString()}
                <span className="text-sm font-normal text-gray-500">원</span>
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Fixed Bottom Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 z-50">
        <div className="max-w-md mx-auto px-5 py-4 space-y-3">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => goToCheckout(true)}
            className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all ${
              selected === true
                ? "bg-cheiz-primary text-white shadow-lg shadow-cheiz-primary/25 ring-2 ring-cheiz-primary/50"
                : "bg-cheiz-primary text-white shadow-lg shadow-cheiz-primary/25"
            }`}
          >
            <Sparkles className="w-5 h-5" />
            예, 보정 추가 (+{AI_PRICE.toLocaleString()}원)
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => goToCheckout(false)}
            className={`w-full py-3.5 rounded-2xl font-medium text-sm transition-all ${
              selected === false
                ? "border-2 border-gray-400 text-gray-600 bg-gray-50"
                : "border border-gray-300 text-gray-500 bg-transparent hover:bg-gray-50"
            }`}
          >
            아니오, 원본만 받을래요
          </motion.button>
        </div>
      </div>
    </div>
  );
}

export default function AIRetouchingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FFF9F5] flex items-center justify-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-cheiz-primary border-solid" />
        </div>
      }
    >
      <AIRetouchingContent />
    </Suspense>
  );
}
