"use client";

/**
 * 투어 상세 페이지 — 전체 재구성
 *
 * 섹션 순서:
 * 1. 이미지 슬라이더 (Swiper)
 * 2. 헤더 — [장소] → [타이틀] → [가격]
 * 3. 상품 설명 — 🌱⭐🎞 이모지 리스트
 * 4. 예약 가능 일정 — 날짜(요일)+시간 한 세트 버튼
 * 5. 인원 선택
 * 6. 리뷰 — 버블 API 연동
 * 7. 촬영 가이드 & 지도
 * 8. 촬영 주의사항
 * 9. 하단 예약 바
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession, getSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, Autoplay } from "swiper/modules";
import Image from "next/image";
import {
  MapPin, Calendar, ChevronLeft,
  Share2, Heart, Star, Camera, AlertTriangle,
} from "lucide-react";

import {
  fetchTourDetail, fetchSchedules, formatTimeFromISO,
  type TourDetail, type ScheduleItem,
} from "@/lib/tour-api";
import { getAppLanguage } from "@/lib/locale";
import { formatKSTDateParts, formatKST24Time } from "@/lib/utils";
import { useReservationStore, type GuestCount } from "@/lib/reservation-store";
import GuestSheet from "@/app/cheiz/components/GuestSheet";

import "swiper/css";
import "swiper/css/pagination";

// ==================== Constants & Helpers ====================

function fmtDate(iso: string) {
  return formatKSTDateParts(iso);
}

function fmtTime(iso: string) {
  return formatKST24Time(iso);
}

function fmtPrice(v: number, c: string = "KRW") {
  if (c === "KRW") return `${v.toLocaleString()}원`;
  if (c === "JPY") return `¥${v.toLocaleString()}`;
  return `$${v.toLocaleString()}`;
}

// ==================== Main Component ====================

export default function TourDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const rawId = params.id as string;
  const urlLocale = (params.locale as string) || "ko";
  const tourId = Number(rawId);

  // ━━━ [진단 로그] 세션 상태 실시간 추적 + 직접 API 비교 ━━━
  useEffect(() => {
    console.log(`[TourDetail] 🔐 sessionStatus: ${sessionStatus}, session 존재: ${!!session}`);
    if (session?.user) {
      console.log(`[TourDetail] 🔐 role="${session.user.role}", email="${session.user.email}"`);
    }
    if ((session as any)?.error) {
      console.warn(`[TourDetail] ⚠️ session.error: ${(session as any).error}`);
    }

    // unauthenticated 고정 시 원인 추적: /api/auth/session 직접 호출
    if (sessionStatus === "unauthenticated") {
      const hasCookie = document.cookie.includes("next-auth.session-token");
      console.warn(`[TourDetail] 🍪 쿠키 존재: ${hasCookie} (document.cookie 내 session-token)`);

      fetch("/api/auth/session", { credentials: "include" })
        .then(r => r.json())
        .then(d => {
          console.log("[TourDetail] 📡 /api/auth/session 직접 응답:", JSON.stringify(d).substring(0, 200));
          if (d?.user) {
            console.error("[TourDetail] ❌ API는 세션 있음인데 useSession은 unauthenticated → SessionProvider 동기화 실패!");
          }
        })
        .catch(e => console.error("[TourDetail] ❌ session API fetch 실패:", e));
    }
  }, [sessionStatus, session]);

  // ✅ 글로벌 언어 결정 (유저 lan > URL locale > 브라우저 > "ko")
  const appLang = getAppLanguage({
    userLan: session?.user?.lan,
    urlLocale,
  });

  // ───── State ─────
  const [tour, setTour] = useState<TourDetail | null>(null);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleItem | null>(null);
  const [liked, setLiked] = useState(false);

  // ✅ GuestSheet (바텀 시트) 상태
  const [guestSheetOpen, setGuestSheetOpen] = useState(false);
  const { setGuestCount, setTourId: setStoreTourId, setTour: setStoreTour, setScheduleId: setStoreScheduleId } = useReservationStore();

  // ✅ 토스트 알림 상태
  const [toast, setToast] = useState<string | null>(null);

  // ✅ 로그인 후 자동 점프 (Auto-Forward)
  // 예약 버튼 → 로그인 → 돌아왔을 때 자동으로 GuestSheet 열기
  useEffect(() => {
    if (sessionStatus === "authenticated" && session) {
      const pending = sessionStorage.getItem("pendingReserveAction");
      if (pending) {
        sessionStorage.removeItem("pendingReserveAction");
        console.log("🎯 [AutoForward] 로그인 성공 → GuestSheet 자동 열기");

        // 토스트 표시
        setToast("로그인 성공! 예약을 계속 진행합니다.");
        setTimeout(() => setToast(null), 3000);

        // 일정이 선택되어 있으면 바로 GuestSheet 열기
        if (selectedSchedule) {
          setTimeout(() => setGuestSheetOpen(true), 500);
        }
      }
    }
  }, [sessionStatus, session, selectedSchedule]);

  // ───── Data Fetching ─────
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);

      if (isNaN(tourId)) { setError("유효하지 않은 투어 ID입니다."); setLoading(false); return; }

      console.log(`🚀 [TourDetail] 로드 시작: ID=${tourId} | lang=${appLang}`);

      try {
        const [tourData, schedulesData] = await Promise.all([
          fetchTourDetail(tourId, appLang),
          fetchSchedules(tourId, appLang),
        ]);

        if (!tourData) { setError("투어 정보를 찾을 수 없습니다."); return; }

        console.log(`✅ [TourDetail] "${tourData.name}" | 스케줄 ${schedulesData.length}개`);
        setTour(tourData);

        // 과거 일정 필터링 + 가까운 날짜순 오름차순 정렬
        const now = new Date();
        const futureSchedules = schedulesData
          .filter(s => s.isActive && new Date(s.startTime) > now)
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        setSchedules(futureSchedules);
      } catch (err) {
        console.error("❌ [TourDetail]", err);
        setError("데이터를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }

    if (!isNaN(tourId)) loadData();
  }, [tourId, appLang]);

  // ───── Fetch Reviews (Bubble API) ─────
  useEffect(() => {
    async function loadReviews() {
      try {
        const res = await fetch("/api/bubble/reviews");
        if (res.ok) {
          const data = await res.json();
          setReviews((data.reviews || []).slice(0, 5));
        }
      } catch (e) { console.error("[Reviews]", e); }
    }
    loadReviews();
  }, []);

  const canReserve = !!selectedSchedule;

  const handleReserve = useCallback(async () => {
    // 1. 브라우저 콘솔에 현재 상태 출력 (F12에서 확인용)
    console.log("🚀 [RESERVE_CHECK]", {
      status: sessionStatus,
      user: session?.user,
      role: session?.user?.role,
      canReserve,
    });

    if (!canReserve || !selectedSchedule) return;

    // 2. 로딩 중일 때는 아무것도 하지 않음 (리다이렉트 방지 핵심)
    if (sessionStatus === "loading") {
      console.warn("⏳ [RESERVE_CHECK] 세션 로딩 중 — 리다이렉트 차단, 대기");
      return;
    }

    // 3. useSession이 unauthenticated라고 해도 getSession()으로 한 번 더 확인
    //    (SessionProvider 동기화 실패 방어)
    if (sessionStatus === "unauthenticated" || !session) {
      console.warn("⚠️ [RESERVE_CHECK] useSession=unauthenticated → getSession()으로 재확인 중...");
      const freshSession = await getSession();
      console.log("🔄 [RESERVE_CHECK] getSession() 결과:", {
        hasSession: !!freshSession,
        email: freshSession?.user?.email || "없음",
        role: (freshSession?.user as any)?.role || "없음",
      });

      if (freshSession?.user) {
        // getSession()에서는 세션 발견 → SessionProvider 동기화 실패였음
        console.log("✅ [RESERVE_CHECK] getSession()으로 세션 확인 → GuestSheet 열기");
        setGuestSheetOpen(true);
        return;
      }

      // getSession()에서도 세션 없음 → 진짜 미인증
      console.error("❌ [RESERVE_CHECK] 확실히 미인증 → 로그인 페이지로 리다이렉트");
      // 로그인 후 자동 복귀를 위한 플래그 저장
      sessionStorage.setItem("pendingReserveAction", "true");
      const callbackUrl = encodeURIComponent(window.location.pathname);
      router.push(`/auth/signin?callbackUrl=${callbackUrl}`);
      return;
    }

    // 4. 역할(Role) 로그 — Java 백엔드가 ROLE_USER / User 어느 쪽을 주는지 확인
    console.log(`✅ [RESERVE_CHECK] 인증 통과 → role="${session.user?.role}", GuestSheet 열기`);
    setGuestSheetOpen(true);
  }, [canReserve, selectedSchedule, sessionStatus, session, router]);

  // GuestSheet 확정 → Zustand에 투어 메타데이터 + scheduleId 저장 → spots 페이지 이동
  const handleGuestConfirm = useCallback(async (count: GuestCount) => {
    console.log("🚀 [GUEST_CONFIRM]", {
      adults: count.adults,
      status: sessionStatus,
      role: session?.user?.role,
      hasSession: !!session,
    });

    // 세션 이중 체크 — GuestSheet 열려있는 동안 세션이 풀렸을 가능성 방어
    if (sessionStatus === "loading") {
      console.warn("⏳ [GUEST_CONFIRM] 세션 로딩 중 — 대기");
      return;
    }

    // useSession이 unauthenticated → getSession()으로 재확인
    if (sessionStatus === "unauthenticated" || !session) {
      console.warn("⚠️ [GUEST_CONFIRM] useSession=unauthenticated → getSession()으로 재확인...");
      const freshSession = await getSession();
      if (!freshSession?.user) {
        console.error("❌ [GUEST_CONFIRM] 확실히 미인증 → 로그인 리다이렉트");
        setGuestSheetOpen(false);
        const callbackUrl = encodeURIComponent(window.location.pathname);
        router.push(`/auth/signin?callbackUrl=${callbackUrl}`);
        return;
      }
      console.log("✅ [GUEST_CONFIRM] getSession()으로 세션 확인 → 예약 진행");
    }

    setGuestCount(count);
    setGuestSheetOpen(false);

    if (!tour || !selectedSchedule) return;

    // 투어 메타데이터를 Zustand에 저장 (checkout에서 사용)
    const locationLabel = [tour.location, tour.locationDetail].filter(Boolean).join(" / ");
    setStoreTourId(tourId);
    setStoreScheduleId(selectedSchedule.id);
    setStoreTour({
      _id: String(tourId),
      tour_Id: tourId,
      tour_name: tour.name || "이름 없는 투어",
      tour_thumbnail: tour.thumbnailImageUrl || (tour.images?.[0]?.imageUrl) || undefined,
      tour_location: locationLabel || undefined,
      tour_date: selectedSchedule.startTime,
      tour_time: formatTimeFromISO(selectedSchedule.startTime),
    });

    const p = new URLSearchParams({
      tour_id: String(tourId),
      schedule_id: String(selectedSchedule.id),
    });
    const targetUrl = `/cheiz/reserve/spots?${p.toString()}`;
    console.log(`✅ [GUEST_CONFIRM] 인증 확인 → 이동: ${targetUrl}`);
    router.push(targetUrl);
  }, [tour, selectedSchedule, tourId, sessionStatus, session, setGuestCount, setGuestSheetOpen, setStoreTourId, setStoreScheduleId, setStoreTour, router]);

  // ───── Loading — 인라인 스켈레톤 (loading.tsx와 동일 구조) ─────
  if (loading) return (
    <div className="min-h-screen bg-white max-w-md mx-auto">
      <div className="animate-pulse">
        <div className="w-full h-[320px] bg-gray-200" />
        <div className="px-5 pt-5 space-y-4">
          <div className="h-3.5 bg-gray-200 rounded w-1/3" />
          <div className="flex items-end justify-between gap-3">
            <div className="h-5 bg-gray-200 rounded flex-1" />
            <div className="h-5 bg-gray-200 rounded w-24" />
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-full" />
            <div className="h-3 bg-gray-200 rounded w-full" />
            <div className="h-3 bg-gray-200 rounded w-2/3" />
          </div>
          <div className="pt-4">
            <div className="h-4 bg-gray-200 rounded w-28 mb-3" />
            <div className="flex gap-3 overflow-hidden">
              {[1,2,3,4].map(i => <div key={i} className="h-[72px] min-w-[130px] bg-gray-200 rounded-xl" />)}
            </div>
          </div>
          <div className="pt-4">
            <div className="h-4 bg-gray-200 rounded w-28 mb-3" />
            <div className="h-[200px] bg-gray-200 rounded-2xl w-full" />
          </div>
        </div>
      </div>
    </div>
  );

  if (error || !tour) return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-gray-400" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">{error || "투어를 찾을 수 없습니다"}</h2>
        <button onClick={() => router.back()} className="mt-4 px-6 py-3 bg-[#0055FF] text-white font-semibold rounded-xl text-sm">뒤로 가기</button>
      </div>
    </div>
  );

  // ───── Image extraction (중첩 구조 대응) ─────
  // 백엔드 구조: tour.images = [{ imageType: "EXAMPLE", images: [{ imageUrl }] }, ...]
  // 또는 플랫 구조: tour.images = [{ imageType: "EXAMPLE", imageUrl: "..." }, ...]
  const rawImages: any[] = tour.images || (tour as any).tourImages || [];

  // 이미지 타입 추출 헬퍼 (대소문자 무관)
  const getGroupType = (item: any): string =>
    (item.imageType || item.image_type || item.type || "").toUpperCase();

  // 이미지 URL 추출 헬퍼
  const getImgUrl = (img: any): string =>
    img.imageUrl || img.image_url || img.url || img.src || img.imageURL || "";

  // 중첩 구조 감지: 첫 번째 아이템에 images 배열이 있으면 중첩 구조
  const isNested = rawImages.length > 0 && Array.isArray(rawImages[0]?.images);

  // 그룹에서 이미지 URL 목록을 추출하는 함수
  const extractUrlsFromGroup = (group: any): string[] => {
    if (Array.isArray(group.images)) {
      // 중첩 구조: { type, images: [{ imageUrl }, ...] }
      return group.images.map((inner: any) => getImgUrl(inner)).filter(Boolean);
    }
    // 플랫 구조: { imageType, imageUrl }
    const url = getImgUrl(group);
    return url ? [url] : [];
  };

  // 진단 로그
  if (rawImages.length > 0) {
    console.log("━━━ [TOUR_IMAGES] 이미지 진단 ━━━");
    console.log(`[TOUR_IMAGES] 구조: ${isNested ? "중첩(Nested)" : "플랫(Flat)"} | 항목 ${rawImages.length}개`);
    console.log("[TOUR_IMAGES] 첫 항목 키:", Object.keys(rawImages[0]));
    if (isNested) {
      console.log(`[TOUR_IMAGES] 첫 항목 내부 images: ${rawImages[0].images?.length}개`);
    }
    const typeCounts: Record<string, number> = {};
    rawImages.forEach((item: any) => {
      const t = getGroupType(item);
      const count = isNested ? (item.images?.length || 0) : 1;
      typeCounts[t] = (typeCounts[t] || 0) + count;
    });
    console.log("[TOUR_IMAGES] 타입별 사진 수:", typeCounts);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  }

  // 슬라이더용 메인 이미지 (EXAMPLE + 타입 미지정만 — 가이드 사진 제외)
  const GUIDE_TYPES = new Set(["PHOTOGRAPHER_LOCATION", "ENTRANCE"]);
  const tourImages: string[] = rawImages
    .filter((item: any) => !GUIDE_TYPES.has(getGroupType(item)))
    .flatMap((item: any) => extractUrlsFromGroup(item));
  if (tourImages.length === 0 && tour.thumbnailImageUrl) tourImages.push(tour.thumbnailImageUrl);

  const locationLabel = [tour.location, tour.locationDetail].filter(Boolean).join(" / ");
  const DEFAULT_PRICE_PER_PHOTO = 1000;
  const priceValue = tour.pricePerPhoto || tour.price || DEFAULT_PRICE_PER_PHOTO;

  // 설명 텍스트 → 줄 단위 분할 (DB 원문 그대로, 하드코딩 이모지 없음)
  const descriptionLines = (tour.description || "")
    .split(/[\n\r]+/)
    .map(l => l.trim())
    .filter(Boolean);

  // 타입별 이미지 필터링 (중첩 구조 대응)
  const photographerLocationImages = rawImages
    .filter((item: any) => getGroupType(item) === "PHOTOGRAPHER_LOCATION")
    .flatMap((item: any) => extractUrlsFromGroup(item));

  const entranceImages = rawImages
    .filter((item: any) => getGroupType(item) === "ENTRANCE")
    .flatMap((item: any) => extractUrlsFromGroup(item));

  console.log(`[TOUR_GALLERY] PHOTOGRAPHER_LOCATION: ${photographerLocationImages.length}장, ENTRANCE: ${entranceImages.length}장`);

  // 설명 필드 (다양한 필드명 폴백)
  const entranceDesc = String(
    tour.entranceDescription || (tour as any).entrance_description || ""
  ).trim();
  const photographerDesc = String(
    tour.photographerDescription || (tour as any).photographer_description || ""
  ).trim();
  const exampleDesc = String(
    tour.exampleDescription || (tour as any).example_description || ""
  ).trim();

  console.log(`[TOUR_DESC] entrance: "${entranceDesc.substring(0, 50)}" | photographer: "${photographerDesc.substring(0, 50)}" | example: "${exampleDesc.substring(0, 50)}"`);

  // ===================================================================
  return (
    <div className="min-h-screen bg-white pb-28">
      {/* ═══ 토스트 알림 ═══ */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed top-[env(safe-area-inset-top)] left-0 right-0 z-50 flex justify-center pt-4 px-5 pointer-events-none"
          >
            <div className="bg-[#1A1A1A] text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
              <span className="text-green-400">✓</span>
              {toast}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Floating Header ═══ */}
      <div className="fixed top-0 left-0 right-0 z-30 pointer-events-none">
        <div className="max-w-md mx-auto flex items-center justify-between px-4 pt-[env(safe-area-inset-top)] py-3">
          <button onClick={() => router.back()} className="pointer-events-auto w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-sm">
            <ChevronLeft className="w-5 h-5 text-gray-800" />
          </button>
          <div className="flex gap-2">
            <button className="pointer-events-auto w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-sm">
              <Share2 className="w-5 h-5 text-gray-800" />
            </button>
            <button onClick={() => setLiked(!liked)} className="pointer-events-auto w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-sm">
              <Heart className={`w-5 h-5 transition-colors ${liked ? "fill-red-500 text-red-500" : "text-gray-800"}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ═══ 1. Image Slider ═══ */}
      <div className="w-full max-w-md mx-auto">
        {tourImages.length > 0 ? (
          <Swiper modules={[Pagination, Autoplay]} pagination={{ clickable: true }} autoplay={{ delay: 4000, disableOnInteraction: false }} loop={tourImages.length > 1} className="w-full aspect-[4/3] tour-swiper">
            {tourImages.map((url, i) => (
              <SwiperSlide key={i}>
                <div className="w-full h-full bg-gray-200 bg-cover bg-center" style={{ backgroundImage: `url(${url})` }} />
              </SwiperSlide>
            ))}
          </Swiper>
        ) : (
          <div className="w-full aspect-[4/3] bg-gray-100 flex items-center justify-center">
            <Camera className="w-12 h-12 text-gray-300" />
          </div>
        )}
      </div>

      {/* ═══ 2. Header: 장소 → 타이틀 → 가격 ═══ */}
      <div className="max-w-md mx-auto px-5 pt-5">
        {locationLabel && (
          <div className="flex items-center gap-1.5 mb-2">
            <MapPin className="w-3.5 h-3.5 text-[#0055FF]" />
            <span className="text-xs font-medium text-[#0055FF]">{locationLabel}</span>
          </div>
        )}

        <div className="flex items-end justify-between gap-3 mb-1">
          <h1 className="text-xl font-bold text-gray-900 leading-tight flex-1 min-w-0">{tour.name || "이름 없는 투어"}</h1>
          <p className="text-base font-bold text-gray-600 whitespace-nowrap flex-shrink-0">
            {fmtPrice(priceValue, tour.currency || "KRW")}
            <span className="text-xs font-normal text-gray-400 ml-0.5">/ 장</span>
          </p>
        </div>

        {tour.isClosed && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 mt-3 text-center">
            <p className="text-sm text-red-600 font-medium">현재 이 투어는 마감되었습니다</p>
          </div>
        )}
      </div>

      {/* ═══ Divider ═══ */}
      <div className="max-w-md mx-auto my-5"><div className="h-[1px] bg-gray-100" /></div>

      {/* ═══ 3. 상품 설명 ═══ */}
      {descriptionLines.length > 0 && (
        <div className="max-w-md mx-auto px-5 mb-6">
          <h2 className="text-base font-bold text-gray-900 mb-3">상품 소개</h2>
          <div className="space-y-2">
            {descriptionLines.map((line, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0055FF] flex-shrink-0 mt-[7px]" />
                <p className="text-sm text-gray-700 leading-relaxed">{line}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Divider ═══ */}
      <div className="max-w-md mx-auto"><div className="h-2 bg-gray-50" /></div>

      {/* ═══ 4. 예약 가능 일정 (가로 스크롤 카드) ═══ */}
      <div className="max-w-md mx-auto px-5 pt-5">
        <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#0055FF]" />
          예약 가능 일정
          {schedules.length > 0 && (
            <span className="text-xs font-normal text-gray-400 ml-1">{schedules.length}개</span>
          )}
        </h2>

        {schedules.length === 0 ? (
          <div className="bg-gray-50 rounded-2xl p-6 text-center">
            <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">예약 가능한 일정이 없습니다</p>
          </div>
        ) : (
          <div className="flex flex-row overflow-x-auto gap-2.5 pb-3 -mx-5 px-5 no-scrollbar snap-x snap-mandatory">
            {schedules.map((s, idx) => {
              const dt = fmtDate(s.startTime);
              const st = fmtTime(s.startTime);
              const et = fmtTime(s.endTime);
              const isSelected = selectedSchedule?.id === s.id;
              const isFull = s.remainingCapacity !== undefined && s.remainingCapacity !== null && s.remainingCapacity === 0;

              return (
                <motion.button
                  key={s.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(idx * 0.05, 0.3) }}
                  whileTap={isFull ? undefined : { scale: 0.96 }}
                  onClick={() => !isFull && setSelectedSchedule(s)}
                  disabled={isFull}
                  className={`
                    flex-shrink-0 snap-start min-w-[140px] py-4 px-4 rounded-2xl text-center transition-all duration-200 border-2
                    ${isSelected
                      ? "bg-[#0055FF] text-white border-[#0055FF] shadow-lg shadow-blue-500/20"
                      : isFull
                      ? "bg-gray-50 text-gray-300 border-gray-100"
                      : "bg-white text-gray-700 border-gray-100 hover:border-[#0055FF]/40 hover:bg-blue-50/50"
                    }
                  `}
                >
                  <p className={`text-lg font-extrabold leading-none mb-1 ${isSelected ? "text-white" : isFull ? "text-gray-300" : "text-gray-900"}`}>
                    {dt.m}/{dt.d}
                  </p>
                  <p className={`text-xs font-bold mb-2 ${isSelected ? "text-blue-200" : isFull ? "text-gray-300" : "text-gray-400"}`}>
                    ({dt.day})
                  </p>
                  <p className={`text-[11px] font-semibold leading-tight ${isSelected ? "text-white/90" : isFull ? "text-gray-300" : "text-gray-600"}`}>
                    {st} ~ {et}
                  </p>
                  {s.remainingCapacity !== undefined && s.remainingCapacity !== null && (
                    <p className={`text-[10px] mt-1.5 font-bold ${isSelected ? "text-blue-200" : isFull ? "text-gray-300" : "text-[#0055FF]"}`}>
                      {isFull ? "마감" : `잔여 ${s.remainingCapacity}석`}
                    </p>
                  )}
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ Divider ═══ */}
      <div className="max-w-md mx-auto my-5"><div className="h-2 bg-gray-50" /></div>

      {/* ═══ 6. 리뷰 섹션 ═══ */}
      <div className="max-w-md mx-auto px-5">
        <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Star className="w-4 h-4 text-[#0055FF]" />
          이 상품을 이용한 리뷰
        </h2>

        {reviews.length === 0 ? (
          <div className="bg-gray-50 rounded-2xl p-6 text-center">
            <Camera className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">아직 등록된 리뷰가 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((r, i) => {
              const nick = r._user_nickname || "치이즈 고객님";
              const hasImg = r.image;
              return (
                <motion.div key={r._id || i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                  className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                  <div className="flex">
                    {hasImg && (
                      <div className="w-20 h-20 flex-shrink-0 bg-gray-200 bg-cover bg-center"
                        style={{ backgroundImage: `url(${r.image.startsWith("//") ? `https:${r.image}` : r.image})` }} />
                    )}
                    <div className="p-3 flex-1 min-w-0">
                      {r.score != null && (
                        <div className="flex items-center gap-0.5 mb-1">
                          {[...Array(5)].map((_, j) => (
                            <Star key={j} className={`w-3 h-3 ${j < r.score ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
                          ))}
                        </div>
                      )}
                      {r.review && <p className="text-xs text-gray-600 line-clamp-2 mb-1">&ldquo;{r.review}&rdquo;</p>}
                      <span className="text-[10px] text-gray-400">- {nick}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ Divider ═══ */}
      <div className="max-w-md mx-auto my-5"><div className="h-2 bg-gray-50" /></div>

      {/* ═══ 7. 촬영 가이드 & 지도 ═══ */}
      <div className="max-w-md mx-auto px-5">
        <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#0055FF]" />
          촬영 장소 안내
        </h2>

        {/* Google Map — Static Map API (lat/lng 기반) 또는 Embed fallback */}
        <MapSection tour={tour} />

        {/* ── 섹션 1: 촬영 장소 사진 (PHOTOGRAPHER_LOCATION) — 세로 스택 ── */}
        {photographerLocationImages.length > 0 && (
          <div className="mb-5">
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-[#0055FF]" />
              촬영 장소 사진
            </h3>
            <div className="flex flex-col gap-3">
              {photographerLocationImages.map((url: string, i: number) => (
                <div key={i} className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 shadow-sm relative">
                  <Image src={url} alt={`촬영 장소 ${i + 1}`} fill className="object-cover" quality={85} sizes="(max-width: 768px) 100vw, 512px" loading="lazy" />
                </div>
              ))}
            </div>
            {photographerDesc && (
              <p className="text-sm text-gray-600 leading-relaxed mt-3">{photographerDesc}</p>
            )}
          </div>
        )}

        {/* ── 섹션 1.5: 입구 안내 텍스트 (entranceDescription) ── */}
        {entranceDesc && (
          <div className="mb-4 bg-amber-50/70 border border-amber-100 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-700 mb-1">입구 찾는 방법</p>
                <p className="text-sm text-gray-700 leading-relaxed">{entranceDesc}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── 섹션 2: 입구 안내 — 세로 스택 ── */}
        {entranceImages.length > 0 && (
          <div className="mb-5">
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-amber-500" />
              치이즈 사진작가에게 예약 완료 화면을 보여주세요!
            </h3>
            <div className="flex flex-col gap-3">
              {entranceImages.map((url: string, i: number) => (
                <div key={i} className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 shadow-sm relative">
                  <Image src={url} alt={`입구 안내 ${i + 1}`} fill className="object-cover" quality={85} sizes="(max-width: 768px) 100vw, 512px" loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── exampleDescription (상품 관련 추가 설명) ── */}
        {exampleDesc && (
          <div className="mb-4 bg-blue-50/50 border border-blue-100 rounded-xl p-4">
            <p className="text-sm text-gray-700 leading-relaxed">{exampleDesc}</p>
          </div>
        )}

        {/* 포토그래퍼 안내 */}
        <div className="bg-gradient-to-br from-[#0055FF]/5 to-blue-50 rounded-2xl p-5 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[#0055FF]/10 flex items-center justify-center">
            <Camera className="w-7 h-7 text-[#0055FF]" />
          </div>
          <p className="text-sm font-bold text-gray-900 mb-1">
            나만의 치이즈 포토그래퍼가 기다리고 있어요!
          </p>
          <p className="text-xs text-gray-500 leading-relaxed">
            현지 전문 포토그래퍼가 최고의 앵글로<br />
            당신만의 특별한 순간을 담아드립니다
          </p>
        </div>
      </div>

      {/* ═══ Divider ═══ */}
      <div className="max-w-md mx-auto my-5"><div className="h-2 bg-gray-50" /></div>

      {/* ═══ 8. 촬영 주의사항 ═══ */}
      <div className="max-w-md mx-auto px-5 mb-6">
        <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-gray-500" />
          촬영 주의사항
        </h2>
        <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5 text-xs text-gray-600 leading-relaxed">
          <p>• 촬영 스케줄은 현지 사정에 따라 변경될 수 있으며, 변경 시 사전 안내드립니다.</p>
          <p>• 우천 시 촬영이 어려울 수 있습니다. 기상 악화 시 일정 변경 또는 실내 촬영으로 대체됩니다.</p>
          <p>• 촬영 시작 시간에 맞춰 촬영 장소에 도착해 주세요. 지각 시 촬영 시간이 단축될 수 있습니다.</p>
          <p>• 촬영된 사진의 보정 및 전달은 촬영일로부터 약 5~7일 소요됩니다.</p>
          <p>• 예약 취소는 촬영일 3일 전까지 가능합니다. 이후 취소 시 환불이 어려울 수 있습니다.</p>
        </div>
      </div>

      {/* ═══ 9. Sticky Bottom Bar ═══ */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100">
        <div className="max-w-md mx-auto px-5 py-4 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            {selectedSchedule ? (
              <p className="text-sm text-gray-700 font-medium truncate">
                {(() => { const dt = fmtDate(selectedSchedule.startTime); return `${dt.m}/${dt.d}(${dt.day})`; })()} · {fmtTime(selectedSchedule.startTime)}
              </p>
            ) : (
              <p className="text-sm text-gray-400">일정을 선택해주세요</p>
            )}
          </div>
          <motion.button
            whileTap={canReserve ? { scale: 0.97 } : undefined}
            onClick={handleReserve}
            disabled={!canReserve || tour.isClosed || sessionStatus === "loading"}
            className={`px-8 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 flex-shrink-0 flex items-center gap-2
              ${canReserve && !tour.isClosed && sessionStatus !== "loading" ? "bg-[#0055FF] text-white shadow-sm active:bg-[#0044CC]" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}
          >
            {sessionStatus === "loading" ? (
              <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>확인 중</>
            ) : tour.isClosed ? "마감됨" : "예약하기"}
          </motion.button>
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>

      {/* ═══ GuestSheet 바텀 시트 ═══ */}
      <GuestSheet
        isOpen={guestSheetOpen}
        onClose={() => setGuestSheetOpen(false)}
        onConfirm={handleGuestConfirm}
      />

      {/* ═══ Global Styles ═══ */}
      <style jsx global>{`
        .tour-swiper .swiper-pagination-bullet { background: white; opacity: 0.5; width: 6px; height: 6px; transition: all 0.3s; }
        .tour-swiper .swiper-pagination-bullet-active { opacity: 1; width: 20px; border-radius: 3px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

// ==================== Map Section (진단 로그 포함) ====================

function MapSection({ tour }: { tour: TourDetail }) {
  const [mapError, setMapError] = useState(false);

  const hasCoords = !!(tour.latitude && tour.longitude);
  const googleMapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";
  const dbMapUrl = tour.googleMapUrl || "";

  // DB URL이 Static Map 이미지 URL인지 판별 (staticmap 포함 여부)
  const isDbUrlStaticMap = dbMapUrl.includes("staticmap") || dbMapUrl.includes("maps.googleapis.com/maps/api/staticmap");

  // 이미지로 보여줄 지도 URL 결정 (우선순위)
  // 1순위: DB의 googleMapUrl이 Static Map URL이면 그대로 사용
  // 2순위: 좌표 + API Key로 직접 생성
  const staticMapUrl = isDbUrlStaticMap
    ? dbMapUrl
    : (hasCoords && googleMapsKey
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${tour.latitude},${tour.longitude}&zoom=17&size=600x300&scale=2&maptype=roadmap&markers=color:blue%7C${tour.latitude},${tour.longitude}&key=${googleMapsKey}`
      : "");

  // 클릭 시 이동할 URL (Static Map 이미지가 아닌, 실제 구글 지도 페이지)
  const mapClickUrl = isDbUrlStaticMap
    ? (hasCoords
      ? `https://www.google.com/maps?q=${tour.latitude},${tour.longitude}`
      : dbMapUrl)
    : (dbMapUrl || (hasCoords ? `https://www.google.com/maps?q=${tour.latitude},${tour.longitude}` : ""));

  // ━━━ 진단 로그 ━━━
  useEffect(() => {
    console.log("━━━ [MAP_DIAG] 구글맵 진단 ━━━");
    console.log(`[MAP_DIAG] 📍 coords: ${tour.latitude ?? "없음"}, ${tour.longitude ?? "없음"}`);
    console.log(`[MAP_DIAG] 🔗 DB googleMapUrl: "${dbMapUrl.substring(0, 80)}${dbMapUrl.length > 80 ? "..." : ""}"`);
    console.log(`[MAP_DIAG] 🖼️ DB URL은 Static Map?: ${isDbUrlStaticMap ? "✅ YES → 직접 사용" : "❌ NO"}`);
    console.log(`[MAP_DIAG] 🖼️ 최종 이미지 URL: ${staticMapUrl ? "있음 ✅" : "없음 ❌"}`);
    console.log(`[MAP_DIAG] 👆 클릭 시 이동: "${mapClickUrl.substring(0, 80)}"`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  }, [tour.latitude, tour.longitude, dbMapUrl, isDbUrlStaticMap, staticMapUrl, mapClickUrl]);

  // 공통 오버레이 배지
  const mapBadge = (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
      <span className="bg-white/95 backdrop-blur-sm text-xs font-semibold text-[#0055FF] px-4 py-2 rounded-full shadow-md flex items-center gap-1.5">
        <MapPin className="w-3.5 h-3.5" />
        지도에서 보기
      </span>
    </div>
  );

  const hoverOverlay = (
    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
  );

  // ✅ 1순위: Static Map 이미지 (DB URL 직접 사용 또는 좌표 기반 생성)
  if (staticMapUrl && !mapError) {
    return (
      <a
        href={mapClickUrl || "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full aspect-[16/9] rounded-2xl overflow-hidden bg-gray-100 mb-4 relative group shadow-sm cursor-pointer"
      >
        <Image
          src={staticMapUrl}
          alt={`${tour.location || tour.name || "투어"} 촬영 장소`}
          fill
          className="object-cover"
          quality={60}
          sizes="(max-width: 768px) 100vw, 512px"
          loading="lazy"
          draggable={false}
          unoptimized
          onError={() => {
            console.error("[MAP_DIAG] ❌ 지도 이미지 로드 실패 → Embed 폴백");
            setMapError(true);
          }}
        />
        {hoverOverlay}
        {mapBadge}
      </a>
    );
  }

  // ✅ 2순위: Embed Fallback
  if (hasCoords || dbMapUrl) {
    const embedQuery = hasCoords
      ? `${tour.latitude},${tour.longitude}`
      : encodeURIComponent(tour.location || tour.name || "");
    return (
      <a
        href={mapClickUrl || dbMapUrl || "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full aspect-[16/9] rounded-2xl overflow-hidden bg-gray-100 mb-4 relative group shadow-sm cursor-pointer"
      >
        <iframe
          src={`https://maps.google.com/maps?q=${embedQuery}&output=embed`}
          className="w-full h-full border-0 pointer-events-none"
          loading="lazy"
          title="촬영 장소"
        />
        {hoverOverlay}
        {mapBadge}
      </a>
    );
  }

  // ✅ 3순위: 빈 placeholder
  return (
    <div className="w-full aspect-[16/9] rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
      <MapPin className="w-8 h-8 text-gray-300" />
    </div>
  );
}
