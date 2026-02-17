"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Ticket, Gift, Camera, Sparkles, Brush, Clock, CheckCircle2 } from "lucide-react";
import { CreditBalanceCard } from "../components/CreditCard";

type IssuedCoupon = {
  id: string;
  code: string;
  templateName: string;
  templateDescription: string;
  expiryDate: string | null;
  formattedExpiry: string | null;
  photoCount: number;
  aiCount: number;
  retouchCount: number;
  isUsed: boolean;
  status: string;
};

export default function CouponsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [coupons, setCoupons] = useState<IssuedCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeemLoading, setRedeemLoading] = useState<string | null>(null);
  const [credits, setCredits] = useState({ photo: 0, ai: 0, retouch: 0 });
  const [toast, setToast] = useState("");

  // ━━━ 쿠폰 등록 입력 폼 ━━━
  const [couponCode, setCouponCode] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerMsg, setRegisterMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  // ━━━ 데이터 로드 (issued-coupons + wallet 병렬) ━━━
  const fetchData = async () => {
    try {
      setLoading(true);
      const [issuedRes, walletRes] = await Promise.all([
        fetch("/api/backend/issued-coupons"),
        fetch("/api/backend/wallet"),
      ]);

      const issuedData = await issuedRes.json();
      const walletData = await walletRes.json();

      // 쿠폰 목록 (issued-coupons API)
      if (issuedData.success && Array.isArray(issuedData.coupons)) {
        setCoupons(issuedData.coupons);
        // 디버깅: 첫 번째 쿠폰의 모든 키 출력
        if (issuedData.coupons.length > 0) {
          console.log("━━━ [COUPONS] 첫 번째 쿠폰 디버그 ━━━");
          console.log("[COUPONS] 모든 키:", Object.keys(issuedData.coupons[0]));
          console.log("[COUPONS] templateName:", issuedData.coupons[0].templateName);
          console.log("[COUPONS] code:", issuedData.coupons[0].code);
          console.log("[COUPONS] photoCount:", issuedData.coupons[0].photoCount);
          console.log("[COUPONS] aiCount:", issuedData.coupons[0].aiCount);
          console.log("[COUPONS] retouchCount:", issuedData.coupons[0].retouchCount);
          console.log("[COUPONS] raw:", JSON.stringify(issuedData.coupons[0].raw || {}).substring(0, 500));
          console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        }
      }

      // 크레딧 잔액 (wallet API)
      if (walletData.success) {
        setCredits({
          photo: walletData.photoCredits || 0,
          ai: walletData.aiCredits || 0,
          retouch: walletData.retouchCredits || 0,
        });
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "loading") return;
    if (!session) return;
    fetchData();
  }, [status, session]);

  // ━━━ 쿠폰 등록 (preview → register) ━━━
  const handleRegisterCoupon = async () => {
    if (!couponCode.trim()) return;
    setRegisterLoading(true);
    setRegisterMsg(null);
    try {
      // Step 1: 조회
      const previewRes = await fetch("/api/backend/redeem-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponCode: couponCode.trim(), action: "preview" }),
      });
      const previewData = await previewRes.json();
      if (!previewData.success) {
        setRegisterMsg({ type: "error", text: previewData.error || "유효하지 않은 쿠폰입니다." });
        setRegisterLoading(false);
        return;
      }

      // Step 2: 등록
      const regRes = await fetch("/api/backend/redeem-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponCode: couponCode.trim(), action: "register" }),
      });
      const regData = await regRes.json();
      if (regData.success) {
        setRegisterMsg({ type: "success", text: "쿠폰이 등록되었습니다!" });
        setCouponCode("");
        showToast("쿠폰 등록 완료!");
        // 목록 새로고침
        fetchData();
      } else {
        setRegisterMsg({ type: "error", text: regData.error || "쿠폰 등록에 실패했습니다." });
      }
    } catch {
      setRegisterMsg({ type: "error", text: "오류가 발생했습니다." });
    } finally {
      setRegisterLoading(false);
    }
  };

  // ━━━ 크레딧 전환 (3단계 redeem) ━━━
  const handleRedeem = async (code: string, couponId: string) => {
    setRedeemLoading(couponId);
    try {
      const res = await fetch("/api/backend/redeem-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponCode: code, action: "redeem" }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("크레딧 전환 완료!");
        // 전체 목록 새로고침
        fetchData();
      } else {
        showToast(data.error || "전환 실패");
      }
    } catch {
      showToast("오류가 발생했습니다.");
    } finally {
      setRedeemLoading(null);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-3 border-[#0055FF] border-solid mx-auto mb-4" />
          <p className="text-gray-500 text-sm">쿠폰을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    router.push("/auth/signin?callbackUrl=/cheiz/coupons");
    return null;
  }

  // 사용 가능 / 사용 완료 분리
  const activeCoupons = coupons.filter(c => !c.isUsed);
  const usedCoupons = coupons.filter(c => c.isUsed);

  return (
    <div className="min-h-screen bg-[#FAFAF8] pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-md mx-auto px-5 py-3 flex items-center justify-between">
          <button onClick={() => router.back()}
            className="text-gray-500 hover:text-[#0055FF] transition-colors text-sm flex items-center gap-1 active:scale-95">
            <ArrowLeft className="w-4 h-4" /> 뒤로
          </button>
          <h1 className="text-sm font-bold text-gray-900">쿠폰함</h1>
          <div className="w-12" />
        </div>
      </div>

      {/* ━━━ 쿠폰 등록 입력 폼 ━━━ */}
      <div className="max-w-md mx-auto px-5 pt-5 pb-2">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            쿠폰 코드 등록
          </p>
          <div className="flex gap-2">
            <input type="text" value={couponCode}
              onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setRegisterMsg(null); }}
              placeholder="쿠폰 코드를 입력하세요"
              className="flex-1 h-12 px-4 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0055FF] focus:ring-1 focus:ring-[#0055FF]/20 transition-all placeholder:text-gray-400" />
            <button onClick={handleRegisterCoupon} disabled={registerLoading || !couponCode.trim()}
              className="h-12 px-5 bg-[#0055FF] text-white text-sm font-bold rounded-xl disabled:opacity-40 hover:bg-opacity-90 transition-all active:scale-95 flex-shrink-0">
              {registerLoading ? "..." : "등록"}
            </button>
          </div>
          {registerMsg && (
            <p className={`mt-2 text-xs ${registerMsg.type === "success" ? "text-green-600" : "text-red-500"}`}>
              {registerMsg.type === "success" ? "✅ " : "❌ "}{registerMsg.text}
            </p>
          )}
        </motion.div>
      </div>

      {/* ━━━ 보유 크레딧 ━━━ */}
      <div className="max-w-md mx-auto px-5 py-2">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">보유 크레딧</p>
          <CreditBalanceCard photo={credits.photo} ai={credits.ai} retouch={credits.retouch} compact />
        </motion.div>
      </div>

      {/* ━━━ 사용 가능 쿠폰 리스트 ━━━ */}
      <div className="max-w-md mx-auto px-5 py-3">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
          사용 가능 쿠폰 ({activeCoupons.length}개)
        </p>

        {activeCoupons.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-50 flex items-center justify-center">
              <Gift className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-sm font-semibold text-gray-600 mb-1">사용 가능한 쿠폰이 0개입니다</p>
            <p className="text-xs text-gray-400">위에서 쿠폰 코드를 등록해보세요!</p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {activeCoupons.map((c, idx) => (
              <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* 쿠폰 헤더 */}
                <div className="p-4 pb-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-gray-900 truncate">{c.templateName}</h3>
                      {c.templateDescription && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{c.templateDescription}</p>
                      )}
                    </div>
                    <div className="ml-3 flex-shrink-0">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                        <Ticket className="w-3 h-3" /> 사용 가능
                      </span>
                    </div>
                  </div>

                  {/* 유효기간 */}
                  {c.formattedExpiry && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-3">
                      <Clock className="w-3 h-3" />
                      <span>{c.formattedExpiry}</span>
                    </div>
                  )}

                  {/* 혜택 정보 (PHOTO / AI / RETOUCH) */}
                  <div className="flex gap-2 flex-wrap">
                    {c.photoCount > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-lg">
                        <Camera className="w-3.5 h-3.5 text-blue-600" />
                        <span className="text-xs font-bold text-blue-700">무료 인화권</span>
                        <span className="text-xs font-extrabold text-blue-900">{c.photoCount}장</span>
                      </div>
                    )}
                    {c.aiCount > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 rounded-lg">
                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                        <span className="text-xs font-bold text-purple-700">AI 전체 보정권</span>
                        <span className="text-xs font-extrabold text-purple-900">{c.aiCount}장</span>
                      </div>
                    )}
                    {c.retouchCount > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 rounded-lg">
                        <Brush className="w-3.5 h-3.5 text-amber-600" />
                        <span className="text-xs font-bold text-amber-700">정밀 디테일 보정권</span>
                        <span className="text-xs font-extrabold text-amber-900">{c.retouchCount}장</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 전환 버튼 (점선 구분) */}
                <div className="border-t border-dashed border-gray-200 px-4 py-3">
                  <button onClick={() => handleRedeem(c.code, c.id)}
                    disabled={redeemLoading === c.id}
                    className="w-full py-2.5 rounded-xl bg-[#0055FF] text-white text-sm font-bold disabled:opacity-50 hover:bg-opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                    {redeemLoading === c.id ? (
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>크레딧으로 전환하기</>
                    )}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ━━━ 사용 완료 쿠폰 리스트 ━━━ */}
      {usedCoupons.length > 0 && (
        <div className="max-w-md mx-auto px-5 py-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            사용 완료 ({usedCoupons.length}개)
          </p>
          <div className="space-y-3">
            {usedCoupons.map((c, idx) => (
              <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.03 }}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden opacity-50 grayscale">
                <div className="p-4 pb-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-gray-600 truncate">{c.templateName}</h3>
                      {c.templateDescription && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{c.templateDescription}</p>
                      )}
                    </div>
                    <div className="ml-3 flex-shrink-0">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-200 text-gray-500">
                        <CheckCircle2 className="w-3 h-3" /> 크레딧 전환 완료
                      </span>
                    </div>
                  </div>

                  {c.formattedExpiry && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-3">
                      <Clock className="w-3 h-3" />
                      <span>{c.formattedExpiry}</span>
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    {c.photoCount > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-lg">
                        <Camera className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs text-gray-500">{c.photoCount}장</span>
                      </div>
                    )}
                    {c.aiCount > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-lg">
                        <Sparkles className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs text-gray-500">{c.aiCount}장</span>
                      </div>
                    )}
                    {c.retouchCount > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-lg">
                        <Brush className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs text-gray-500">{c.retouchCount}장</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ━━━ 안내 ━━━ */}
      <div className="max-w-md mx-auto px-5 py-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">쿠폰 사용 안내</p>
          <ul className="text-xs text-gray-500 space-y-1.5">
            <li className="flex items-start gap-2"><span className="text-gray-300 mt-0.5">•</span> 쿠폰을 크레딧으로 전환하면 예약 시 자동으로 적용됩니다.</li>
            <li className="flex items-start gap-2"><span className="text-gray-300 mt-0.5">•</span> 유효기간이 지난 쿠폰은 전환할 수 없습니다.</li>
            <li className="flex items-start gap-2"><span className="text-gray-300 mt-0.5">•</span> 전환된 크레딧은 환불이 불가합니다.</li>
          </ul>
        </div>
      </div>

      {/* ━━━ 토스트 ━━━ */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm font-medium px-6 py-3 rounded-full shadow-xl z-[100]">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
