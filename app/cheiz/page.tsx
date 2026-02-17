"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  Camera,
  ChevronRight,
  Star,
} from "lucide-react";
import EventSlider from "./components/EventSlider";
import CouponSheet from "./components/CouponSheet";
import TourSection from "@/components/home/TourSection";
import { fetchTours, type TourDetail } from "@/lib/tour-api";
import { getAppLanguage } from "@/lib/locale";

export default function CheizHome() {
  const { data: session } = useSession();
  const router = useRouter();

  // 쿠폰 조회 상태
  const [showCouponModal, setShowCouponModal] = useState(false);

  // 토스트 알림 상태
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 리뷰 데이터
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState<any | null>(null);

  // ✅ 투어 리스트 데이터 (Java 백엔드 — Public API)
  const [tours, setTours] = useState<TourDetail[]>([]);
  const [toursLoading, setToursLoading] = useState(true);

  // 토스트 자동 닫기
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // 리뷰 데이터 로드
  useEffect(() => {
    const loadReviews = async () => {
      try {
        const res = await fetch("/api/bubble/reviews");
        if (res.ok) {
          const data = await res.json();
          const loaded = data.reviews || [];
          setReviews(loaded);

          console.log(`[CheizHome] 리뷰 ${loaded.length}개 로드`);
        }
      } catch (e) {
        console.error("Failed to load reviews:", e);
      } finally {
        setReviewsLoading(false);
      }
    };
    loadReviews();
  }, []);

  // ✅ 글로벌 언어 결정 (유저 lan > URL locale > 브라우저 > "ko")
  const appLang = getAppLanguage({
    userLan: session?.user?.lan,
    urlLocale: null, // /cheiz는 locale 경로가 없으므로 null
  });

  // ✅ 투어 리스트 로드 (Java 백엔드 — viewLanguage 동기화)
  useEffect(() => {
    const loadTours = async () => {
      setToursLoading(true);
      try {
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`🚀 [CheizHome] 투어 리스트 로드 시작... (lang=${appLang})`);
        const data = await fetchTours(appLang);
        setTours(data);
        console.log(`🔥 가져온 투어 개수: ${data.length}`);
        if (data.length > 0) {
          console.log("📋 첫 투어:", data[0].name, "| ID:", data[0].id);
        }
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      } catch (e) {
        console.error("❌ [CheizHome] 투어 로드 실패:", e);
        setTours([]);
      } finally {
        setToursLoading(false);
      }
    };
    loadTours();
  }, [appLang]);

  // 클립보드 복사
  const handleCopyCode = useCallback(async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setToastMessage("사용자 디바이스에 저장되었습니다 (붙여넣기 가능)");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setToastMessage("사용자 디바이스에 저장되었습니다 (붙여넣기 가능)");
    }
  }, []);

  // 쿠폰 검색 핸들러 (CouponSheet에 전달)
  const handleCouponSearch = async (tourDate: string, phone4Digits: string) => {
    const params = new URLSearchParams({
      tour_date: tourDate,
      phone_4_digits: phone4Digits,
    });

    console.log(`🎫 [CouponSearch] 조회 요청: tourDate=${tourDate}, phone=${phone4Digits}`);

    const response = await fetch(`/api/bubble/search-coupon?${params}`);
    const data = await response.json();

    if (data.found) {
      console.log(`✅ [CouponSearch] 매칭 성공! code=${data.data.code}`);
      return {
        found: true,
        coupon_name: data.data.coupon_name,
        code: data.data.code,
        tour_Id: data.data.tour_Id,
      };
    } else {
      console.log(`❌ [CouponSearch] 매칭 실패: ${data.message}`);
      return {
        found: false,
        message: data.message || "일치하는 예약 정보가 없습니다.",
      };
    }
  };

  // ═══ KIMI Design Home View ═══
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="font-bold text-lg text-[#1A1A1A]">
            {session ? (
              <>
                안녕하세요!{" "}
                <span className="text-[#0055FF]">
                  {session.user?.nickname || session.user?.name || "Cheiz"}
                </span>
              </>
            ) : (
              <>
                안녕하세요! <span className="text-[#0055FF]">Cheiz</span>
              </>
            )}
          </h1>
          {/* 로그아웃은 마이페이지 햄버거 메뉴로 이동 */}
          <div className="w-12" />
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-8">
        {/* Event Slider */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-[#1A1A1A]">
              인생샷으로 남길 특별한 순간
            </h2>
          </div>
          <EventSlider />
        </section>

        {/* ★ 추천 투어 리스트 (2순위 — EventSlider 바로 아래) */}
        <TourSection tours={tours} loading={toursLoading} locale={appLang} />

        {/* Photo Reviews */}
        <section>
          <h2 className="text-lg font-bold text-[#1A1A1A] mb-4 flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#0055FF]" />
            사진리뷰
          </h2>

          {reviewsLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-[#0055FF] border-solid"></div>
            </div>
          ) : reviews.length === 0 ? (
            <p className="text-center text-gray-400 py-8">아직 등록된 리뷰가 없습니다.</p>
          ) : (
            <div className="space-y-4">
              {reviews.map((review, idx) => {
                const images = [review.image, review["image-2"], review["image-3"]].filter(Boolean);
                const hasImage = images.length > 0;
                const nickname = review._user_nickname || "치이즈 고객님";
                const userImg = review._user_image || "";

                return (
                  <motion.div
                    key={review._id || idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.1, 0.5) }}
                    className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm cursor-pointer"
                    onClick={() => setSelectedReview(review)}
                  >
                    <div className="flex">
                      {hasImage && (
                        <div className="w-28 h-28 flex-shrink-0 relative bg-gray-100">
                          <Image
                            src={normalizeImageUrl(images[0])}
                            alt={review.title || "리뷰"}
                            fill
                            sizes="112px"
                            loading="lazy"
                            quality={60}
                            className="object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = "none";
                            }}
                          />
                          {images.length > 1 && (
                            <div className="absolute top-1 right-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                              +{images.length}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="p-4 flex-1 min-w-0">
                        {review.score != null && (
                          <div className="flex items-center gap-0.5 mb-2">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-4 h-4 ${
                                  i < review.score
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "text-gray-200"
                                }`}
                              />
                            ))}
                          </div>
                        )}
                        {review.title && (
                          <h4 className="font-bold text-[#1A1A1A] text-sm mb-1 line-clamp-1">
                            {review.title}
                          </h4>
                        )}
                        {review.review && (
                          <p className="text-sm text-[#1A1A1A] line-clamp-2 mb-2">
                            &ldquo;{review.review}&rdquo;
                          </p>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">- {nickname}</span>
                          {review["Modified Date"] && (
                            <span className="text-xs text-gray-400">
                              {new Date(review["Modified Date"]).toLocaleDateString("ko-KR")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        {/* CTA Button */}
        {!session && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <button
              onClick={() => router.push("/auth/signin?callbackUrl=/cheiz")}
              className="w-full h-14 bg-[#0055FF] hover:bg-[#0055FF]/90 text-white font-semibold rounded-xl text-lg transition-all"
            >
              지금 바로 시작하기
              <ChevronRight className="w-5 h-5 ml-1 inline" />
            </button>
          </motion.div>
        )}
      </main>

      {/* Review Detail Modal */}
      <AnimatePresence>
        {selectedReview && (
          <ReviewDetailModal
            review={selectedReview}
            onClose={() => setSelectedReview(null)}
          />
        )}
      </AnimatePresence>

      {/* Coupon Sheet */}
      <CouponSheet
        isOpen={showCouponModal}
        onClose={() => setShowCouponModal(false)}
        onSearch={handleCouponSearch}
      />

      {/* Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl text-sm font-medium"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════
   유틸 & 서브 컴포넌트
   ═══════════════════════════════════════════ */

/** Bubble 이미지 URL 정규화 */
function normalizeImageUrl(url: string) {
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

/**
 * 리뷰 상세 모달 (이미지 슬라이더 + 본문 + 대댓글)
 */
function ReviewDetailModal({ review, onClose }: { review: any; onClose: () => void }) {
  const [imgIdx, setImgIdx] = useState(0);
  const images: string[] = [review.image, review["image-2"], review["image-3"]].filter(Boolean);
  const nickname = review._user_nickname || "치이즈 고객님";
  const userImg = review._user_image || "";

  // ESC 키로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 배경 스크롤 방지
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        transition={{ type: "spring", duration: 0.45 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] shadow-lg flex flex-col"
      >
        {/* 이미지 슬라이더 */}
        {images.length > 0 && (
          <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden rounded-t-3xl flex-shrink-0">
            <Image
              src={normalizeImageUrl(images[imgIdx])}
              alt={`리뷰 이미지 ${imgIdx + 1}`}
              fill
              sizes="(max-width: 768px) 100vw, 512px"
              priority
              quality={85}
              className="object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
              }}
            />
            {images.length > 1 && (
              <>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {images.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setImgIdx(i)}
                      className={`w-2.5 h-2.5 rounded-full transition-all ${
                        i === imgIdx ? "bg-white w-5" : "bg-white/50"
                      }`}
                    />
                  ))}
                </div>
                <button
                  onClick={() => setImgIdx((p) => (p - 1 + images.length) % images.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white w-9 h-9 rounded-full flex items-center justify-center transition-all text-lg"
                >
                  &lsaquo;
                </button>
                <button
                  onClick={() => setImgIdx((p) => (p + 1) % images.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white w-9 h-9 rounded-full flex items-center justify-center transition-all text-lg"
                >
                  &rsaquo;
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 bg-black/40 hover:bg-black/60 text-white w-8 h-8 rounded-full flex items-center justify-center transition-all text-sm backdrop-blur-sm"
            >
              &times;
            </button>
          </div>
        )}

        {/* 본문 */}
        <div className="overflow-y-auto overscroll-contain scroll-smooth flex-1 min-h-0">
          <div className="p-6">
            {images.length === 0 && (
              <div className="flex justify-end -mt-2 -mr-2 mb-2">
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 w-8 h-8 rounded-full flex items-center justify-center transition-all text-sm"
                >
                  &times;
                </button>
              </div>
            )}

            <div className="flex items-center gap-3 mb-4">
              {userImg ? (
                <Image src={normalizeImageUrl(userImg)} alt="" width={40} height={40} loading="lazy" className="rounded-full object-cover flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#0055FF]/15 flex items-center justify-center text-[#0055FF] font-bold text-sm flex-shrink-0">
                  {nickname[0]}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-semibold text-[#1A1A1A] text-sm">{nickname}</p>
                <div className="flex items-center gap-0.5">
                  {review.score != null && Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className={`text-xs ${i < review.score ? "text-yellow-400" : "text-gray-200"}`}>&#9733;</span>
                  ))}
                  {review["Modified Date"] && (
                    <span className="text-[10px] text-gray-400 ml-2">
                      {new Date(review["Modified Date"]).toLocaleDateString("ko-KR")}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {review.title && (
              <h3 className="font-bold text-[#1A1A1A] text-xl mb-3">{review.title}</h3>
            )}

            {review.review && (
              <p className="text-gray-600 text-[14px] leading-[1.8] whitespace-pre-wrap break-words">
                {review.review}
              </p>
            )}

            {review["대댓글"] && (
              <div className="mt-6 bg-gray-50 rounded-2xl p-4 border-l-4 border-[#0055FF]">
                <p className="text-xs font-semibold text-[#0055FF] mb-1">관리자 답글</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{review["대댓글"]}</p>
              </div>
            )}
          </div>

          <div className="px-6 pb-6 pt-2">
            <button
              onClick={onClose}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl transition-all text-sm"
            >
              닫기
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
