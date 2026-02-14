"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, memo } from "react";
import Image from "next/image";

export default function CheizHome() {
  const { data: session } = useSession();
  const router = useRouter();

  // 쿠폰 조회 상태
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [tourDate, setTourDate] = useState("");
  const [phone4Digits, setPhone4Digits] = useState("");
  const [searching, setSearching] = useState(false);
  const [couponResult, setCouponResult] = useState<{
    found: boolean;
    coupon_name?: string;
    code?: string;
    tour_Id?: number;
    message?: string;
  } | null>(null);

  // 토스트 알림 상태
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 리뷰 데이터
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState<any | null>(null);

  // 포즈 영감 데이터 (spot_pose 테이블)
  const [spotPoses, setSpotPoses] = useState<any[]>([]);
  const [spotPosesLoading, setSpotPosesLoading] = useState(true);

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

          // 디버깅: 각 리뷰의 review 필드가 제대로 전달되는지 확인
          console.log(`📝 [CheizHome] ${loaded.length}개 리뷰 로드`);
          loaded.forEach((item: any, i: number) => {
            console.log(`  Review[${i}] Content Check:`, {
              _id: item._id,
              review: item.review,
              reviewExists: item.review !== undefined && item.review !== null,
              reviewLength: item.review?.length ?? 0,
              title: item.title,
              nickname: item._user_nickname,
            });
          });
        }
      } catch (e) {
        console.error("Failed to load reviews:", e);
      } finally {
        setReviewsLoading(false);
      }
    };
    loadReviews();
  }, []);

  // 포즈 영감 데이터 로드 (spot_pose 테이블)
  useEffect(() => {
    const loadSpotPoses = async () => {
      try {
        console.log("[CheizHome] spot_pose 데이터 로드 시작");
        const res = await fetch("/api/bubble/spot-poses");
        if (res.ok) {
          const data = await res.json();
          const poses = Array.isArray(data) ? data : data?.response?.results || [];
          // 이미지가 없는 데이터는 제외
          const filtered = poses.filter((p: any) => p.image);
          setSpotPoses(filtered);
          console.log(`🎯 [CheizHome] spot_pose ${filtered.length}개 로드 (이미지 있는 것만)`);
        }
      } catch (e) {
        console.error("Failed to load spot poses:", e);
      } finally {
        setSpotPosesLoading(false);
      }
    };
    loadSpotPoses();
  }, []);

  // 클립보드 복사
  const handleCopyCode = useCallback(async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setToastMessage("사용자 디바이스에 저장되었습니다 (붙여넣기 가능)");
    } catch {
      // fallback
      const textarea = document.createElement("textarea");
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setToastMessage("사용자 디바이스에 저장되었습니다 (붙여넣기 가능)");
    }
  }, []);

  const handlePoseBooking = () => {
    if (!session) {
      // 로그인 안 되어 있으면 로그인 페이지로 이동
      router.push("/auth/signin");
    } else {
      // 로그인 되어 있으면 마이페이지로
      router.push("/cheiz/my-tours");
    }
  };

  const handleCouponSearch = async () => {
    if (!tourDate || !phone4Digits) {
      alert("투어 날짜와 전화번호 뒷 4자리를 모두 입력해주세요.");
      return;
    }

    if (phone4Digits.length !== 4) {
      alert("전화번호 뒷 4자리를 정확히 입력해주세요.");
      return;
    }

    setSearching(true);
    setCouponResult(null);

    try {
      // code 없이 phone + tour_date만으로 조회 → code 자동 추출
      const params = new URLSearchParams({
        tour_date: tourDate,
        phone_4_digits: phone4Digits,
      });

      console.log(`🎫 [CouponSearch] 조회 요청: tourDate=${tourDate}, phone=${phone4Digits}`);

      const response = await fetch(`/api/bubble/search-coupon?${params}`);
      const data = await response.json();

      if (data.found) {
        console.log(`✅ [CouponSearch] 매칭 성공! code=${data.data.code}`);
        setCouponResult({
          found: true,
          coupon_name: data.data.coupon_name,
          code: data.data.code,
          tour_Id: data.data.tour_Id,
        });
      } else {
        console.log(`❌ [CouponSearch] 매칭 실패: ${data.message}`);
        setCouponResult({
          found: false,
          message: data.message || "일치하는 예약 정보가 없습니다. 전화번호와 날짜를 다시 확인해 주세요.",
        });
      }
    } catch (error) {
      console.error("Coupon search error:", error);
      setCouponResult({
        found: false,
        message: "쿠폰 조회 중 오류가 발생했습니다.",
      });
    } finally {
      setSearching(false);
    }
  };

  const buttons = [
    {
      title: "쿠폰 조회",
      description: "예약 정보로 내 쿠폰을 바로 확인!",
      icon: "🎫",
      onClick: () => setShowCouponModal(true),
      delay: 0,
    },
    {
      title: "인생샷 가이드 받기",
      description: "결정장애 끝! 나만의 포즈 추천받기",
      icon: "📸",
      onClick: handlePoseBooking,
      delay: 0.1,
    },
    {
      title: "1:1 문의하기",
      description: "궁금한 점을 카카오톡으로 물어보세요",
      icon: "💬",
      href: "http://pf.kakao.com/_TxoxlxiG/chat",
      external: true,
      delay: 0.2,
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section — 공감형 UX 라이팅 */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative bg-gradient-to-br from-skyblue to-blue-500 text-white py-20 px-6"
      >
        <div className="max-w-4xl mx-auto text-center">
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="text-sm md:text-base font-medium tracking-widest uppercase opacity-70 mb-4"
          >
            Cheiz
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-3xl md:text-5xl font-bold mb-4 leading-tight"
          >
            오늘 우리,
            <br />
            어떤 포즈로 찍어볼까?
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-base md:text-lg mb-6 opacity-85 max-w-md mx-auto"
          >
            결정장애 해결! 1,000만 데이터가 분석한 인생샷 가이드
          </motion.p>
          {!session ? (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.4 }}
              onClick={() => router.push("/auth/signin")}
              className="bg-white text-skyblue font-bold py-3 px-8 rounded-full hover:bg-white/90 transition-all transform hover:scale-105 shadow-lg text-sm"
            >
              우리만의 포즈 보러가기
            </motion.button>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="flex items-center justify-center gap-4"
            >
              <p className="text-base opacity-80">
                {session.user?.nickname || session.user?.name || session.user?.email}님, 반가워요!
              </p>
              <button
                onClick={() => signOut({ callbackUrl: "/cheiz" })}
                className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-full font-medium transition-all text-sm"
              >
                로그아웃
              </button>
            </motion.div>
          )}
        </div>
      </motion.section>

      {/* Main Actions */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-3xl font-bold text-gray-800 mb-12 text-center"
          >
            무엇을 도와드릴까요?
          </motion.h2>

          <div className="grid md:grid-cols-3 gap-6">
            {buttons.map((button) => (
              <motion.div
                key={button.title}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: button.delay, duration: 0.5 }}
              >
                {button.onClick ? (
                  <button
                    onClick={button.onClick}
                    className="w-full bg-skyblue text-white rounded-3xl p-8 hover:bg-opacity-90 transition-all transform hover:scale-105 shadow-lg group"
                  >
                    <div className="text-5xl mb-4">{button.icon}</div>
                    <h3 className="text-2xl font-bold mb-2">{button.title}</h3>
                    <p className="text-sm opacity-90">{button.description}</p>
                  </button>
                ) : button.external ? (
                  <a
                    href={button.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full bg-skyblue text-white rounded-3xl p-8 hover:bg-opacity-90 transition-all transform hover:scale-105 shadow-lg group"
                  >
                    <div className="text-5xl mb-4">{button.icon}</div>
                    <h3 className="text-2xl font-bold mb-2">{button.title}</h3>
                    <p className="text-sm opacity-90">{button.description}</p>
                  </a>
                ) : null}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Info Section — CTA */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            <h3 className="text-2xl font-bold text-gray-800 mb-4">
              아직 고민 중이세요?
            </h3>
            <p className="text-gray-600 mb-8">
              찍고 싶은 포즈를 미리 골라두면, 현장에서 시간 절약!
              <br />
              로그인 한 번이면 인생샷 가이드가 바로 시작됩니다.
            </p>
            {!session && (
              <button
                onClick={() => router.push("/auth/signin")}
                className="bg-skyblue text-white font-bold py-3.5 px-10 rounded-full hover:bg-opacity-90 transition-all transform hover:scale-105 shadow-lg text-sm"
              >
                3초만에 시작하기
              </button>
            )}
          </motion.div>
        </div>
      </section>

      {/* ═══ 포즈 인스퍼레이션 (가로 스크롤 — spot_pose 데이터) ═══ */}
      <PoseInspirationSlider
        spotPoses={spotPoses}
        loading={spotPosesLoading}
        onClickPose={() => {
          if (!session) {
            router.push("/auth/signin");
          } else {
            router.push("/cheiz/my-tours");
          }
        }}
      />

      {/* ═══ 리뷰 섹션 (Two-Track: 사진 / 글) ═══ */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-3xl font-bold text-gray-800 mb-2 text-center"
          >
            고객 리뷰
          </motion.h2>
          <p className="text-center text-gray-400 text-sm mb-10">실제 고객님들의 생생한 후기</p>

          {reviewsLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-skyblue border-solid"></div>
            </div>
          ) : reviews.length === 0 ? (
            <p className="text-center text-gray-400 py-8">아직 등록된 리뷰가 없습니다.</p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {reviews.map((review, idx) => {
                const images = [review.image, review["image-2"], review["image-3"]].filter(Boolean);
                const hasImage = images.length > 0;
                const nickname = review._user_nickname || "치이즈 고객님";
                const userImg = review._user_image || "";

                return (
                  <motion.div
                    key={review._id || idx}
                    initial={{ opacity: 0, y: 25 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.08, 0.6), duration: 0.45 }}
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    className="cursor-pointer group"
                    onClick={() => setSelectedReview(review)}
                  >
                    {hasImage ? (
                      /* ── 사진 리뷰 카드 ── */
                      <div className="relative rounded-3xl overflow-hidden shadow-lg aspect-[4/5]">
                        <Image
                          src={normalizeImageUrl(images[0])}
                          alt={review.title || "리뷰"}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          loading="lazy"
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        {/* 그라데이션 오버레이 — 하단에 충분한 가독성 확보 */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                        {/* 컨텐츠 (하단) */}
                        <div className="absolute bottom-0 left-0 right-0 p-5">
                          {/* 별점 */}
                          {review.score != null && (
                            <div className="flex items-center gap-0.5 mb-2">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <span key={i} className={`text-sm ${i < review.score ? "text-yellow-400" : "text-white/30"}`}>
                                  ★
                                </span>
                              ))}
                            </div>
                          )}
                          {review.title && (
                            <h4 className="font-bold text-white text-[15px] mb-1.5 line-clamp-1 drop-shadow-sm">{review.title}</h4>
                          )}
                          {review.review && (
                            <p className="text-white/90 text-[13px] leading-relaxed line-clamp-3 drop-shadow-sm">{review.review}</p>
                          )}

                          {/* 유저 정보 */}
                          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/20">
                            {userImg ? (
                              <Image src={normalizeImageUrl(userImg)} alt="" width={24} height={24} loading="lazy" className="rounded-full object-cover ring-1 ring-white/30" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-white text-[10px] font-bold">
                                {nickname[0]}
                              </div>
                            )}
                            <span className="text-white/80 text-[11px] font-medium">{nickname}</span>
                            {review["Modified Date"] && (
                              <span className="text-white/40 text-[10px] ml-auto">
                                {new Date(review["Modified Date"]).toLocaleDateString("ko-KR")}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 이미지 개수 뱃지 */}
                        {images.length > 1 && (
                          <div className="absolute top-3 right-3 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">
                            +{images.length}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* ── 글 리뷰 카드 (카드 뉴스 스타일) ── */
                      <div className="relative rounded-3xl overflow-hidden shadow-lg aspect-[4/5] bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 p-6 flex flex-col justify-between">
                        {/* 큰 따옴표 데코 */}
                        <div className="text-skyblue/15 text-8xl font-serif leading-none select-none absolute top-4 left-5">&ldquo;</div>

                        <div className="relative z-10 flex-1 flex flex-col justify-center">
                          {review.score != null && (
                            <div className="flex items-center gap-0.5 mb-3">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <span key={i} className={`text-sm ${i < review.score ? "text-yellow-400" : "text-gray-200"}`}>
                                  ★
                                </span>
                              ))}
                            </div>
                          )}
                          {review.title && (
                            <h4 className="font-bold text-gray-800 text-lg mb-3 line-clamp-2">{review.title}</h4>
                          )}
                          {review.review && (
                            <p className="text-gray-700 text-[13px] leading-relaxed line-clamp-3">{review.review}</p>
                          )}
                        </div>

                        {/* 유저 정보 (하단) */}
                        <div className="relative z-10 flex items-center gap-2 pt-4 mt-auto border-t border-gray-200/60">
                          {userImg ? (
                            <Image src={normalizeImageUrl(userImg)} alt="" width={24} height={24} loading="lazy" className="rounded-full object-cover" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-skyblue/20 flex items-center justify-center text-skyblue text-[10px] font-bold">
                              {nickname[0]}
                            </div>
                          )}
                          <span className="text-gray-500 text-[11px] font-medium">{nickname}</span>
                          {review["Modified Date"] && (
                            <span className="text-gray-300 text-[10px] ml-auto">
                              {new Date(review["Modified Date"]).toLocaleDateString("ko-KR")}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ═══ 리뷰 상세 모달 ═══ */}
      <AnimatePresence>
        {selectedReview && (
          <ReviewDetailModal
            review={selectedReview}
            onClose={() => setSelectedReview(null)}
          />
        )}
      </AnimatePresence>

      {/* 쿠폰 조회 모달 */}
      <AnimatePresence>
        {showCouponModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            onClick={() => {
              setShowCouponModal(false);
              setCouponResult(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", duration: 0.5 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
              <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">
                🎫 쿠폰 조회
              </h2>

              {!couponResult ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      투어 날짜
                    </label>
                    <input
                      type="date"
                      value={tourDate}
                      onChange={(e) => setTourDate(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-3xl focus:outline-none focus:border-skyblue text-black"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      전화번호 뒷 4자리
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={phone4Digits}
                      onChange={(e) => setPhone4Digits(e.target.value.replace(/\D/g, ""))}
                      placeholder="0000"
                      className="w-full px-4 py-3 border border-gray-300 rounded-3xl focus:outline-none focus:border-skyblue text-black"
                    />
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => {
                        setShowCouponModal(false);
                        setCouponResult(null);
                      }}
                      className="flex-1 bg-gray-200 text-gray-700 font-bold py-3 rounded-3xl hover:bg-gray-300 transition-all"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleCouponSearch}
                      disabled={searching}
                      className="flex-1 bg-skyblue text-white font-bold py-3 rounded-3xl hover:bg-opacity-90 transition-all disabled:opacity-50"
                    >
                      {searching ? "조회 중..." : "확인하기"}
                    </button>
                  </div>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center"
                >
                  {couponResult.found ? (
                    <>
                      <div className="text-6xl mb-4">✨</div>
                      <h3 className="text-2xl font-bold text-skyblue mb-4">
                        쿠폰을 찾았습니다!
                      </h3>
                      <div className="bg-gray-50 rounded-3xl p-6 mb-6">
                        {couponResult.coupon_name && (
                          <p className="text-gray-700 mb-3">
                            <span className="font-semibold">쿠폰:</span>{" "}
                            {couponResult.coupon_name}
                          </p>
                        )}
                        {couponResult.code && (
                          <div className="bg-white rounded-2xl p-4 border-2 border-skyblue/30">
                            <p className="text-xs text-gray-500 mb-1">쿠폰 코드</p>
                            <p className="text-2xl font-bold text-skyblue tracking-widest">
                              {couponResult.code}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            setShowCouponModal(false);
                            setCouponResult(null);
                            setTourDate("");
                            setPhone4Digits("");
                          }}
                          className="flex-1 bg-gray-200 text-gray-700 font-bold py-3 rounded-3xl hover:bg-gray-300 transition-all"
                        >
                          닫기
                        </button>
                        <button
                          onClick={() => {
                            if (couponResult.code) {
                              handleCopyCode(couponResult.code);
                            }
                          }}
                          className="flex-1 bg-skyblue text-white font-bold py-3 rounded-3xl hover:bg-opacity-90 transition-all"
                        >
                          쿠폰코드 저장하기
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-6xl mb-4">😢</div>
                      <h3 className="text-2xl font-bold text-gray-800 mb-4">
                        일치하는 예약 정보가 없습니다.
                      </h3>
                      <p className="text-gray-600 mb-6">
                        전화번호와 날짜를 다시 확인해 주세요.
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            setShowCouponModal(false);
                            setCouponResult(null);
                            setTourDate("");
                            setPhone4Digits("");
                          }}
                          className="flex-1 bg-gray-200 text-gray-700 font-bold py-3 rounded-3xl hover:bg-gray-300 transition-all"
                        >
                          닫기
                        </button>
                        <button
                          onClick={() => {
                            // 결과만 초기화하고 입력값은 유지 → 다시 시도 가능
                            setCouponResult(null);
                          }}
                          className="flex-1 bg-skyblue text-white font-bold py-3 rounded-3xl hover:bg-opacity-90 transition-all"
                        >
                          다시 시도
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 토스트 알림 */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl text-sm font-medium"
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
/* ═══════════════════════════════════════════
   포즈 인스퍼레이션 가로 슬라이더 (spot_pose 테이블 기반)
   ═══════════════════════════════════════════ */

const PoseInspirationSlider = memo(function PoseInspirationSlider({
  spotPoses,
  loading,
  onClickPose,
}: {
  spotPoses: any[];
  loading: boolean;
  onClickPose: () => void;
}) {
  // 이미지가 있는 spot_pose만 사용, 최대 12개
  const inspirations = spotPoses
    .filter((p) => p.image)
    .slice(0, 12)
    .map((p) => ({
      _id: p._id,
      image: p.image,
      // persona 카테고리를 #태그로 매핑
      category: p.persona || p.category || "",
      tag: p.persona ? `#${p.persona}` : "#포즈",
    }));

  if (loading || inspirations.length === 0) return null;

  return (
    <section className="py-14 px-0 overflow-hidden">
      <div className="max-w-5xl mx-auto px-6 mb-6">
        <motion.h2
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-2xl md:text-3xl font-bold text-gray-800"
        >
          포즈 영감 받기
        </motion.h2>
        <p className="text-gray-400 text-sm mt-1">인기 포즈에서 영감을 얻어보세요</p>
      </div>

      {/* 가로 스크롤 컨테이너 */}
      <div className="flex gap-4 overflow-x-auto scrollbar-hide px-6 pb-4 snap-x snap-mandatory">
        {inspirations.map((item, idx) => (
          <motion.div
            key={item._id || idx}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(idx * 0.06, 0.5), duration: 0.4 }}
            className="flex-shrink-0 snap-start cursor-pointer group"
            onClick={onClickPose}
          >
            <div className="relative w-44 md:w-52 aspect-[3/4] rounded-[1.5rem] overflow-hidden shadow-md group-hover:shadow-xl transition-shadow duration-300">
              <Image
                src={normalizeImageUrl(item.image)}
                alt={item.category || "포즈 영감"}
                fill
                sizes="(max-width: 768px) 176px, 208px"
                loading={idx < 3 ? "eager" : "lazy"}
                className="object-cover group-hover:scale-105 transition-transform duration-500"
              />
              {/* 하단 그라데이션 */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              {/* 카테고리 태그 (persona) */}
              <span className="absolute bottom-3 right-3 bg-white/25 backdrop-blur-md text-white text-[11px] font-medium px-2.5 py-1 rounded-full">
                {item.tag}
              </span>
            </div>
          </motion.div>
        ))}

        {/* 마지막 — CTA 카드 */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="flex-shrink-0 snap-start cursor-pointer"
          onClick={onClickPose}
        >
          <div className="w-44 md:w-52 aspect-[3/4] rounded-[1.5rem] bg-gradient-to-br from-skyblue/10 to-blue-50 border-2 border-dashed border-skyblue/30 flex flex-col items-center justify-center gap-3 hover:border-skyblue/60 transition-all">
            <div className="w-12 h-12 rounded-full bg-skyblue/15 flex items-center justify-center">
              <span className="text-skyblue text-2xl">+</span>
            </div>
            <p className="text-skyblue font-semibold text-sm">더 많은 포즈</p>
            <p className="text-gray-400 text-[11px]">우리만의 포즈 찾기</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
});

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
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        transition={{ type: "spring", duration: 0.45 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] shadow-2xl flex flex-col"
      >
        {/* 이미지 슬라이더 (고정 영역) */}
        {images.length > 0 && (
          <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden rounded-t-3xl flex-shrink-0">
            <Image
              src={normalizeImageUrl(images[imgIdx])}
              alt={`리뷰 이미지 ${imgIdx + 1}`}
              fill
              sizes="(max-width: 768px) 100vw, 512px"
              priority
              className="object-cover"
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
                  ‹
                </button>
                <button
                  onClick={() => setImgIdx((p) => (p + 1) % images.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white w-9 h-9 rounded-full flex items-center justify-center transition-all text-lg"
                >
                  ›
                </button>
              </>
            )}

            {/* 닫기 X 버튼 (이미지 위) */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 bg-black/40 hover:bg-black/60 text-white w-8 h-8 rounded-full flex items-center justify-center transition-all text-sm backdrop-blur-sm"
            >
              ✕
            </button>
          </div>
        )}

        {/* 스크롤 가능한 본문 영역 */}
        <div className="overflow-y-auto overscroll-contain scroll-smooth flex-1 min-h-0">
          <div className="p-6">
            {/* 이미지가 없을 때 닫기 X 버튼 */}
            {images.length === 0 && (
              <div className="flex justify-end -mt-2 -mr-2 mb-2">
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 w-8 h-8 rounded-full flex items-center justify-center transition-all text-sm"
                >
                  ✕
                </button>
              </div>
            )}

            {/* 유저 + 별점 */}
            <div className="flex items-center gap-3 mb-4">
              {userImg ? (
                <Image src={normalizeImageUrl(userImg)} alt="" width={40} height={40} loading="lazy" className="rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-skyblue/15 flex items-center justify-center text-skyblue font-bold text-sm flex-shrink-0">
                  {nickname[0]}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-semibold text-gray-800 text-sm">{nickname}</p>
                <div className="flex items-center gap-0.5">
                  {review.score != null && Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className={`text-xs ${i < review.score ? "text-yellow-400" : "text-gray-200"}`}>★</span>
                  ))}
                  {review["Modified Date"] && (
                    <span className="text-[10px] text-gray-400 ml-2">
                      {new Date(review["Modified Date"]).toLocaleDateString("ko-KR")}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 제목 */}
            {review.title && (
              <h3 className="font-bold text-gray-800 text-xl mb-3">{review.title}</h3>
            )}

            {/* 리뷰 본문 — 전체 텍스트, 줄바꿈 유지, 스크롤 대응 */}
            {review.review && (
              <p className="text-gray-600 text-[14px] leading-[1.8] whitespace-pre-wrap break-words">
                {review.review}
              </p>
            )}

            {/* 대댓글 */}
            {review["대댓글"] && (
              <div className="mt-6 bg-gray-50 rounded-2xl p-4 border-l-4 border-skyblue">
                <p className="text-xs font-semibold text-skyblue mb-1">관리자 답글</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{review["대댓글"]}</p>
              </div>
            )}
          </div>

          {/* 닫기 버튼 (하단) */}
          <div className="px-6 pb-6 pt-2">
            <button
              onClick={onClose}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-2xl transition-all text-sm"
            >
              닫기
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
