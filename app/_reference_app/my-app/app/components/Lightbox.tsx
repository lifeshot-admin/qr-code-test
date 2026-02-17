"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Check } from "lucide-react";

interface Pose {
  id: string;
  image: string;
  category: string;
}

interface LightboxProps {
  isOpen: boolean;
  onClose: () => void;
  poses: Pose[];
  currentIndex: number;
  selectedIds: string[];
  onSelect: (id: string) => void;
  onIndexChange: (index: number) => void;
}

export default function Lightbox({
  isOpen,
  onClose,
  poses,
  currentIndex,
  selectedIds,
  onSelect,
  onIndexChange,
}: LightboxProps) {
  const [direction, setDirection] = useState(0);

  const currentPose = poses[currentIndex];
  const isSelected = currentPose ? selectedIds.includes(currentPose.id) : false;

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setDirection(-1);
      onIndexChange(currentIndex - 1);
    }
  }, [currentIndex, onIndexChange]);

  const handleNext = useCallback(() => {
    if (currentIndex < poses.length - 1) {
      setDirection(1);
      onIndexChange(currentIndex + 1);
    }
  }, [currentIndex, poses.length, onIndexChange]);

  const handleDragEnd = useCallback(
    (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const threshold = 50;
      if (info.offset.x > threshold && currentIndex > 0) {
        handlePrev();
      } else if (info.offset.x < -threshold && currentIndex < poses.length - 1) {
        handleNext();
      }
    },
    [currentIndex, poses.length, handlePrev, handleNext]
  );

  const handleImageClick = () => {
    if (currentPose) {
      onSelect(currentPose.id);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === " ") {
        e.preventDefault();
        handleImageClick();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handlePrev, handleNext, onClose]);

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
    }),
  };

  return (
    <AnimatePresence>
      {isOpen && currentPose && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/95 z-50 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="text-white/80 text-sm">
                {currentIndex + 1} / {poses.length}
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Image Container */}
          <div className="flex-1 flex items-center justify-center relative overflow-hidden">
            {/* Navigation Buttons */}
            {currentIndex > 0 && (
              <button
                onClick={handlePrev}
                className="absolute left-4 z-10 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            {currentIndex < poses.length - 1 && (
              <button
                onClick={handleNext}
                className="absolute right-4 z-10 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}

            {/* Image with swipe */}
            <motion.div
              key={currentIndex}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={handleDragEnd}
              onClick={handleImageClick}
              className="relative cursor-pointer"
            >
              <img
                src={currentPose.image}
                alt={`Pose ${currentIndex + 1}`}
                className="max-h-[70vh] max-w-[90vw] object-contain rounded-lg"
                draggable={false}
              />

              {/* Selection Overlay */}
              <AnimatePresence>
                {isSelected && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg"
                  >
                    <div className="w-20 h-20 rounded-full bg-[#0055FF] flex items-center justify-center">
                      <Check className="w-10 h-10 text-white" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          {/* Footer */}
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm mb-1">
                  사진을 탭하여 {isSelected ? "선택 해제" : "선택"}
                </p>
                <p className="text-white font-medium">
                  {isSelected ? "선택됨 ✓" : "선택되지 않음"}
                </p>
              </div>
              <button
                onClick={handleImageClick}
                className={`px-6 py-3 rounded-xl font-semibold transition-colors ${
                  isSelected
                    ? "bg-[#0055FF] text-white"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {isSelected ? "선택 해제" : "선택하기"}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
