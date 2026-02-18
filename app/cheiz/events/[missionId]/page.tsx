"use client";

import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Gift,
  Camera,
  Bot,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Info,
} from "lucide-react";
import Image from "next/image";
import type { RewardEvent } from "../page";

const CREDIT_VISUAL: Record<string, {
  label: string;
  icon: React.ReactNode;
  gradient: string;
  bg: string;
  text: string;
}> = {
  PHOTO: {
    label: "무료 인화권",
    icon: <Camera className="w-5 h-5" />,
    gradient: "from-[#0055FF] to-[#00C2FF]",
    bg: "bg-blue-50",
    text: "text-blue-700",
  },
  AI: {
    label: "AI 전체 보정권",
    icon: <Bot className="w-5 h-5" />,
    gradient: "from-[#7B2BFF] to-[#C84BFF]",
    bg: "bg-purple-50",
    text: "text-purple-700",
  },
  RETOUCH: {
    label: "정밀 디테일 보정권",
    icon: <Sparkles className="w-5 h-5" />,
    gradient: "from-[#F59E0B] to-[#FBBF24]",
    bg: "bg-amber-50",
    text: "text-amber-700",
  },
};

export default function MissionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const missionId = params.missionId as string;

  const [mission, setMission] = useState<RewardEvent | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [toast, setToast] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  // DB에서 이벤트 데이터 로드
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/admin/events");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const all: RewardEvent[] = json.data || [];
        const found = all.find((e) => e._id === missionId);
        setMission(found || null);
      } catch (e) {
        console.error("[MissionDetail] 이벤트 로드 실패:", e);
      } finally {
        setPageLoading(false);
      }
    };
    load();
  }, [missionId]);

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (!mission) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-sm font-medium">이벤트를 찾을 수 없습니다</p>
          <button
            onClick={() => router.push("/cheiz/events")}
            className="mt-4 text-[#0055FF] text-sm font-bold"
          >
            이벤트 목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const visual = CREDIT_VISUAL[mission.reward_type] || CREDIT_VISUAL.PHOTO;

  const handleMainAction = async () => {
    if (completed || loading) return;

    if (mission.target_url) {
      if (mission.target_url.startsWith("http")) {
        window.open(mission.target_url, "_blank");
      } else {
        router.push(mission.target_url);
      }
      return;
    }

    if (!session) {
      showToast("로그인이 필요합니다.");
      router.push("/auth/signin?callbackUrl=/cheiz/events/" + missionId);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/backend/gift-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: mission._id }),
      });
      const data = await res.json();
      if (data.success) {
        setCompleted(true);
        showToast("기프트가 지급되었습니다!");
        setConfirmOpen(true);
      } else if (data.isDuplicate) {
        setCompleted(true);
        showToast("이미 참여한 이벤트입니다.");
      } else {
        showToast(data.error || "기프트 등록에 실패했습니다.");
      }
    } catch {
      showToast("오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const heroImage = mission.thumbnail_url || mission.image_url || "";
  const buttonText = mission.cta_text || "혜택 받기";

  return (
    <div className="min-h-screen bg-[#FAFAF8] pb-28">
      {/* 상단 배너 */}
      <div className="relative">
        <div className="relative h-64 sm:h-72 overflow-hidden bg-gray-100">
          {heroImage ? (
            <Image
              src={heroImage}
              alt={mission.title}
              fill
              sizes="(max-width: 768px) 100vw, 480px"
              priority
              quality={85}
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

          <button
            onClick={() => router.back()}
            className="absolute top-4 left-4 w-10 h-10 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white active:scale-95 transition-transform z-10"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {mission.badge_text && (
            <span className="absolute top-4 right-4 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg z-10">
              {mission.badge_text}
            </span>
          )}
        </div>

        {/* 크레딧 뱃지 */}
        <div className="max-w-md mx-auto px-5 -mt-8 relative z-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-gradient-to-r ${visual.gradient} shadow-xl shadow-black/15`}
          >
            <span className="text-white">{visual.icon}</span>
            <span className="text-white font-extrabold text-lg">+{mission.reward_amount}</span>
            <span className="text-white/80 text-sm font-bold">{visual.label}</span>
          </motion.div>
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="max-w-md mx-auto px-5 pt-6 space-y-5">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-1.5">{mission.title}</h1>
          {mission.subtitle && <p className="text-sm text-gray-500">{mission.subtitle}</p>}
        </motion.div>

        {mission.benefit_desc && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className={`${visual.bg} rounded-2xl p-5 border border-white`}>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${visual.gradient} flex items-center justify-center text-white shadow-md`}>
                <Gift className="w-6 h-6" />
              </div>
              <div>
                <p className={`text-base font-extrabold ${visual.text}`}>{mission.benefit_desc}</p>
                <p className="text-xs text-gray-400 mt-0.5">미션 완료 시 즉시 지급</p>
              </div>
            </div>
          </motion.div>
        )}

        {mission.description && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">이벤트 상세</p>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{mission.description}</p>
          </motion.div>
        )}

        {mission.conditions && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-start gap-2.5">
              <Info className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">참여 조건</p>
                <p className="text-xs text-gray-500 leading-relaxed">{mission.conditions}</p>
              </div>
            </div>
          </motion.div>
        )}

        {mission.target_url && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="bg-amber-50 rounded-2xl p-4 flex items-center gap-3">
            <ExternalLink className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-700 font-medium">
              외부 사이트로 이동하여 미션을 수행합니다. 미션 확인 후 크레딧이 지급됩니다.
            </p>
          </motion.div>
        )}
      </div>

      {/* 하단 고정 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-t border-gray-100">
        <div className="max-w-md mx-auto px-5 py-4">
          <button
            onClick={handleMainAction}
            disabled={loading || completed}
            className={`w-full h-14 rounded-2xl text-base font-extrabold transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 shadow-lg ${
              completed
                ? "bg-gray-200 text-gray-500 shadow-none"
                : `bg-gradient-to-r ${visual.gradient} text-white`
            }`}
          >
            {loading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> 처리 중...</>
            ) : completed ? (
              <><CheckCircle2 className="w-5 h-5" /> 참여 완료</>
            ) : (
              <>
                {mission.target_url ? <ExternalLink className="w-5 h-5" /> : <Gift className="w-5 h-5" />}
                {buttonText}
              </>
            )}
          </button>
        </div>
      </div>

      {/* 지급 완료 모달 */}
      <AnimatePresence>
        {confirmOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
            onClick={(e) => { if (e.target === e.currentTarget) setConfirmOpen(false); }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 30 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
            >
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2, stiffness: 200 }}
                className={`w-20 h-20 mx-auto mb-5 rounded-full bg-gradient-to-br ${visual.gradient} flex items-center justify-center shadow-xl`}
              >
                <CheckCircle2 className="w-10 h-10 text-white" />
              </motion.div>
              <h3 className="text-xl font-extrabold text-gray-900 mb-2">기프트 지급 완료!</h3>
              <p className="text-sm text-gray-500 mb-1">
                {visual.label} <span className="font-bold">{mission.reward_amount}장</span>이 지급되었습니다.
              </p>
              <p className="text-xs text-gray-400 mb-6">쿠폰함에서 크레딧으로 전환하여 사용하세요.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmOpen(false)}
                  className="flex-1 h-12 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 active:scale-[0.98] transition-all">
                  확인
                </button>
                <button onClick={() => router.push("/cheiz/coupons")}
                  className={`flex-1 h-12 rounded-xl text-sm font-bold text-white bg-gradient-to-r ${visual.gradient} active:scale-[0.98] transition-all shadow-md`}>
                  쿠폰함 가기
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 토스트 */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm font-medium px-6 py-3 rounded-full shadow-xl z-[110]">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
