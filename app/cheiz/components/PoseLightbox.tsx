"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Check } from "lucide-react";
import Image from "next/image";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import "swiper/css/pagination";

function normalizeImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

type Pose = {
  _id: string;
  image?: string;
  persona?: string;
  spot_Id?: number;
  tour_Id?: number;
};

type PoseLightboxProps = {
  poses: Pose[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
  isPoseSelected: (poseId: string) => boolean;
  onToggleSelect: (poseId: string) => void;
};

export default function PoseLightbox({
  poses,
  initialIndex,
  isOpen,
  onClose,
  isPoseSelected,
  onToggleSelect,
}: PoseLightboxProps) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const swiperRef = useRef<SwiperType | null>(null);

  useEffect(() => {
    setActiveIndex(initialIndex);
    if (swiperRef.current && isOpen) {
      swiperRef.current.slideTo(initialIndex, 0);
    }
  }, [initialIndex, isOpen]);

  // Escape key to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  const currentPose = poses[activeIndex];
  const isSelected = currentPose ? isPoseSelected(currentPose._id) : false;

  const handleSelect = useCallback(() => {
    if (currentPose) {
      onToggleSelect(currentPose._id);
    }
  }, [currentPose, onToggleSelect]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/95 z-[200] flex flex-col"
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <span className="text-sm font-medium text-white/70">
              {activeIndex + 1} / {poses.length}
            </span>
            {currentPose?.persona && (
              <span className="text-xs bg-white/20 text-white px-3 py-1 rounded-full">
                {currentPose.persona}
              </span>
            )}
          </div>

          {/* Swiper Area */}
          <div className="flex-1 relative flex items-center">
            <Swiper
              modules={[Navigation, Pagination]}
              initialSlide={initialIndex}
              onSwiper={(swiper) => {
                swiperRef.current = swiper;
              }}
              onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
              spaceBetween={0}
              slidesPerView={1}
              className="w-full h-full"
            >
              {poses.map((pose) => (
                <SwiperSlide key={pose._id} className="flex items-center justify-center">
                  <div className="relative w-full h-full flex items-center justify-center px-4">
                    {pose.image ? (
                      <img
                        src={normalizeImageUrl(pose.image) || ""}
                        alt={`Pose ${pose._id}`}
                        className="max-w-full max-h-[70vh] object-contain rounded-2xl"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-64 h-64 bg-gray-800 rounded-2xl flex items-center justify-center text-gray-500">
                        이미지 없음
                      </div>
                    )}
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>

            {/* Arrow Buttons (Desktop) */}
            {activeIndex > 0 && (
              <button
                onClick={() => swiperRef.current?.slidePrev()}
                className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            {activeIndex < poses.length - 1 && (
              <button
                onClick={() => swiperRef.current?.slideNext()}
                className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Dot Indicator */}
          <div className="flex justify-center gap-1.5 py-3">
            {poses.length <= 12 && poses.map((_, idx) => (
              <div
                key={idx}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === activeIndex ? "bg-white w-6" : "bg-white/30"
                }`}
              />
            ))}
            {poses.length > 12 && (
              <span className="text-white/50 text-xs">
                좌우로 스와이프하세요
              </span>
            )}
          </div>

          {/* Bottom Action */}
          <div className="px-5 pb-8 pt-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSelect}
              className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all ${
                isSelected
                  ? "bg-white text-[#0055FF] shadow-lg"
                  : "bg-[#0055FF] text-white shadow-lg shadow-blue-500/30"
              }`}
            >
              {isSelected ? (
                <>
                  <Check className="w-5 h-5" />
                  선택 해제하기
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  포즈 선택하기
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
