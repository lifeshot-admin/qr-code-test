"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Download, Brush, CreditCard, Check,
  Loader2, Camera, Tag, ChevronDown, ChevronUp, Gift,
  Minus, Plus, Star, User, Mail, FileText, AlertCircle,
  Ticket, ExternalLink, Sparkles, Copy, CheckCircle2,
} from "lucide-react";
import SecureImage from "@/components/SecureImage";

// ━━━ 기본 단가 ━━━
const DEFAULT_PHOTO_PRICE = 1000;
const DEFAULT_RETOUCH_PRICE = 15000;

// ━━━ 크레딧 Stepper ━━━
function CreditStepper({
  label, icon: Icon, color, value, max, onChange,
}: {
  label: string; icon: any; color: string;
  value: number; max: number; onChange: (v: number) => void;
}) {
  return (
    <div className={`rounded-xl p-3 ${color}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5" />
          <span className="text-xs font-bold">{label}</span>
        </div>
        <span className="text-[10px] text-gray-500">최대 {max}장</span>
      </div>
      <div className="flex items-center justify-center gap-4">
        <button onClick={() => onChange(Math.max(0, value - 1))} disabled={value <= 0}
          className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center active:scale-90 disabled:opacity-30 transition-all">
          <Minus className="w-4 h-4 text-gray-600" />
        </button>
        <div className="min-w-[3rem] text-center">
          <span className="text-xl font-extrabold text-gray-900">{value}</span>
          <span className="text-xs text-gray-400 ml-0.5">장</span>
        </div>
        <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
          className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center active:scale-90 disabled:opacity-30 transition-all">
          <Plus className="w-4 h-4 text-gray-600" />
        </button>
      </div>
      <div className="mt-2 h-1 bg-white/60 rounded-full overflow-hidden">
        <div className="h-full bg-current rounded-full transition-all" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

function RedeemContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const folderId = params?.folderId as string;
  const photoIds = (searchParams.get("photos") || "").split(",").filter(Boolean);
  const retouchPhotoIds = (searchParams.get("retouchPhotos") || "").split(",").filter(Boolean);
  const retoucherId = searchParams.get("retoucherId") || "";

  // Checkout 복귀 시 photos 쿼리가 없으므로 n/m 파라미터를 폴백으로 사용
  const urlN = parseInt(searchParams.get("n") || "0", 10);
  const urlM = parseInt(searchParams.get("m") || "0", 10);
  const N = photoIds.length || urlN;
  const M = retouchPhotoIds.length || urlM;

  // ━━━ 상태 ━━━
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [paymentStep, setPaymentStep] = useState("");

  // ━━━ 크레딧 ━━━
  const [credits, setCredits] = useState({ photo: 0, ai: 0, retouch: 0 });
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [photoCreditsUse, setPhotoCreditsUse] = useState(0);
  const [retouchCreditsUse, setRetouchCreditsUse] = useState(0);

  // ━━━ 리터쳐 ━━━
  const [retoucher, setRetoucher] = useState<any>(null);
  const RETOUCH_PRICE = retoucher?.pricePerPhoto || DEFAULT_RETOUCH_PRICE;

  // ━━━ 사진 썸네일 ━━━
  const [allPhotos, setAllPhotos] = useState<any[]>([]);

  // 크레딧 로드
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/backend/wallet");
        const data = await res.json();
        if (data.success) {
          const pc = data.photoCredits || 0;
          const rc = data.retouchCredits || 0;
          setCredits({ photo: pc, ai: data.aiCredits || 0, retouch: rc });
          // ✅ [C] Stepper 시작값 0 — 유저가 직접 조절
          setPhotoCreditsUse(0);
          setRetouchCreditsUse(0);
        }
      } catch {}
      finally { setCreditsLoading(false); }
    })();
  }, [N, M]);

  // 리터쳐 로드
  useEffect(() => {
    if (!retoucherId) return;
    (async () => {
      try {
        const res = await fetch("/api/backend/retouchers");
        const data = await res.json();
        if (data.success && data.retoucher) setRetoucher(data.retoucher);
      } catch {}
    })();
  }, [retoucherId]);

  // 사진 썸네일
  useEffect(() => {
    if (!folderId) return;
    (async () => {
      try {
        const res = await fetch(`/api/backend/folder-photos?folderId=${folderId}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.photos)) {
          setAllPhotos(data.photos.map((p: any) => ({
            id: String(p.id ?? p.photoId ?? p._id ?? Math.random()),
            url: p.url || p.imageUrl || p.originalUrl || p.photoUrl || "",
            thumbnailUrl: p.thumbnailUrl || p.thumbUrl || p.url || p.imageUrl || "",
          })));
        }
      } catch {}
    })();
  }, [folderId]);

  // ━━━ 방어 로직 ━━━
  const maxPhotoCredits = Math.min(credits.photo, N);
  const maxRetouchCredits = Math.min(credits.retouch, M);
  useEffect(() => { if (photoCreditsUse > maxPhotoCredits) setPhotoCreditsUse(maxPhotoCredits); }, [maxPhotoCredits, photoCreditsUse]);
  useEffect(() => { if (retouchCreditsUse > maxRetouchCredits) setRetouchCreditsUse(maxRetouchCredits); }, [maxRetouchCredits, retouchCreditsUse]);

  // ━━━ 계산식 ━━━
  const photoTotalPrice = N * DEFAULT_PHOTO_PRICE;
  const photoDiscount = photoCreditsUse * DEFAULT_PHOTO_PRICE;
  const photoFinal = photoTotalPrice - photoDiscount;

  const retouchTotalPrice = M * RETOUCH_PRICE;
  const retouchDiscount = retouchCreditsUse * RETOUCH_PRICE;
  const retouchFinal = retouchTotalPrice - retouchDiscount;

  const totalOriginal = photoTotalPrice + retouchTotalPrice;
  const totalDiscount = photoDiscount + retouchDiscount;
  const totalFinal = photoFinal + retouchFinal;

  const getPhotoThumb = (id: string) => {
    const p = allPhotos.find(x => x.id === id);
    return p?.thumbnailUrl || p?.url || "";
  };

  // ━━━ 결제 파이프라인: POST orders/photo → (0원: complete | 유료: Checkout) ━━━
  const handlePayment = useCallback(async () => {
    setProcessing(true);
    setError("");

    try {
      // ━━━ Step A: 크레딧 포함 주문서 생성 (POST /api/v1/orders/photo) ━━━
      setPaymentStep("주문서 생성 중...");
      console.log("[PAYMENT] 🚀 Step A: 크레딧 포함 주문서 생성...");

      const toInt = (v: any) => { const n = parseInt(String(v), 10); return isNaN(n) ? null : n; };

      const credit: Record<string, number> = {};
      if (photoCreditsUse > 0) credit.PHOTO = photoCreditsUse;
      if (retouchCreditsUse > 0) credit.RETOUCH = retouchCreditsUse;

      const orderBody = {
        folderId: toInt(folderId) ?? folderId,
        rawPhotoIds: photoIds.map(toInt).filter((n): n is number => n !== null),
        detailPhotoIds: retouchPhotoIds.map(toInt).filter((n): n is number => n !== null),
        colorPhotoIds: [] as number[],
        issuedCouponIds: [] as number[],
        retoucherId: retoucherId ? Number(retoucherId) : null,
        credit: Object.keys(credit).length > 0 ? credit : undefined,
      };

      console.log("[PAYMENT] 📦 주문 body:", JSON.stringify(orderBody).substring(0, 600));
      console.log("[PAYMENT] 🎫 credit:", JSON.stringify(credit), "| 프론트 계산 totalFinal:", totalFinal);

      const orderRes = await fetch("/api/backend/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderBody),
      });
      const orderData = await orderRes.json();
      console.log("[PAYMENT] 📦 주문 응답:", JSON.stringify(orderData).substring(0, 500));

      if (!orderData.success || !orderData.orderId) {
        console.error("[PAYMENT] 주문 생성 실패:", orderData.error || "orderId 없음");
        throw new Error("ORDER_FAIL");
      }

      const photoOrderId = orderData.orderId;
      const backendPayment = orderData.totalPayment;

      // 프론트 강제 가드: 크레딧이 사진 수를 완전히 커버하면 무조건 0원 처리
      const creditCoversAll = (photoCreditsUse >= N) && (M === 0 || retouchCreditsUse >= M);
      const actualPayment = creditCoversAll ? 0 : (typeof backendPayment === "number" ? backendPayment : totalFinal);

      console.log("[PAYMENT] ✅ orderId:", photoOrderId);
      console.log("[PAYMENT]   백엔드 totalPayment:", backendPayment, "| 프론트 totalFinal:", totalFinal);
      console.log("[PAYMENT]   크레딧 커버:", creditCoversAll, `(photo: ${photoCreditsUse}/${N}, retouch: ${retouchCreditsUse}/${M})`);
      console.log("[PAYMENT]   → 최종 적용 금액:", actualPayment);

      // ━━━ 0원 결제: Stripe 건너뛰고 백엔드 직접 완료 → 앨범 생성 ━━━
      if (actualPayment <= 0) {
        setPaymentStep("크레딧 결제 완료 처리 중...");
        console.log("[PAYMENT] 💎 0원 결제 — POST /api/v1/payments/photo/" + photoOrderId);

        const freeRes = await fetch("/api/backend/payments/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoOrderId }),
        });
        const freeData = await freeRes.json();
        console.log("[PAYMENT] 📦 0원 완료 응답:", JSON.stringify(freeData).substring(0, 500));

        if (!freeData.success) {
          console.error("[PAYMENT] 크레딧 결제 완료 실패:", freeData.error || "unknown");
          throw new Error("FREE_FAIL");
        }

        console.log("[PAYMENT] ✅ 크레딧 결제 완료 → 앨범 생성 트리거 성공");
        setCompletedOrderId(String(photoOrderId));
        setCompletedN(N);
        setCompletedM(M);
        setCompletedPaid(0);
        setDone(true);
        return;
      }

      // ━━━ Step B: Stripe Checkout Session 생성 → 결제 페이지로 리다이렉트 ━━━
      setPaymentStep("결제 페이지 준비 중...");
      console.log("[PAYMENT] 🚀 Step B: Checkout Session — orderId:", photoOrderId, "| amount:", actualPayment);

      const checkoutRes = await fetch("/api/backend/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoOrderId,
          amount: actualPayment,
          folderId,
          n: N,
          m: M,
          origin: window.location.origin,
        }),
      });
      const checkoutData = await checkoutRes.json();
      console.log("[PAYMENT] 📦 Checkout 응답:", JSON.stringify(checkoutData).substring(0, 500));

      if (!checkoutData.success || !checkoutData.url) {
        console.error("[PAYMENT] Checkout URL 확보 실패:", checkoutData.error || "URL 없음");
        throw new Error("PAY_FAIL");
      }

      console.log("[PAYMENT] ✅ Checkout URL 확보 → 결제 페이지로 이동");
      window.location.href = checkoutData.url;

    } catch (e: any) {
      console.error("[PAYMENT] ❌ 파이프라인 에러:", e.message, e.stack);
      const userMsg =
        e.message === "ORDER_FAIL" ? "주문 생성에 실패했습니다. 잠시 후 다시 시도해 주세요."
        : e.message === "PAY_FAIL" ? "결제 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
        : e.message === "FREE_FAIL" ? "크레딧 결제 처리에 실패했습니다. 잠시 후 다시 시도해 주세요."
        : "결제 시스템 점검 중입니다. 잠시 후 다시 시도해 주세요.";
      setError(userMsg);
    } finally {
      setProcessing(false);
      setPaymentStep("");
    }
  }, [folderId, photoIds, retouchPhotoIds, retoucherId, photoCreditsUse, retouchCreditsUse, totalFinal]);

  // ━━━ Checkout 리다이렉트 복귀 상태 ━━━
  const [completedOrderId, setCompletedOrderId] = useState<string | null>(null);
  const [redirectStatus, setRedirectStatus] = useState<string | null>(null);
  const [completedN, setCompletedN] = useState(0);
  const [completedM, setCompletedM] = useState(0);
  const [completedPaid, setCompletedPaid] = useState(0);
  const [orderIdCopied, setOrderIdCopied] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const checkoutSuccess = searchParams.get("checkout_success");
    const checkoutCancelled = searchParams.get("checkout_cancelled");
    const sessionId = searchParams.get("session_id");
    const orderId = searchParams.get("orderId");
    const paramN = parseInt(searchParams.get("n") || "0", 10);
    const paramM = parseInt(searchParams.get("m") || "0", 10);
    const paramPaid = parseInt(searchParams.get("paid") || "0", 10);

    // 결제 취소로 돌아온 경우 — 상태 복원 + URL 세탁
    if (checkoutCancelled) {
      if (paramN) setCompletedN(paramN);
      if (paramM) setCompletedM(paramM);
      if (orderId) setCompletedOrderId(orderId);
      setError("결제가 취소되었습니다. 다시 시도해 주세요.");

      // Stripe URL을 히스토리에서 제거 (뒤로가기 시 Stripe로 안 돌아감)
      const cleanUrl = `${window.location.pathname}`;
      window.history.replaceState(null, "", cleanUrl);
      return;
    }

    // 결제 성공으로 돌아온 경우 → 서버에서 Session 검증 + 앨범 생성 트리거
    if (checkoutSuccess && sessionId && !done && !verifying) {
      setVerifying(true);
      setPaymentStep("결제 확인 중...");

      console.log("[CHECKOUT_RETURN] 🔍 Session 검증 시작 — sessionId:", sessionId);

      (async () => {
        try {
          const res = await fetch("/api/backend/payments/verify-checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          });
          const data = await res.json();
          console.log("[CHECKOUT_RETURN] 📦 검증 응답:", JSON.stringify(data).substring(0, 500));

          if (data.success) {
            setCompletedOrderId(orderId || data.orderId);
            setCompletedN(paramN || N);
            setCompletedM(paramM || M);
            setCompletedPaid(paramPaid);
            setRedirectStatus("succeeded");
            setDone(true);
            // 성공 후에도 URL 세탁 — 새로고침 시 중복 검증 방지
            window.history.replaceState(null, "", window.location.pathname);
          } else {
            setError(data.error || "결제 확인에 실패했습니다. 고객센터에 문의해 주세요.");
          }
        } catch (e: any) {
          console.error("[CHECKOUT_RETURN] ❌ 검증 에러:", e.message);
          setError("결제 확인 중 오류가 발생했습니다. 고객센터에 문의해 주세요.");
        } finally {
          setVerifying(false);
          setPaymentStep("");
        }
      })();
    }
  }, [searchParams, N, M, done, verifying]);

  // ━━━ 주문번호 복사 ━━━
  const handleCopyOrderId = useCallback(() => {
    if (completedOrderId) {
      navigator.clipboard.writeText(completedOrderId).then(() => {
        setOrderIdCopied(true);
        setTimeout(() => setOrderIdCopied(false), 2000);
      });
    }
  }, [completedOrderId]);

  // ━━━ 결제/앨범 생성 완료 화면 ━━━
  if (done) {
    const displayN = completedN || N;
    const displayM = completedM || M;
    const displayPaid = completedPaid || totalFinal;
    const nickname = (session?.user as any)?.nickname || (session?.user as any)?.name || "";
    const firstThumb = allPhotos[0]?.thumbnailUrl || allPhotos[0]?.url || "";

    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0a0a] to-[#1a1a2e] flex flex-col items-center justify-center px-5 relative overflow-hidden">
        {/* 배경 블러 사진 */}
        {firstThumb && (
          <div className="absolute inset-0 z-0">
            <img src={firstThumb} alt="" className="w-full h-full object-cover opacity-20 blur-2xl scale-110" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80" />
          </div>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }} className="w-full max-w-sm relative z-10">

          {/* 성공 아이콘 */}
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-20 h-20 mx-auto mb-5 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/30">
            <Check className="w-10 h-10 text-white" strokeWidth={3} />
          </motion.div>

          {/* 메인 메시지 */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }} className="text-center mb-6">
            <h2 className="text-2xl font-extrabold text-white mb-2">
              앨범 생성 완료!
            </h2>
            {nickname && (
              <p className="text-sm text-white/70 mb-1">
                {nickname}님의 Cheiz 앨범
              </p>
            )}
            <p className="text-xs text-white/50 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              {displayPaid > 0 ? `${displayPaid.toLocaleString()}원 결제 완료` : "크레딧 결제 완료"}
            </p>
          </motion.div>

          {/* 주문 상세 카드 */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden mb-4">

            {completedOrderId && (
              <div className="px-5 py-3 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/40">주문번호</span>
                  <button onClick={handleCopyOrderId}
                    className="flex items-center gap-1.5 text-[11px] active:scale-95 transition-all">
                    <span className="font-mono font-bold text-white/80">#{completedOrderId}</span>
                    {orderIdCopied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-white/40" />}
                  </button>
                </div>
              </div>
            )}

            <div className="px-5 py-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Download className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <span className="text-sm text-white/80">사진 다운로드</span>
                </div>
                <span className="text-sm font-bold text-white">{displayN}장</span>
              </div>
              {displayM > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <Brush className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <span className="text-sm text-white/80">리터칭 의뢰</span>
                  </div>
                  <span className="text-sm font-bold text-white">{displayM}장</span>
                </div>
              )}
            </div>
          </motion.div>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center text-[11px] text-white/30 mb-6 leading-relaxed">
            앨범이 생성되었습니다. 사진을 확인하고 다운로드하세요.
          </motion.p>

          {/* 버튼 */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }} className="flex gap-3">
            <button onClick={() => router.push(`/cheiz/folder/${folderId}`)}
              className="flex-1 py-3.5 rounded-2xl bg-[#0055FF] text-white font-bold text-sm active:scale-[0.97] transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2">
              <Camera className="w-4 h-4" /> 앨범 확인
            </button>
            <button onClick={() => router.push("/cheiz/mypage")}
              className="flex-1 py-3.5 rounded-2xl bg-white/10 backdrop-blur text-white/80 font-medium text-sm active:scale-[0.97] transition-all border border-white/10 flex items-center justify-center gap-2">
              <User className="w-4 h-4" /> 마이페이지
            </button>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  const user = session?.user;

  return (
    <div className="min-h-screen bg-[#FAFAF8] pb-28">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-md mx-auto px-5 py-3 flex items-center justify-between">
          <button onClick={() => router.push(`/cheiz/folder/${folderId}`)} className="text-gray-500 text-sm flex items-center gap-1 active:scale-95">
            <ArrowLeft className="w-4 h-4" /> 뒤로
          </button>
          <h1 className="text-sm font-bold text-gray-900">결제 확인</h1>
          <div className="w-12" />
        </div>
      </div>

      <div className="max-w-md mx-auto px-5 pt-5 space-y-4">

        {/* ━━━ 주문자 정보 ━━━ */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
          {user?.image ? (
            <img src={user.image} alt="" className="w-11 h-11 rounded-full object-cover border border-gray-200" />
          ) : (
            <div className="w-11 h-11 rounded-full bg-[#0055FF]/10 flex items-center justify-center">
              <User className="w-5 h-5 text-[#0055FF]" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{user?.name || "사용자"}</p>
            <p className="text-[10px] text-gray-400 truncate flex items-center gap-1">
              <Mail className="w-3 h-3" /> {user?.email || ""}
            </p>
          </div>
        </motion.div>

        {/* ━━━ 주문 상세 ━━━ */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* 사진 다운로드 */}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Camera className="w-4 h-4 text-[#0055FF]" />
              <span className="text-xs font-bold text-gray-900">사진 다운로드 ({N}장)</span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {photoIds.map((id, i) => {
                const thumb = getPhotoThumb(id);
                return (
                  <div key={id} className="relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-gray-100">
                    {thumb ? <SecureImage src={thumb} className="w-full h-full object-cover" watermark={true} /> : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">{i + 1}</div>
                    )}
                    <div className="absolute bottom-0 right-0 bg-[#0055FF] text-white text-[8px] font-bold w-4 h-4 rounded-tl-md flex items-center justify-center z-[5]">{i + 1}</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 text-right text-xs text-gray-500">
              {N}장 x {DEFAULT_PHOTO_PRICE.toLocaleString()}원 = <span className="font-bold text-gray-800">{photoTotalPrice.toLocaleString()}원</span>
            </div>
          </div>

          {/* 리터칭 */}
          {M > 0 && retoucher && (
            <div className="border-t border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Brush className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold text-gray-900">리터칭 의뢰 ({M}장)</span>
              </div>
              <div className="flex items-center gap-2 mb-2 bg-amber-50 rounded-lg p-2">
                {retoucher.avatar && (
                  <img src={retoucher.avatar} alt="" className="w-7 h-7 rounded-full object-cover border border-amber-200" />
                )}
                <div>
                  <p className="text-[11px] font-bold text-gray-800">{retoucher.name} 작가</p>
                  <p className="text-[9px] text-gray-400">{(retoucher.description || "").slice(0, 30)}</p>
                </div>
                <div className="ml-auto flex items-center gap-0.5">
                  <Star className="w-2.5 h-2.5 text-amber-500 fill-current" />
                  <span className="text-[10px] font-bold text-amber-600">{retoucher.rating}</span>
                </div>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {retouchPhotoIds.map((id, i) => {
                  const thumb = getPhotoThumb(id);
                  return (
                    <div key={id} className="relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-gray-100">
                      {thumb ? <SecureImage src={thumb} className="w-full h-full object-cover" watermark={true} /> : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">{i + 1}</div>
                      )}
                      <div className="absolute bottom-0 right-0 bg-amber-500 text-white text-[8px] font-bold w-4 h-4 rounded-tl-md flex items-center justify-center z-[5]">{i + 1}</div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 text-right text-xs text-gray-500">
                {M}장 x {RETOUCH_PRICE.toLocaleString()}원 = <span className="font-bold text-gray-800">{retouchTotalPrice.toLocaleString()}원</span>
              </div>
            </div>
          )}

          {/* ✅ [C] 원가 합계 (Gross Total) 명시 */}
          <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-600">원가 합계</span>
            <div className="text-right">
              <span className="text-sm font-extrabold text-gray-900">{totalOriginal.toLocaleString()}원</span>
              {M > 0 && (
                <p className="text-[9px] text-gray-400">
                  사진 {photoTotalPrice.toLocaleString()} + 리터칭 {retouchTotalPrice.toLocaleString()}
                </p>
              )}
            </div>
          </div>

          {/* ━━━ '덤'의 미학: 원본 무료 증정 안내 ━━━ */}
          <div className="border-t border-dashed border-green-200 px-4 py-3 bg-green-50/50">
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-green-700">
                  AI 보정 사진 {N}장 구매 시 원본 {N}장 무료 증정!
                </p>
                <p className="text-[10px] text-green-600/80 mt-0.5">
                  총 {N * 2}장의 파일 다운로드 가능 (보정본 + 원본)
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ━━━ 크레딧 조절 (Stepper) ━━━ */}
        {!creditsLoading && (credits.photo > 0 || credits.retouch > 0) && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <button onClick={() => setShowBreakdown(!showBreakdown)}
              className="w-full px-4 py-3.5 flex items-center justify-between active:bg-gray-50 transition-colors">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-green-600" />
                <span className="text-sm font-bold text-gray-900">크레딧 할인 조절</span>
                {totalDiscount > 0 && (
                  <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                    -{totalDiscount.toLocaleString()}원
                  </span>
                )}
              </div>
              {showBreakdown ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            <AnimatePresence>
              {showBreakdown && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden">
                  <div className="px-4 pb-4 space-y-3">
                    {credits.photo > 0 && (
                      <CreditStepper label={`사진 크레딧 (보유 ${credits.photo}장)`} icon={Camera}
                        color="bg-blue-50 text-[#0055FF]" value={photoCreditsUse} max={maxPhotoCredits} onChange={setPhotoCreditsUse} />
                    )}
                    {M > 0 && credits.retouch > 0 && (
                      <CreditStepper label={`리터칭 크레딧 (보유 ${credits.retouch}장)`} icon={Brush}
                        color="bg-amber-50 text-amber-700" value={retouchCreditsUse} max={maxRetouchCredits} onChange={setRetouchCreditsUse} />
                    )}
                    {totalDiscount > 0 && (
                      <div className="bg-green-50 rounded-xl p-3 space-y-1">
                        {photoDiscount > 0 && (
                          <div className="flex justify-between text-[11px]">
                            <span className="text-gray-600">사진 크레딧 할인 ({photoCreditsUse}장)</span>
                            <span className="font-bold text-green-600">-{photoDiscount.toLocaleString()}원</span>
                          </div>
                        )}
                        {retouchDiscount > 0 && (
                          <div className="flex justify-between text-[11px]">
                            <span className="text-gray-600">리터칭 크레딧 할인 ({retouchCreditsUse}장)</span>
                            <span className="font-bold text-green-600">-{retouchDiscount.toLocaleString()}원</span>
                          </div>
                        )}
                        <div className="border-t border-green-200 pt-1 flex justify-between text-xs">
                          <span className="font-bold text-gray-700">총 할인</span>
                          <span className="font-extrabold text-green-600">-{totalDiscount.toLocaleString()}원</span>
                        </div>
                      </div>
                    )}

                    {/* ✅ [C] 크레딧 추가하기 버튼 */}
                    <button onClick={() => router.push("/cheiz/coupons")}
                      className="w-full py-2.5 rounded-xl border border-dashed border-[#0055FF]/30 bg-[#0055FF]/5 text-[#0055FF] text-xs font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 hover:bg-[#0055FF]/10">
                      <Ticket className="w-3.5 h-3.5" />
                      크레딧 추가하기 (쿠폰 등록)
                      <ExternalLink className="w-3 h-3 opacity-50" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ━━━ 최종 금액 ━━━ */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 }}
          className="bg-gradient-to-br from-[#0055FF] to-[#3377FF] rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-white/80">최종 결제 금액</span>
            {totalDiscount > 0 && (
              <span className="text-xs line-through text-white/40">{totalOriginal.toLocaleString()}원</span>
            )}
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-extrabold">
                {totalFinal > 0 ? `${totalFinal.toLocaleString()}원` : "0원"}
              </p>
              {totalFinal === 0 && (
                <p className="text-xs text-white/70 mt-1 flex items-center gap-1">
                  <Gift className="w-3 h-3" /> 크레딧으로 전액 결제!
                </p>
              )}
            </div>
            {totalDiscount > 0 && (
              <div className="bg-white/20 backdrop-blur-sm rounded-xl px-3 py-1.5 text-right">
                <p className="text-[10px] text-white/70">할인</p>
                <p className="text-sm font-bold">-{totalDiscount.toLocaleString()}원</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* ━━━ 에러 표시 ━━━ */}
        {error && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 rounded-2xl border border-red-200 p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-700 mb-0.5">결제 오류</p>
              <p className="text-xs text-red-500">{error}</p>
            </div>
          </motion.div>
        )}

        {/* ━━━ 약관 ━━━ */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
          className="bg-gray-50 rounded-2xl border border-gray-100 p-4">
          <div className="flex items-start gap-2.5">
            <FileText className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] text-gray-500 leading-relaxed">결제 시 아래 약관에 자동 동의됩니다.</p>
              <ul className="mt-1.5 space-y-0.5">
                <li className="text-[10px] text-gray-400 flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> 전자상거래 이용약관</li>
                <li className="text-[10px] text-gray-400 flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> 개인정보 수집 및 이용 동의</li>
                <li className="text-[10px] text-gray-400 flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> 디지털 콘텐츠 환불 정책 동의</li>
                {M > 0 && (
                  <li className="text-[10px] text-gray-400 flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> 리터칭 서비스 이용약관</li>
                )}
              </ul>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ━━━ 하단 결제 버튼 (Step A: 주문 → Step B: Checkout 리다이렉트) ━━━ */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-md mx-auto px-5 py-3">
          {creditsLoading ? (
            <div className="w-full h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          ) : (
            <button onClick={handlePayment} disabled={processing || verifying}
              className="w-full h-14 bg-[#0055FF] text-white text-base font-bold rounded-2xl disabled:opacity-60 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20">
              {processing || verifying ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> {paymentStep || "처리 중..."}</>
              ) : totalFinal > 0 ? (
                <><CreditCard className="w-5 h-5" /> {totalFinal.toLocaleString()}원 결제하기</>
              ) : (
                <><Gift className="w-5 h-5" /> 크레딧으로 무료 결제</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RedeemPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-3 border-[#0055FF] border-solid" />
      </div>
    }>
      <RedeemContent />
    </Suspense>
  );
}
