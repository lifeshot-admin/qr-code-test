"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";

type Slide = {
  id: number;
  image: string;
  title: string;
  subtitle: string;
};

const defaultSlides: Slide[] = [
  {
    id: 1,
    image: "https://kimi-web-img.moonshot.cn/img/rimage.gnst.jp/ee3fdde7a5584072a7ea481827b196ca92b7b1e6.jpg",
    title: "후지산과 벚꽃",
    subtitle: "봄의 아름다움을 담아보세요",
  },
  {
    id: 2,
    image: "https://kimi-web-img.moonshot.cn/img/rimage.gnst.jp/7944601e5203cef6d063f09e5253447d28b80df7.jpg",
    title: "아라시야마 대나무숲",
    subtitle: "신비로운 녹색 터널",
  },
  {
    id: 3,
    image: "https://kimi-web-img.moonshot.cn/img/media.triple.guide/da3f6881aff143aa548d0b20ad6cbd5cac801f18.jpeg",
    title: "금각사",
    subtitle: "반짝이는 황금빛 사원",
  },
  {
    id: 4,
    image: "https://kimi-web-img.moonshot.cn/img/www.kyototourism.org/ecaed41b85a87c996f3ec83f2cf91458880fa833.jpg",
    title: "교토 벚꽃",
    subtitle: "꿈같은 벚꽃 터널",
  },
];

export default function EventSlider({ slides = defaultSlides }: { slides?: Slide[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    const timer = setInterval(nextSlide, 3000);
    return () => clearInterval(timer);
  }, [nextSlide]);

  return (
    <div className="relative w-full h-[280px] rounded-2xl overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0"
        >
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${slides[currentIndex].image})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            <motion.h3
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-bold mb-1"
            >
              {slides[currentIndex].title}
            </motion.h3>
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-white/80"
            >
              {slides[currentIndex].subtitle}
            </motion.p>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation buttons */}
      <button
        onClick={prevSlide}
        className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        onClick={nextSlide}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Dots indicator */}
      <div className="absolute bottom-4 right-4 flex gap-1.5">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-2 h-2 rounded-full transition-all ${
              index === currentIndex
                ? "bg-white w-4"
                : "bg-white/50 hover:bg-white/70"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
