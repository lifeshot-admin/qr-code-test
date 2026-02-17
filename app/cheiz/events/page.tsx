"use client";

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ticket, ChevronRight, Gift, Sparkles,
  MapPin, Clock, X, Search, Loader2, Copy, Check,
  Camera, Bot, Zap,
} from "lucide-react";

// ━━━ 크레딧 타입 정의 ━━━
type CreditType = "PHOTO" | "AI" | "RETOUCH";

const CREDIT_CONFIG: Record<CreditType, {
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  gradient: string;
  badgeColor: string;
  textColor: string;
}> = {
  PHOTO: {
    label: "무료 인화권",
    sublabel: "사진 다운로드",
    icon: <Camera className="w-5 h-5" />,
    gradient: "from-[#0055FF] to-[#00C2FF]",
    badgeColor: "bg-blue-100 text-blue-700",
    textColor: "text-blue-600",
  },
  AI: {
    label: "AI 보정권",
    sublabel: "AI 전체 보정",
    icon: <Bot className="w-5 h-5" />,
    gradient: "from-[#7B2BFF] to-[#C84BFF]",
    badgeColor: "bg-purple-100 text-purple-700",
    textColor: "text-purple-600",
  },
  RETOUCH: {
    label: "디테일 정밀 보정",
    sublabel: "디테일 보정",
    icon: <Sparkles className="w-5 h-5" />,
    gradient: "from-[#F59E0B] to-[#FBBF24]",
    badgeColor: "bg-amber-100 text-amber-700",
    textColor: "text-amber-600",
  },
};

// ━━━ 리워드 이벤트 데이터 ━━━
export type MissionType = "CLICK" | "PARTNER";

export type RewardEvent = {
  id: string;
  title: string;
  subtitle: string;
  creditType: CreditType;
  creditAmount: number;
  image: string;
  badge?: string;
  active: boolean;
  // ━━━ 상세 페이지용 필드 ━━━
  mission_type: MissionType;
  gift_Id?: number;
  target_url?: string;
  main_image: string;
  benefit_desc: string;
  content_detail: string;
  condition_desc: string;
  button_text: string;
};

export const REWARD_EVENTS: RewardEvent[] = [
  {
    id: "welcome",
    title: "환영 선물",
    subtitle: "회원가입만 해도 바로 지급!",
    creditType: "PHOTO",
    creditAmount: 3,
    image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&h=300&fit=crop",
    badge: "NEW",
    active: true,
    mission_type: "CLICK",
    gift_Id: 1,
    main_image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&h=500&fit=crop",
    benefit_desc: "사진 다운로드권 3장 즉시 지급!",
    content_detail: "CHEIZ에 처음 오신 것을 환영합니다! 가입만으로 무료 인화권 3장을 드립니다. 아름다운 촬영지에서 특별한 추억을 남겨보세요.",
    condition_desc: "신규 가입 회원 대상 · 1인 1회 · 가입 후 30일 이내 사용",
    button_text: "선물 받기",
  },
  {
    id: "review",
    title: "후기 작성 이벤트",
    subtitle: "촬영 후기를 남기면 AI 보정권 증정",
    creditType: "AI",
    creditAmount: 2,
    image: "https://images.unsplash.com/photo-1516321497487-e288fb19713f?w=400&h=300&fit=crop",
    badge: "HOT",
    active: true,
    mission_type: "PARTNER",
    target_url: "https://www.instagram.com/cheiz_official",
    main_image: "https://images.unsplash.com/photo-1516321497487-e288fb19713f?w=800&h=500&fit=crop",
    benefit_desc: "AI 전체 보정권 2장 지급!",
    content_detail: "촬영 후기를 인스타그램에 남겨주세요! @cheiz_official 태그와 함께 게시하면 AI 보정권을 드립니다. 아름다운 사진과 함께 여러분의 경험을 공유해주세요.",
    condition_desc: "인스타그램 공개 계정 필수 · @cheiz_official 태그 필수 · 후기 확인 후 24시간 내 지급",
    button_text: "인스타그램에서 참여하기",
  },
  {
    id: "referral",
    title: "친구 초대하기",
    subtitle: "친구가 가입하면 디테일 보정권 선물",
    creditType: "RETOUCH",
    creditAmount: 1,
    image: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=300&fit=crop",
    active: true,
    mission_type: "CLICK",
    gift_Id: 3,
    main_image: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&h=500&fit=crop",
    benefit_desc: "정밀 디테일 보정권 1장 지급!",
    content_detail: "친구에게 CHEIZ를 소개하고 함께 혜택을 받으세요. 초대한 친구가 가입을 완료하면 즉시 디테일 보정권이 지급됩니다.",
    condition_desc: "초대된 친구의 가입 완료 필수 · 초대 횟수 제한 없음 · 중복 가입 불인정",
    button_text: "친구 초대하고 받기",
  },
  {
    id: "first-booking",
    title: "첫 예약 특전",
    subtitle: "첫 촬영 예약 시 사진 다운로드권 증정",
    creditType: "PHOTO",
    creditAmount: 5,
    image: "https://images.unsplash.com/photo-1519125323398-675f0ddb6308?w=400&h=300&fit=crop",
    badge: "추천",
    active: true,
    mission_type: "CLICK",
    gift_Id: 4,
    main_image: "https://images.unsplash.com/photo-1519125323398-675f0ddb6308?w=800&h=500&fit=crop",
    benefit_desc: "사진 다운로드권 5장 대량 지급!",
    content_detail: "첫 촬영 예약을 완료하신 분께 특별히 사진 다운로드권 5장을 드립니다. 인생 최고의 순간을 남기세요!",
    condition_desc: "첫 예약 완료 후 자동 지급 · 1인 1회 · 예약 취소 시 회수",
    button_text: "혜택 받기",
  },
  {
    id: "sns-share",
    title: "SNS 공유 이벤트",
    subtitle: "인스타그램에 공유하면 AI 보정권 지급",
    creditType: "AI",
    creditAmount: 1,
    image: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=400&h=300&fit=crop",
    active: true,
    mission_type: "PARTNER",
    target_url: "https://www.instagram.com/cheiz_official",
    main_image: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&h=500&fit=crop",
    benefit_desc: "AI 보정권 1장 지급!",
    content_detail: "CHEIZ 촬영 경험을 SNS에 공유해주세요. 인스타그램 스토리 또는 피드에 게시하면 AI 보정권을 드립니다.",
    condition_desc: "인스타그램 공개 계정 필수 · 스토리 24시간 이상 유지 · 확인 후 48시간 내 지급",
    button_text: "SNS에서 참여하기",
  },
];

