"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import Image from "next/image";
import {
  Sparkles,
  Check,
  Calendar,
  Clock,
  MapPin,
  Users,
  Camera,
  CreditCard,
  FileText,
  AlertTriangle,
  ExternalLink,
  Gift,
  Ticket,
  Info,
  Palette,
  ArrowRight,
  X,
  Download,
  Brush,
} from "lucide-react";
import { useReservationStore } from "@/lib/reservation-store";
import { useHasMounted } from "@/lib/use-has-mounted";
import { useModal } from "@/components/GlobalModal";
import { CreditBalanceCard, GiftCouponCard } from "@/app/cheiz/components/CreditCard";
import { fetchTourDetail, fetchSchedules } from "@/lib/tour-api";
import { formatKSTTime, formatKSTDate, CREDIT_LABELS, formatCreditSummary } from "@/lib/utils";

function normalizeImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

const AI_RETOUCHING_PRICE = 4980;

// ━━━ 토스트 알림 ━━━
function Toast({ message, visible, onDone }: { message: string; visible: boolean; onDone: () => void }) {
  useEffect(() => {
    if (visible) {
      const t = setTimeout(onDone, 3500);
      return () => clearTimeout(t);
    }
  }, [visible, onDone]);
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[200] max-w-[340px] w-full px-5 py-3.5 bg-gray-900 text-white text-sm font-medium rounded-2xl shadow-xl text-center"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ━━━ 카운트업 애니메이션 숫자 ━━━
function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (value === prev.current) return;
    const from = prev.current;
    const to = value;
    const diff = to - from;
    const steps = Math.min(Math.abs(diff), 15);
    const stepTime = 600 / Math.max(steps, 1);
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setDisplay(Math.round(from + (diff * step) / steps));
      if (step >= steps) { clearInterval(interval); setDisplay(to); }
    }, stepTime);
    prev.current = value;
    return () => clearInterval(interval);
  }, [value]);
  return <>{display}</>;
}

// ━━━ 쿠폰 혜택 아이템 (상세 카드 내) ━━━
function CreditBenefitItem({ count, label }: { count: number; label: typeof CREDIT_LABELS.photo }) {
  if (count <= 0) return null;
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <div className="w-5 h-5 rounded-md bg-[#0055FF]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Check className="w-3 h-3 text-[#0055FF]" />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-800">{label.name} <span className="text-[#0055FF]">{count}{count > 1 ? "장" : "회"}</span></p>
        <p className="text-[11px] text-gray-500 mt-0.5">{label.detailDescription}</p>
      </div>
    </div>
  );
}

// ━━━ 쿠폰 상세 정보 카드 (dryRun 성공 후 노출) ━━━
function CouponDetailCard({
  info,
  onConfirm,
  onCancel,
  loading,
}: {
  info: {
    name: string;
    description: string;
    expiresAt: string | null;
    photoCredits: number;
    aiCredits: number;
    retouchCredits: number;
  };
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.97 }}
      className="mt-4 bg-gradient-to-br from-white to-blue-50/50 rounded-2xl border border-[#0055FF]/15 shadow-lg shadow-blue-500/5 overflow-hidden"
    >
      {/* 상단 헤더 */}
      <div className="bg-gradient-to-r from-[#0055FF] to-[#3377FF] px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gift className="w-4 h-4 text-white/80" />
          <span className="text-white font-bold text-sm">쿠폰 상세 정보</span>
        </div>
        <button onClick={onCancel} className="text-white/60 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 쿠폰 정보 */}
      <div className="p-5">
        <h4 className="text-base font-bold text-gray-900 mb-1">{info.name}</h4>
        {info.description && (
          <p className="text-xs text-gray-500 mb-3 leading-relaxed">{info.description}</p>
        )}
        {info.expiresAt && (
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mb-4">
            <Calendar className="w-3 h-3" />
            <span>유효기간: ~ {new Date(info.expiresAt).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })}</span>
          </div>
        )}

        {/* 혜택 리스트 */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-1">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">포함된 혜택</p>
          <CreditBenefitItem count={info.photoCredits} label={CREDIT_LABELS.photo} />
          <CreditBenefitItem count={info.aiCredits} label={CREDIT_LABELS.ai} />
          <CreditBenefitItem count={info.retouchCredits} label={CREDIT_LABELS.retouch} />
          {info.photoCredits === 0 && info.aiCredits === 0 && info.retouchCredits === 0 && (
            <p className="text-xs text-gray-400 py-2">혜택 정보를 불러올 수 없습니다.</p>
          )}
        </div>
      </div>

      {/* 하단 버튼 */}
      <div className="px-5 pb-5 flex gap-2">
        <button onClick={onCancel} className="flex-1 py-3 text-sm font-bold border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">
          취소
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-[2] py-3 text-sm font-bold bg-[#0055FF] text-white rounded-xl hover:bg-opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {loading ? (
            <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> 등록 중...</>
          ) : (
            <><ArrowRight className="w-4 h-4" /> 쿠폰 등록하기</>
          )}
        </button>
      </div>
    </motion.div>
  );
}

