"use client";

import { motion } from "framer-motion";
import { Download, Sparkles, Brush, Calendar, Gift } from "lucide-react";

// ━━━ 크레딧 잔액 카드 (마이페이지 + 체크아웃 공용) ━━━
export function CreditBalanceCard({
  photo,
  ai,
  retouch,
  loading = false,
  compact = false,
  onAiToggle,
  aiApplied = false,
  aiRetouchingEnabled = false,
}: {
  photo: number;
  ai: number;
  retouch: number;
  loading?: boolean;
  compact?: boolean;
  onAiToggle?: () => void;
  aiApplied?: boolean;
  aiRetouchingEnabled?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3">
        <div className="w-4 h-4 rounded-full border-2 border-gray-200 border-t-cheiz-primary animate-spin" />
        <span className="text-sm text-gray-400">크레딧 잔액 조회 중...</span>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-3 gap-2 ${compact ? "" : "mb-4"}`}>
      {/* PHOTO */}
      <div className="bg-blue-50 rounded-xl p-3 text-center">
        <Download className="w-4 h-4 text-cheiz-primary mx-auto mb-1" />
        <p className="text-xl font-bold text-cheiz-primary">{photo}</p>
        <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">사진 다운로드</p>
      </div>

      {/* AI — 인라인 적용 버튼 통합 */}
      <div className="bg-cheiz-surface rounded-xl p-3 text-center relative">
        <Sparkles className="w-4 h-4 text-cheiz-primary mx-auto mb-1" />
        <p className="text-xl font-bold text-cheiz-primary">{ai}</p>
        <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">AI 리터칭</p>
        {aiRetouchingEnabled && ai > 0 && onAiToggle && (
          <button
            onClick={(e) => { e.stopPropagation(); onAiToggle(); }}
            className={`mt-1.5 w-full py-1 rounded-lg text-[10px] font-bold transition-all active:scale-95 ${
              aiApplied
                ? "bg-cheiz-primary text-white shadow-sm"
                : "bg-white border border-cheiz-border text-cheiz-primary"
            }`}
          >
            {aiApplied ? "적용 중" : "사용"}
          </button>
        )}
      </div>

      {/* RETOUCH */}
      <div className="bg-amber-50 rounded-xl p-3 text-center">
        <Brush className="w-4 h-4 text-amber-600 mx-auto mb-1" />
        <p className="text-xl font-bold text-amber-600">{retouch}</p>
        <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">리터칭</p>
      </div>
    </div>
  );
}

// ━━━ 쿠폰/기프트 카드 (마이페이지 쿠폰 탭 + 체크아웃 리스트 공용) ━━━
export function GiftCouponCard({
  name,
  description,
  expiresAt,
  photoCredits = 0,
  aiCredits = 0,
  retouchCredits = 0,
  actionLabel,
  onAction,
  loading = false,
  variant = "default",
}: {
  name: string;
  description?: string;
  expiresAt?: string | null;
  photoCredits?: number;
  aiCredits?: number;
  retouchCredits?: number;
  actionLabel?: string;
  onAction?: () => void;
  loading?: boolean;
  variant?: "default" | "compact";
}) {
  const totalCredits = photoCredits + aiCredits + retouchCredits;

  if (variant === "compact") {
    return (
      <div className="flex-shrink-0 w-52 bg-gradient-to-br from-white to-blue-50 border border-cheiz-primary/10 rounded-xl p-3.5 text-left hover:shadow-md hover:border-cheiz-primary/30 transition-all">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Gift className="w-3.5 h-3.5 text-cheiz-primary" />
          <p className="text-[10px] font-bold text-cheiz-primary truncate">{name}</p>
        </div>
        {description && <p className="text-[10px] text-gray-400 truncate mb-1.5">{description}</p>}

        {/* 크레딧 미니 뱃지 */}
        <div className="flex gap-1 mb-2 flex-wrap">
          {photoCredits > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-cheiz-primary bg-blue-50 px-1.5 py-0.5 rounded-md">
              <Download className="w-2.5 h-2.5" />{photoCredits}
            </span>
          )}
          {aiCredits > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-cheiz-primary bg-cheiz-surface px-1.5 py-0.5 rounded-md">
              <Sparkles className="w-2.5 h-2.5" />{aiCredits}
            </span>
          )}
          {retouchCredits > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">
              <Brush className="w-2.5 h-2.5" />{retouchCredits}
            </span>
          )}
        </div>

        {onAction && actionLabel && (
          <button
            onClick={(e) => { e.stopPropagation(); onAction(); }}
            disabled={loading}
            className="w-full py-1.5 bg-cheiz-primary text-white text-[10px] font-bold rounded-lg hover:bg-opacity-90 disabled:opacity-40 transition-all active:scale-95 flex items-center justify-center gap-1"
          >
            {loading ? "..." : actionLabel}
          </button>
        )}
      </div>
    );
  }

  // ━━━ default: 전체 카드 (마이페이지 쿠폰 리스트용) ━━━
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
    >
      {/* 상단 바 */}
      <div className="bg-gradient-to-r from-cheiz-primary to-[#3377FF] px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gift className="w-4 h-4 text-white/80" />
          <span className="text-white font-bold text-sm truncate">{name}</span>
        </div>
        {totalCredits > 0 && (
          <span className="text-white/80 text-xs font-medium">{totalCredits}건</span>
        )}
      </div>

      <div className="p-4">
        {description && (
          <p className="text-xs text-gray-500 mb-3 leading-relaxed">{description}</p>
        )}

        {/* 크레딧 상세 */}
        <div className="flex gap-2 mb-3">
          {photoCredits > 0 && (
            <div className="flex items-center gap-1.5 bg-blue-50 rounded-lg px-3 py-2">
              <Download className="w-3.5 h-3.5 text-cheiz-primary" />
              <span className="text-xs font-bold text-cheiz-primary">{photoCredits}</span>
              <span className="text-[10px] text-gray-500">사진</span>
            </div>
          )}
          {aiCredits > 0 && (
            <div className="flex items-center gap-1.5 bg-cheiz-surface rounded-lg px-3 py-2">
              <Sparkles className="w-3.5 h-3.5 text-cheiz-primary" />
              <span className="text-xs font-bold text-cheiz-primary">{aiCredits}</span>
              <span className="text-[10px] text-gray-500">AI</span>
            </div>
          )}
          {retouchCredits > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-50 rounded-lg px-3 py-2">
              <Brush className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-xs font-bold text-amber-600">{retouchCredits}</span>
              <span className="text-[10px] text-gray-500">리터칭</span>
            </div>
          )}
        </div>

        {/* 유효기간 */}
        {expiresAt && (
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mb-3">
            <Calendar className="w-3 h-3" />
            <span>유효기간: ~ {new Date(expiresAt).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })}</span>
          </div>
        )}

        {/* 액션 버튼 */}
        {onAction && actionLabel && (
          <button
            onClick={onAction}
            disabled={loading}
            className="w-full py-2.5 bg-cheiz-primary text-white text-sm font-bold rounded-xl hover:bg-opacity-90 disabled:opacity-40 transition-all active:scale-[0.98]"
          >
            {loading ? "처리 중..." : actionLabel}
          </button>
        )}
      </div>
    </motion.div>
  );
}
