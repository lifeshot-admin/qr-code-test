"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";

type BannerSlide = {
  _id: string;
  title: string;
  subtitle?: string;
  image_url: string;
  target_url?: string;
  sort_order: number;
};

const fallbackSlides: BannerSlide[] = [
  { _id: "f1", title: "후지산과 벚꽃", subtitle: "봄의 아름다움을 담아보세요", image_url: "https://kimi-web-img.moonshot.cn/img/rimage.gnst.jp/ee3fdde7a5584072a7ea481827b196ca92b7b1e6.jpg", sort_order: 0 },
  { _id: "f2", title: "아라시야마 대나무숲", subtitle: "신비로운 녹색 터널", image_url: "https://kimi-web-img.moonshot.cn/img/rimage.gnst.jp/7944601e5203cef6d063f09e5253447d28b80df7.jpg", sort_order: 1 },
  { _id: "f3", title: "금각사", subtitle: "반짝이는 황금빛 사원", image_url: "https://kimi-web-img.moonshot.cn/img/media.triple.guide/da3f6881aff143aa548d0b20ad6cbd5cac801f18.jpeg", sort_order: 2 },
];

export default function EventSlider() {
  const router = useRouter();
  const [slides, setSlides] = useState<BannerSlide[]>(fallbackSlides);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const loadBanners = async () => {
      try {
        const res = await fetch("/api/admin/banners");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const data: BannerSlide[] = json.data || [];
        if (data.length > 0) {
          const sorted = data.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
          setSlides(sorted);
        }
      } catch (e) {
        console.error("[EventSlider] 배너 로드 실패, 폴백 사용:", e);
      } finally {
        setLoaded(true);
      }
    };
    loadBanners();
  }, []);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(nextSlide, 3000);
    return () => clearInterval(timer);
  }, [nextSlide, slides.length]);

  const handleClick = () => {
    const current = slides[currentIndex];
    if (current?.target_url) {
      if (current.target_url.startsWith("http")) {
        window.open(current.target_url, "_blank");
      } else {
        router.push(current.target_url);
      }
    }
  };

  const current = slides[currentIndex];
  if (!current) return null;

  return (
    <div
      className="relative w-full h-[280px] rounded-2xl overflow-hidden cursor-pointer"
      onClick={handleClick}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0"
        >
          <Image
            src={current.image_url}
            alt={current.title || "배너"}
            fill
            sizes="(max-width: 768px) 100vw, 480px"
            priority={currentIndex === 0}
            quality={80}
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            <motion.h3
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-bold mb-1"
            >
              {current.title}
            </motion.h3>
            {current.subtitle && (
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-white/80"
              >
                {current.subtitle}
              </motion.p>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {slides.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prevSlide(); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); nextSlide(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div className="absolute bottom-4 right-4 flex gap-1.5">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={(e) => { e.stopPropagation(); setCurrentIndex(index); }}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex ? "bg-white w-4" : "bg-white/50 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