function CheckoutContent() {
  const hasMounted = useHasMounted();
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showAlert, showError } = useModal();
  const tourIdParam = searchParams.get("tour_id");
  const folderIdParam = searchParams.get("folder_id");
  const cancelled = searchParams.get("cancelled");

  const {
    tourId, tour, folderId, guestCount, aiRetouching, setAiRetouching,
    setTour, getTotalSelectedCount,
    creditBalance, appliedCredits, setCreditBalance, setAppliedCredits,
  } = useReservationStore();

  const [processing, setProcessing] = useState(false);
  const [tourLoading, setTourLoading] = useState(false);
  const [creditLoading, setCreditLoading] = useState(true);

  // 쿠폰 리스트
  const [couponList, setCouponList] = useState<Array<{
    id: string; code: string; name: string; description: string;
    type: string; remainingCount: number; expiresAt: string | null;
  }>>([]);

  // 쿠폰 입력 & dryRun 상태
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponMessage, setCouponMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  // dryRun 성공 시 상세 카드 정보
  const [pendingRedeem, setPendingRedeem] = useState<{
    code: string;
    info: {
      name: string; description: string; expiresAt: string | null;
      photoCredits: number; aiCredits: number; retouchCredits: number;
    };
  } | null>(null);

  // 토스트
  const [toast, setToast] = useState({ visible: false, message: "" });
  const showToast = (msg: string) => setToast({ visible: true, message: msg });

  // Hydration-safe
  const safePoseCount = hasMounted ? getTotalSelectedCount() : 0;
  const safeTotalGuests = hasMounted ? guestCount.adults + guestCount.children : 1;
  const safeAiRetouching = hasMounted ? aiRetouching : false;
  const safeAiCredits = hasMounted ? appliedCredits.aiCredits : 0;
  const safeOwnedPhoto = hasMounted ? creditBalance.photoCredits : 0;
  const safeOwnedAi = hasMounted ? creditBalance.aiCredits : 0;
  const safeOwnedRetouch = hasMounted ? creditBalance.retouchCredits : 0;

  // 가격 계산
  const aiSubtotal = safeAiRetouching ? AI_RETOUCHING_PRICE : 0;
  const aiDiscount = safeAiRetouching && safeAiCredits > 0 ? AI_RETOUCHING_PRICE : 0;
  const finalAmount = Math.max(0, aiSubtotal - aiDiscount);

  // ━━━ 크레딧 + 쿠폰 리스트 조회 ━━━
  useEffect(() => {
    if (status === "loading" || !session) return;
    async function fetchCredits() {
      try {
        setCreditLoading(true);
        const res = await fetch("/api/backend/wallet");
        const data = await res.json();
        console.log("[CHECKOUT] 지갑 응답:", JSON.stringify(data).substring(0, 300));
        if (data.success) {
          setCreditBalance({
            photoCredits: data.photoCredits || 0,
            aiCredits: data.aiCredits || 0,
            retouchCredits: data.retouchCredits || 0,
          });
          // 쿠폰 리스트
          if (data.coupons && Array.isArray(data.coupons)) {
            setCouponList(data.coupons.filter((c: any) => c.code || c.remainingCount > 0));
          }
        }
      } catch {
        setCreditBalance({ photoCredits: 0, aiCredits: 0, retouchCredits: 0 });
      } finally {
        setCreditLoading(false);
      }
    }
    fetchCredits();
  }, [status, session, setCreditBalance]);

  // 로그인 리다이렉트
  useEffect(() => {
    if (status === "loading") return;
    if (!session) router.replace("/auth/signin?callbackUrl=/cheiz/reserve/checkout");
  }, [status, session, router]);

  // 투어 Self-healing
  useEffect(() => {
    if (!hasMounted) return;
    const hasTourInfo = tour?.tour_name && tour?.tour_name !== "투어";
    if (!hasTourInfo) {
      const eid = tourIdParam || tourId;
      if (eid && !tourLoading) {
        setTourLoading(true);
        Promise.all([fetchTourDetail(eid, "ko"), fetchSchedules(eid, "ko")])
          .then(([td, schedules]) => {
            if (td) {
              const loc = [td.location, td.locationDetail].filter(Boolean).join(" / ");
              let tDate = tour?.tour_date;
              let tTime = tour?.tour_time;
              if ((!tDate || !tTime) && schedules.length > 0) {
                const sid = searchParams.get("schedule_id");
                const ts = sid ? schedules.find((s: any) => String(s.id) === sid) || schedules[0] : schedules[0];
                if (ts?.startTime) {
                  tDate = tDate || ts.startTime;
                  tTime = tTime || formatKSTTime(ts.startTime);
                }
              }
              setTour({
                _id: String(td.id), tour_Id: td.id, tour_name: td.name,
                tour_thumbnail: td.thumbnailImageUrl || td.images?.[0]?.imageUrl || undefined,
                tour_location: loc || undefined, tour_date: tDate || undefined, tour_time: tTime || undefined,
              });
            }
          })
          .catch(() => {})
          .finally(() => setTourLoading(false));
      }
    }
  }, [hasMounted]);

  // AI 크레딧 토글
  const handleAiCredit = useCallback(() => {
    if (!safeAiRetouching) return;
    if (creditBalance.aiCredits <= 0) {
      showToast("보유하신 수량까지만 사용 가능합니다.");
      return;
    }
    const next = appliedCredits.aiCredits > 0 ? 0 : 1;
    setAppliedCredits({ ...appliedCredits, aiCredits: next });
  }, [appliedCredits, creditBalance, safeAiRetouching, setAppliedCredits]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ✅ 쿠폰 3단계 프로세스
  // 1단계 (조회/Preview): register + dryRun:true → 카드 미리보기
  // 2단계 (등록/Register): register + dryRun:false → 소유권 확정
  // 3단계 (전환/Redeem): redeem → 크레딧 전환
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // ━━━ 1단계: 쿠폰 조회 (Preview) → 상세 카드 노출 ━━━
  const handlePreviewCoupon = async (code?: string) => {
    const theCode = (code || couponCode).trim();
    if (!theCode) return;
    setCouponLoading(true);
    setCouponMessage(null);
    setPendingRedeem(null);
    try {
      const res = await fetch("/api/backend/redeem-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponCode: theCode, action: "preview" }),
      });
      const data = await res.json();
      if (data.success) {
        const credits = data.addedCredits || {};
        const info = data.couponInfo || {};
        setPendingRedeem({
          code: theCode,
          info: {
            name: info.name || "쿠폰",
            description: info.description || "",
            expiresAt: info.expiresAt || null,
            photoCredits: credits.photoCredits || 0,
            aiCredits: credits.aiCredits || 0,
            retouchCredits: credits.retouchCredits || 0,
          },
        });
        setCouponMessage(null);
      } else {
        setCouponMessage({ type: "error", text: data.error || "유효하지 않은 쿠폰입니다." });
      }
    } catch {
      setCouponMessage({ type: "error", text: "쿠폰 조회 중 오류가 발생했습니다." });
    } finally {
      setCouponLoading(false);
    }
  };

  // ━━━ 2단계: 쿠폰 등록 (Register) → 소유권 확정, 리스트에 추가 ━━━
  const handleRegisterCoupon = async () => {
    if (!pendingRedeem) return;
    setCouponLoading(true);
    try {
      const res = await fetch("/api/backend/redeem-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponCode: pendingRedeem.code, action: "register" }),
      });
      const data = await res.json();
      if (data.success) {
        const info = data.couponInfo || pendingRedeem.info;
        // ✅ 등록 성공 → 쿠폰 리스트에 추가 (아직 크레딧 전환 안 됨)
        const newCoupon = {
          id: `registered-${Date.now()}`,
          code: pendingRedeem.code,
          name: info.name || "등록된 쿠폰",
          description: info.description || "",
          type: info.photoCredits > 0 ? "PHOTO" : info.aiCredits > 0 ? "AI_RETOUCH" : "RETOUCH",
          remainingCount: (info.photoCredits || 0) + (info.aiCredits || 0) + (info.retouchCredits || 0),
          expiresAt: info.expiresAt || null,
        };
        setCouponList(prev => [...prev, newCoupon]);
        setCouponMessage({ type: "success", text: `✅ "${info.name}" 쿠폰이 등록되었습니다. 아래 리스트에서 크레딧으로 전환하세요.` });
        showToast(`✅ 쿠폰 등록 완료!`);
        setCouponCode("");
        setPendingRedeem(null);
      } else {
        setCouponMessage({ type: "error", text: data.error || "쿠폰 등록에 실패했습니다." });
        setPendingRedeem(null);
      }
    } catch {
      setCouponMessage({ type: "error", text: "쿠폰 등록 중 오류가 발생했습니다." });
      setPendingRedeem(null);
    } finally {
      setCouponLoading(false);
    }
  };

  // ━━━ 3단계: 크레딧 전환 (Redeem) → 쿠폰 리스트에서 호출 ━━━
  const handleRedeemToCredits = async (code: string) => {
    setCouponLoading(true);
    setCouponMessage(null);
    try {
      const res = await fetch("/api/backend/redeem-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponCode: code, action: "redeem" }),
      });
      const data = await res.json();
      if (data.success) {
        const added = data.addedCredits || {};
        setCreditBalance({
          photoCredits: creditBalance.photoCredits + (added.photoCredits || 0),
          aiCredits: creditBalance.aiCredits + (added.aiCredits || 0),
          retouchCredits: creditBalance.retouchCredits + (added.retouchCredits || 0),
        });
        const summary = formatCreditSummary(added);
        setCouponMessage({ type: "success", text: `전환 완료! ${summary}이 추가되었습니다.` });
        showToast(`✅ ${summary} 충전 완료!`);
        setCouponList(prev => prev.filter(c => c.code !== code));
      } else {
        setCouponMessage({ type: "error", text: data.error || "크레딧 전환에 실패했습니다." });
      }
    } catch {
      setCouponMessage({ type: "error", text: "크레딧 전환 중 오류가 발생했습니다." });
    } finally {
      setCouponLoading(false);
    }
  };

  // ━━━ 결제/예약 확정 ━━━
  const handleCheckout = async () => {
    if (finalAmount > 0 && finalAmount < 500) { await showAlert("결제 최소 금액은 500원입니다."); return; }
    setProcessing(true);
    try {
      const safeTourId = tourIdParam || tourId;
      const safeFolderId = folderIdParam || folderId;
      // 0원 하이패스
      if (finalAmount === 0) {
        console.log("[CHECKOUT] 🎉 0원 하이패스! Stripe 건너뛰고 즉시 예약 확정");
        let url = `/cheiz/reserve/success?tour_id=${safeTourId}&no_payment=true`;
        if (safeFolderId) url += `&folder_id=${safeFolderId}`;
        router.push(url);
        return;
      }
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiRetouching: safeAiRetouching, tourId: safeTourId,
          tourName: tour?.tour_name || "투어", poseCount: safePoseCount,
          folderId: safeFolderId || null, totalAmount: finalAmount,
          appliedCredits: { aiCredits: safeAiCredits },
        }),
      });
      const data = await res.json();
      if (data.skipPayment) {
        let url = `/cheiz/reserve/success?tour_id=${safeTourId}&no_payment=true`;
        if (safeFolderId) url += `&folder_id=${safeFolderId}`;
        router.push(url);
      } else if (data.url) {
        window.location.href = data.url;
      } else {
        await showError("결제 세션 생성에 실패했습니다.", { showKakaoLink: true });
      }
    } catch {
      await showError("결제 처리 중 오류가 발생했습니다.", { showKakaoLink: true });
    } finally {
      setProcessing(false);
    }
  };

  // 쿠폰 타입 → 아이콘 + 라벨 (✅ SNAP → PHOTO 강제 치환 포함)
  const couponTypeInfo = (type: string) => {
    const t = type.toUpperCase();
    // ✅ SNAP = PHOTO (백엔드가 SNAP으로 보내도 "사진 다운로드권"으로 표시)
    if (t === "PHOTO" || t === "DOWNLOAD" || t === "SNAP" || t === "SNAP_DOWNLOAD") return { label: CREDIT_LABELS.photo.short, icon: <Download className="w-3.5 h-3.5" />, color: "text-[#0055FF]" };
    if (t === "AI" || t === "AI_RETOUCH") return { label: CREDIT_LABELS.ai.short, icon: <Sparkles className="w-3.5 h-3.5" />, color: "text-purple-600" };
    if (t === "RETOUCH") return { label: CREDIT_LABELS.retouch.short, icon: <Brush className="w-3.5 h-3.5" />, color: "text-amber-600" };
    return { label: "쿠폰", icon: <Gift className="w-3.5 h-3.5" />, color: "text-gray-600" };
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] pb-36">
      {/* ━━━ Header ━━━ */}
      <div className="bg-white sticky top-0 z-40 border-b border-gray-100">
        <div className="max-w-md mx-auto px-5 py-3 flex items-center justify-between">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-[#0055FF] text-sm flex items-center gap-1">
            <span className="text-lg">&#8249;</span> 돌아가기
          </button>
          <h1 className="text-sm font-bold text-gray-900">예약정보 확인</h1>
          <div className="w-16" />
        </div>
      </div>

      {cancelled && (
        <div className="max-w-md mx-auto px-5 pt-4">
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center text-sm text-orange-700">
            결제가 취소되었습니다. 다시 시도해주세요.
          </div>
        </div>
      )}

      {/* ━━━ 섹션 1: 투어 정보 ━━━ */}
      <div className="max-w-md mx-auto px-5 pt-5 pb-2">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5">
            <div className="flex gap-4">
              <div className="w-24 h-24 rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0 relative">
                {hasMounted && tour?.tour_thumbnail ? (
                  <Image src={normalizeImageUrl(tour.tour_thumbnail) || ""} alt={tour.tour_name || "Tour"} fill className="object-cover" quality={60} sizes="96px" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Camera className="w-8 h-8 text-gray-300" /></div>
                )}
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h3 className="font-bold text-gray-900 text-base leading-tight mb-2">
                  {hasMounted ? (tour?.tour_name || "투어") : "투어"}
                </h3>
                <div className="space-y-1.5">
                  {hasMounted && tour?.tour_location && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#0055FF] flex-shrink-0" />
                      <span className="text-xs text-gray-600 font-medium">{tour.tour_location}</span>
                    </div>
                  )}
                  {hasMounted && tour?.tour_date && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#0055FF] flex-shrink-0" />
                      <span className="text-xs text-gray-600 font-medium">{formatKSTDate(tour.tour_date)}</span>
                    </div>
                  )}
                  {hasMounted && tour?.tour_time && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#0055FF] flex-shrink-0" />
                      <span className="text-xs text-gray-600 font-medium">{formatKSTTime(tour.tour_time)}</span>
                    </div>
                  )}
                  {hasMounted && !tour?.tour_date && !tour?.tour_time && tourLoading && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
                      <span className="text-xs text-gray-400">일정 정보 불러오는 중...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ━━━ 섹션 2: 인원 + 포즈 ━━━ */}
      <div className="max-w-md mx-auto px-5 py-2">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0055FF]/10 flex items-center justify-center"><Users className="w-5 h-5 text-[#0055FF]" /></div>
              <div><p className="text-sm font-semibold text-gray-900">촬영 인원</p><p className="text-xs text-gray-400">촬영 참여 인원</p></div>
            </div>
            <p className="text-lg font-bold text-gray-900">{safeTotalGuests}명</p>
          </div>
          <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center"><Camera className="w-5 h-5 text-purple-500" /></div>
              <div><p className="text-sm font-semibold text-gray-900">선택 포즈</p><p className="text-xs text-gray-400">포즈 예약 무료</p></div>
            </div>
            <p className="text-lg font-bold text-gray-900">{safePoseCount}개</p>
          </div>
        </motion.div>
      </div>

      {/* ━━━ 섹션 3: AI 보정 옵션 ━━━ */}
      <div className="max-w-md mx-auto px-5 py-2">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div onClick={() => setAiRetouching(!safeAiRetouching)} className={`flex items-center justify-between cursor-pointer transition-all rounded-xl p-3 -m-1 ${safeAiRetouching ? "bg-[#0055FF]/5" : "bg-transparent"}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${safeAiRetouching ? "bg-[#0055FF]/10" : "bg-gray-100"}`}>
                <Sparkles className={`w-5 h-5 ${safeAiRetouching ? "text-[#0055FF]" : "text-gray-400"}`} />
              </div>
              <div>
                <p className={`text-sm font-semibold ${safeAiRetouching ? "text-[#0055FF]" : "text-gray-700"}`}>{CREDIT_LABELS.ai.name}</p>
                <p className="text-xs text-gray-400">{CREDIT_LABELS.ai.detailDescription}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-gray-700">{AI_RETOUCHING_PRICE.toLocaleString()}원</span>
              <div className={`w-12 h-[26px] rounded-full flex items-center transition-all ${safeAiRetouching ? "bg-[#0055FF] justify-end" : "bg-gray-300 justify-start"}`}>
                <div className="w-[20px] h-[20px] rounded-full bg-white shadow-md mx-[3px]" />
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ━━━ 섹션 4: 나의 보유 크레딧 & 쿠폰 ━━━ */}
      <div className="max-w-md mx-auto px-5 py-2">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-1.5">
            <Gift className="w-4 h-4 text-[#0055FF]" /> 나의 보유 크레딧
          </h4>

          {/* ✅ 잔액 카드 + AI 리터칭 인라인 적용 버튼 통합 */}
          <CreditBalanceCard
            photo={safeOwnedPhoto}
            ai={safeOwnedAi}
            retouch={safeOwnedRetouch}
            loading={creditLoading}
            aiRetouchingEnabled={safeAiRetouching}
            aiApplied={safeAiCredits > 0}
            onAiToggle={handleAiCredit}
          />
          {safeAiCredits > 0 && (
            <p className="text-xs text-green-600 flex items-center gap-1 mb-3"><Check className="w-3.5 h-3.5" />AI 리터칭 비용이 크레딧으로 차감됩니다.</p>
          )}

          {/* 크레딧 가치 설명 */}
          <div className="space-y-2 mb-4 bg-gray-50 rounded-xl p-3.5">
            <div className="flex items-start gap-2 text-[11px] text-gray-500">
              <Download className="w-3 h-3 text-[#0055FF] flex-shrink-0 mt-0.5" />
              <span><b className="text-gray-700">{CREDIT_LABELS.photo.name}</b> — {CREDIT_LABELS.photo.detailDescription}</span>
            </div>
            <div className="flex items-start gap-2 text-[11px] text-gray-500">
              <Sparkles className="w-3 h-3 text-purple-500 flex-shrink-0 mt-0.5" />
              <span><b className="text-gray-700">{CREDIT_LABELS.ai.name}</b> — {CREDIT_LABELS.ai.detailDescription}</span>
            </div>
            <div className="flex items-start gap-2 text-[11px] text-gray-500">
              <Brush className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
              <span><b className="text-gray-700">{CREDIT_LABELS.retouch.name}</b> — {CREDIT_LABELS.retouch.detailDescription}</span>
            </div>
          </div>

          {/* ━━━ 쿠폰 리스트 (가로 스크롤, GiftCouponCard compact) ━━━ */}
          {couponList.length > 0 && (
            <div className="border-t border-gray-100 pt-4 mb-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">보유 쿠폰</p>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
                {couponList.map((c) => {
                  const t = c.type?.toUpperCase() || "";
                  const isPhoto = t === "PHOTO" || t === "SNAP" || t === "DOWNLOAD";
                  const isAi = t === "AI" || t === "AI_RETOUCH";
                  return (
                    <GiftCouponCard
                      key={c.id}
                      variant="compact"
                      name={c.name}
                      description={c.description}
                      photoCredits={isPhoto ? c.remainingCount : 0}
                      aiCredits={isAi ? c.remainingCount : 0}
                      retouchCredits={!isPhoto && !isAi ? c.remainingCount : 0}
                      actionLabel="크레딧으로 전환하기"
                      onAction={() => handleRedeemToCredits(c.code)}
                      loading={couponLoading}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* 쿠폰 코드 직접 입력 */}
          <div className="border-t border-gray-100 pt-4 mt-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">쿠폰 코드 입력</p>
            <div className="flex gap-2">
              <input type="text" value={couponCode}
                onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponMessage(null); setPendingRedeem(null); }}
                placeholder="쿠폰 코드를 입력하세요"
                className="flex-1 h-11 px-4 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0055FF] transition-colors placeholder:text-gray-400" />
              <button onClick={() => handlePreviewCoupon()} disabled={couponLoading || !couponCode.trim()}
                className="h-11 px-5 bg-[#0055FF] text-white text-sm font-bold rounded-xl disabled:opacity-40 hover:bg-opacity-90 transition-all flex-shrink-0">
                {couponLoading ? "..." : "조회"}
              </button>
            </div>

            {/* ━━━ dryRun 성공 → 쿠폰 상세 카드 ━━━ */}
            <AnimatePresence>
              {pendingRedeem && (
                <CouponDetailCard
                  info={pendingRedeem.info}
                  onConfirm={handleRegisterCoupon}
                  onCancel={() => { setPendingRedeem(null); setCouponMessage(null); }}
                  loading={couponLoading}
                />
              )}
            </AnimatePresence>

            {/* 성공/에러 메시지 */}
            <AnimatePresence>
              {couponMessage && !pendingRedeem && (
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                  className={`mt-3 text-xs px-4 py-3 rounded-xl ${couponMessage.type === "success" ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-600 border border-red-100"}`}>
                  <p>{couponMessage.type === "success" ? "✅ " : "❌ "}{couponMessage.text}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* ━━━ 섹션 5: 결제 요약 ━━━ */}
      <div className="max-w-md mx-auto px-5 py-2">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5"><CreditCard className="w-4 h-4 text-gray-500" /> 결제 금액</h4>
          <div className="space-y-2.5">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">포즈 예약 ({safePoseCount}개)</span>
              <span className="text-gray-800 font-medium">무료</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-gray-400" /><span className="text-gray-600">{CREDIT_LABELS.ai.name}</span></div>
              {safeAiRetouching ? <span className="text-gray-800 font-medium">+{AI_RETOUCHING_PRICE.toLocaleString()}원</span>
                : <span className="text-gray-400 text-xs font-medium bg-gray-100 px-2 py-0.5 rounded-full">미포함</span>}
            </div>
            {safeAiRetouching && safeAiCredits > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-green-600 flex items-center gap-1"><Ticket className="w-3.5 h-3.5" />{CREDIT_LABELS.ai.short} 적용</span>
                <span className="text-green-600 font-bold">-{AI_RETOUCHING_PRICE.toLocaleString()}원</span>
              </div>
            )}
            <div className="border-t border-dashed border-gray-200 pt-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-900">최종 결제 금액</span>
                <div className="text-right"><span className="font-bold text-2xl text-gray-900">{finalAmount.toLocaleString()}</span><span className="text-sm font-normal text-gray-500 ml-0.5">원</span></div>
              </div>
            </div>
          </div>
          {finalAmount === 0 && safeAiRetouching && safeAiCredits > 0 && (
            <p className="text-[11px] text-green-600 mt-3 text-center leading-relaxed font-medium">크레딧이 적용되어 결제 없이 예약이 진행됩니다.</p>
          )}
        </motion.div>
      </div>

      {/* ━━━ 섹션 6: 상품 정책 ━━━ */}
      <div className="max-w-md mx-auto px-5 py-2">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5"><FileText className="w-4 h-4 text-gray-500" /> 상품 정책 안내</h4>
          <div className="space-y-4 text-xs text-gray-600 leading-relaxed">
            <div>
              <p className="font-semibold text-gray-800 mb-1.5 text-[13px]">상품 정책 및 동의서</p>
              <ul className="space-y-1 list-disc list-inside text-gray-500">
                <li>해당 상품은 여행자 보험이 포함되지 않은 상품입니다.</li>
                <li>기상 상황 등 불가항력적인 사유 발생 시, 일부 코스가 변경될 수 있습니다.</li>
                <li>촬영 데이터는 촬영일 기준 7일 이내 전달됩니다.</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-gray-800 mb-1.5 text-[13px]">환불 안내</p>
              <ul className="space-y-1 list-disc list-inside text-gray-500">
                <li>촬영일 7일 전: 전액 환불 / 3~6일 전: 50% / 2일 전~당일: 환불 불가</li>
              </ul>
            </div>
            <div className="flex items-start gap-2 bg-orange-50 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
              <p className="text-orange-600 text-[11px]">만 19세 미만 미성년자는 법정대리인 동의 없이 결제 불가</p>
            </div>
          </div>
          <div className="border-t border-gray-100 my-4" />
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <a href="https://www.lifeshot.me/version-test/privacy" target="_blank" rel="noopener noreferrer" className="text-[#0055FF] hover:underline flex items-center gap-0.5">개인정보처리방침 <ExternalLink className="w-3 h-3" /></a>
            <span className="text-gray-300">|</span>
            <a href="https://lifeshot.notion.site" target="_blank" rel="noopener noreferrer" className="text-[#0055FF] hover:underline flex items-center gap-0.5">이용약관 <ExternalLink className="w-3 h-3" /></a>
          </div>
        </motion.div>
      </div>

      {/* ━━━ Fixed Bottom CTA ━━━ */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 z-50">
        <div className="max-w-md mx-auto px-5 py-4">
          <p className="text-center text-[11px] text-gray-400 mb-3 leading-relaxed">
            결제 및 예약을 진행하면 위 상품 정책, 환불 규정 및 개인정보 처리방침에 동의하는 것으로 간주됩니다.
          </p>
          <button onClick={handleCheckout} disabled={processing}
            className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all ${processing ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-[#0055FF] text-white shadow-lg shadow-blue-500/25 active:scale-[0.98]"}`}>
            {processing ? (<><div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white border-solid" />처리 중...</>)
              : finalAmount > 0 ? (<><CreditCard className="w-5 h-5" />{finalAmount.toLocaleString()}원 결제하기</>)
              : (<><Check className="w-5 h-5" />{safeAiCredits > 0 ? "크레딧으로 예약 확정하기" : "예약 확정하기"}</>)}
          </button>
        </div>
      </div>

      {/* 토스트 */}
      <Toast message={toast.message} visible={toast.visible} onDone={() => setToast(p => ({ ...p, visible: false }))} />
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center"><div className="animate-spin rounded-full h-16 w-16 border-t-4 border-[#0055FF] border-solid" /></div>}>
      <CheckoutContent />
    </Suspense>
  );
}