// ━━━ 리워드 카드 (외부 이동형) ━━━
function RewardCard({
  event, index, onEventClick,
}: {
  event: RewardEvent;
  index: number;
  onEventClick: (eventId: string) => void;
}) {
  const config = CREDIT_CONFIG[event.creditType];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      onClick={() => onEventClick(event.id)}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
    >
      <div className="flex">
        {/* 좌측: 이벤트 이미지 */}
        <div className="relative w-28 h-28 flex-shrink-0">
          <img
            src={event.image}
            alt={event.title}
            className="w-full h-full object-cover"
          />
          {event.badge && (
            <span className="absolute top-2 left-2 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
              {event.badge}
            </span>
          )}
        </div>

        {/* 중앙: 제목 + 크레딧 타입 */}
        <div className="flex-1 p-3 flex flex-col justify-center min-w-0">
          <h3 className="text-sm font-bold text-gray-900 truncate">{event.title}</h3>
          <p className="text-[11px] text-gray-400 mt-0.5 truncate">{event.subtitle}</p>

          {/* 크레딧 타입 뱃지 */}
          <div className="flex items-center gap-1.5 mt-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${config.badgeColor}`}>
              {config.icon}
              {config.sublabel}
            </span>
          </div>
        </div>

        {/* 우측: 미션 수행 버튼 (외부 이동형) */}
        <div className="flex items-center pr-3 flex-shrink-0">
          <div
            className={`relative w-[72px] h-[72px] rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all bg-gradient-to-br ${config.gradient} shadow-lg shadow-black/15`}
          >
            <span className="text-white text-xl font-extrabold leading-none drop-shadow-sm">
              +{event.creditAmount}
            </span>
            <span className="text-white font-extrabold text-[9px] mt-0.5 tracking-wide leading-tight text-center">
              미션 수행
            </span>

            {/* 반짝이 효과 */}
            <motion.div
              className="absolute inset-0 rounded-2xl bg-white/20"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.3, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: index * 0.3 }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function EventsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const userName = (session?.user as any)?.nickname || session?.user?.name || "Cheiz";

  // ━━━ 이벤트 이동 (외부 URL 전용 — 내부 지급 로직 없음) ━━━
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const handleEventClick = useCallback((eventId: string) => {
    const ev = REWARD_EVENTS.find((e) => e.id === eventId);
    if (!ev) return;
    router.push(`/cheiz/events/${eventId}`);
  }, [router]);

  // ━━━ 쿠폰 복구 모달 ━━━
  const [couponModalOpen, setCouponModalOpen] = useState(false);
  const [tourDate, setTourDate] = useState("");
  const [phone4, setPhone4] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<{
    found: boolean;
    coupon_name?: string;
    code?: string;
    tour_date?: string;
    tour_Id?: number;
    message?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCouponSearch = async () => {
    if (!tourDate || phone4.length !== 4) return;
    setSearching(true);
    setSearchResult(null);
    try {
      const res = await fetch(`/api/bubble/search-coupon?tour_date=${tourDate}&phone_4_digits=${phone4}`);
      const data = await res.json();
      setSearchResult(data);
    } catch {
      setSearchResult({ found: false, message: "검색 중 오류가 발생했습니다." });
    } finally {
      setSearching(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ━━━ 크레딧 보유 요약 (상단 배너) ━━━
  const creditSummary = [
    { type: "PHOTO" as CreditType, icon: <Camera className="w-4 h-4" />, label: "사진" },
    { type: "AI" as CreditType, icon: <Bot className="w-4 h-4" />, label: "AI" },
    { type: "RETOUCH" as CreditType, icon: <Sparkles className="w-4 h-4" />, label: "디테일" },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAF8] pb-24">
      {/* ━━━ Hero Banner (시원한 풀 배너) ━━━ */}
      <div className="relative overflow-hidden">
        {/* 배경 이미지 */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=800&h=500&fit=crop')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/70" />

        <div className="relative max-w-md mx-auto px-5 pt-14 pb-8">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-white/70 text-sm mb-1">{session ? `${userName}님을 위한` : "특별한"}</p>
            <h1 className="text-3xl font-extrabold text-white mb-2">이벤트 & 혜택</h1>
            <p className="text-white/80 text-base font-medium mb-1">미션 참여하면 크레딧 즉시 지급!</p>
            <p className="text-white/50 text-xs">촬영권 · AI 보정권 · 디테일 보정권</p>
          </motion.div>

          {/* 크레딧 타입 요약 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-5 bg-white/10 backdrop-blur-md rounded-2xl p-4 flex justify-around"
          >
            {creditSummary.map((c) => (
              <div key={c.type} className="flex flex-col items-center gap-1">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">
                  {c.icon}
                </div>
                <span className="text-white/80 text-[10px] font-bold">{c.label}</span>
              </div>
            ))}
          </motion.div>

          {/* 참여하고 크레딧 받기 CTA */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            onClick={() => {
              const target = document.getElementById("reward-missions");
              target?.scrollIntoView({ behavior: "smooth" });
            }}
            className="mt-4 w-full py-3.5 bg-[#22C55E] hover:bg-[#16A34A] text-white font-extrabold text-base rounded-2xl shadow-lg shadow-green-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Gift className="w-5 h-5" />
            참여하고 혜택받기
          </motion.button>
        </div>
      </div>

      <div className="max-w-md mx-auto px-5 -mt-5 space-y-4">
        {/* ━━━ 내 쿠폰 확인하기 (CTA) ━━━ */}
        <motion.button
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          onClick={() => setCouponModalOpen(true)}
          className="w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-5 flex items-center justify-between active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0055FF] to-[#3377FF] flex items-center justify-center shadow-md shadow-blue-500/20">
              <Ticket className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <p className="text-base font-bold text-gray-900">내 쿠폰 확인하기</p>
              <p className="text-xs text-gray-400 mt-0.5">투어 날짜 + 전화번호로 쿠폰 찾기</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300" />
        </motion.button>

        {/* ━━━ 리워드 미션 리스트 (네이버 웹툰 쿠키 스타일) ━━━ */}
        <div id="reward-missions" className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">크레딧 미션</p>
            <div className="flex items-center gap-1 text-[10px] text-gray-400">
              <Zap className="w-3 h-3" />
              미션을 완료하고 크레딧 받기
            </div>
          </div>

          {REWARD_EVENTS.map((event, i) => (
            <RewardCard
              key={event.id}
              event={event}
              index={i}
              onEventClick={handleEventClick}
            />
          ))}
        </div>

        {/* ━━━ 프로모션 매거진 ━━━ */}
        <div className="space-y-4 pt-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">시즌 프로모션</p>

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#FF9A9E] to-[#FECFEF] p-6 min-h-[140px] flex flex-col justify-end cursor-pointer active:scale-[0.98] transition-transform shadow-sm"
          >
            <span className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-1 rounded-full">SPRING</span>
            <div className="text-white/40 mb-3"><Camera className="w-10 h-10" /></div>
            <h3 className="text-xl font-bold text-white mb-1">봄 한정 벚꽃 스팟 오픈</h3>
            <p className="text-sm text-white/80">인생샷 명소에서 특별한 추억을 남기세요</p>
          </motion.div>
        </div>

        {/* ━━━ 종료된 이벤트 ━━━ */}
        <div className="space-y-3 pt-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">종료된 이벤트</p>
          {[
            { icon: <MapPin className="w-5 h-5 text-gray-400" />, title: "크리스마스 특별 촬영", date: "2025.12.01 ~ 2025.12.25" },
            { icon: <Clock className="w-5 h-5 text-gray-400" />, title: "얼리버드 할인", date: "2025.11.01 ~ 2025.11.30" },
          ].map((ev, i) => (
            <motion.div key={ev.title} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 + i * 0.05 }}
              className="bg-white rounded-2xl border border-gray-100 p-5 opacity-60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">{ev.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-600">{ev.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{ev.date}</p>
                </div>
                <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-full">종료</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ━━━ 안내 ━━━ */}
        <div className="pt-4 pb-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">안내</p>
            <ul className="text-xs text-gray-500 space-y-1.5">
              <li className="flex items-start gap-2"><span className="text-gray-300 mt-0.5">•</span> 이벤트는 별도 공지 없이 변경/종료될 수 있습니다.</li>
              <li className="flex items-start gap-2"><span className="text-gray-300 mt-0.5">•</span> 지급된 크레딧은 마이페이지에서 확인 가능합니다.</li>
              <li className="flex items-start gap-2"><span className="text-gray-300 mt-0.5">•</span> 문의사항은 카카오톡 고객센터를 이용해주세요.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ━━━ 쿠폰 복구 모달 ━━━ */}
      <AnimatePresence>
        {couponModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-end justify-center sm:items-center p-0 sm:p-6"
            onClick={(e) => { if (e.target === e.currentTarget) setCouponModalOpen(false); }}>
            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 max-h-[85vh] overflow-y-auto">

              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">내 쿠폰 찾기</h3>
                <button onClick={() => { setCouponModalOpen(false); setSearchResult(null); setTourDate(""); setPhone4(""); }}
                  className="p-2 rounded-xl hover:bg-gray-100 active:scale-95"><X className="w-5 h-5 text-gray-400" /></button>
              </div>

              <p className="text-sm text-gray-500 mb-6">예약하신 투어 날짜와 전화번호 뒷 4자리를 입력하면 쿠폰 번호를 찾아드립니다.</p>

              <div className="mb-4">
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">투어 날짜</label>
                <input type="date" value={tourDate} onChange={(e) => setTourDate(e.target.value)}
                  className="w-full h-12 px-4 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0055FF] focus:ring-1 focus:ring-[#0055FF]/20 transition-all" />
              </div>

              <div className="mb-6">
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">전화번호 뒷 4자리</label>
                <input type="text" inputMode="numeric" maxLength={4} value={phone4}
                  onChange={(e) => setPhone4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="0000"
                  className="w-full h-12 px-4 border border-gray-200 rounded-xl text-sm text-center tracking-[0.5em] font-mono focus:outline-none focus:border-[#0055FF] focus:ring-1 focus:ring-[#0055FF]/20 transition-all placeholder:tracking-normal" />
              </div>

              <button onClick={handleCouponSearch} disabled={searching || !tourDate || phone4.length !== 4}
                className="w-full h-12 bg-[#0055FF] text-white text-sm font-bold rounded-xl disabled:opacity-40 hover:bg-opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {searching ? "검색 중..." : "쿠폰 찾기"}
              </button>

              <AnimatePresence mode="wait">
                {searchResult && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-6">
                    {searchResult.found ? (
                      <div className="bg-gradient-to-br from-[#0055FF]/5 to-purple-50 rounded-2xl border border-[#0055FF]/20 p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center"><Check className="w-4 h-4 text-green-600" /></div>
                          <p className="text-sm font-bold text-gray-900">쿠폰을 찾았습니다!</p>
                        </div>
                        <div className="space-y-2 mb-4">
                          <div className="flex justify-between text-xs"><span className="text-gray-500">쿠폰명</span><span className="font-medium text-gray-800">{searchResult.coupon_name}</span></div>
                          <div className="flex justify-between text-xs"><span className="text-gray-500">투어 날짜</span><span className="font-medium text-gray-800">{searchResult.tour_date}</span></div>
                        </div>
                        <div className="bg-white rounded-xl p-4 flex items-center justify-between border border-gray-100">
                          <div>
                            <p className="text-[10px] text-gray-400 mb-1">쿠폰 코드</p>
                            <p className="text-lg font-mono font-bold text-[#0055FF] tracking-wider">{searchResult.code}</p>
                          </div>
                          <button onClick={() => handleCopyCode(searchResult.code!)}
                            className="px-4 py-2 bg-[#0055FF] text-white text-xs font-bold rounded-lg active:scale-95 transition-transform flex items-center gap-1.5">
                            {copied ? <><Check className="w-3 h-3" /> 복사됨</> : <><Copy className="w-3 h-3" /> 복사</>}
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-3 text-center">이 코드를 마이페이지 &gt; 쿠폰에서 등록하세요</p>
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-2xl p-5 text-center">
                        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                          <Search className="w-5 h-5 text-gray-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-600 mb-1">쿠폰을 찾지 못했습니다</p>
                        <p className="text-xs text-gray-400">{searchResult.message || "투어 날짜와 전화번호를 다시 확인해주세요."}</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ━━━ 토스트 ━━━ */}
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
