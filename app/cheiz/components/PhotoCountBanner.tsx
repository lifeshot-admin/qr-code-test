"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Camera, Sparkles } from "lucide-react";

interface PhotoCountBannerProps {
  tourId?: number | string;
}

/**
 * 사진 장수 통계 배너
 *
 * tourId가 주어지면 해당 투어의 사진 수만 가져오고,
 * 없으면 전체 합계를 가져옴.
 *
 * 투어 상세 페이지: "어제는 이 투어에서 총 X장의 인생샷이 탄생했어요!"
 */
export default function PhotoCountBanner({ tourId }: PhotoCountBannerProps) {
  const [totalPhotos, setTotalPhotos] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const params = tourId ? `?tourId=${tourId}` : "";
        const res = await fetch(`/api/bubble/photo-count${params}`);
        if (res.ok) {
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const data = await res.json();
            setTotalPhotos(data.totalPhotos || 0);
          }
        }
      } catch {
        // 조용히 실패 — 배너만 기본값 표시
      } finally {
        setLoading(false);
      }
    };
    fetchCount();
  }, [tourId]);

  if (loading) {
    return (
      <div className="h-14 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl animate-pulse" />
    );
  }

  const displayCount = totalPhotos > 0 ? totalPhotos : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden bg-gradient-to-r from-[#0055FF]/5 via-blue-50 to-indigo-50 rounded-2xl px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-gradient-to-br from-[#0055FF] to-indigo-500 rounded-xl flex items-center justify-center flex-shrink-0">
          <Camera className="w-4.5 h-4.5 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          {displayCount > 0 ? (
            <p className="text-sm font-bold text-gray-800 flex items-center gap-1 flex-wrap">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span>
                어제는 이 투어에서 총{" "}
                <span className="text-[#0055FF] text-base font-extrabold">
                  {displayCount.toLocaleString()}
                </span>
                장의 인생샷이 탄생했어요!
              </span>
            </p>
          ) : (
            <p className="text-sm font-bold text-gray-800 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              오늘도 멋진 인생샷을 찍어보세요!
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
