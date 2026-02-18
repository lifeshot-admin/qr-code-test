"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ticket, ChevronRight, Gift, Sparkles,
  MapPin, Clock, X, Search, Loader2, Copy, Check,
  Camera, Bot, Zap,
} from "lucide-react";
import Image from "next/image";

// 버블 DB reward_event 필드 기준 타입
export type RewardEvent = {
  _id: string;
  title: string;
  subtitle?: string;
  badge_text?: string;
  benefit_desc?: string;
  conditions?: string;
  cta_text?: string;
  description?: string;
  image_url?: string;
  reward_amount: number;
  reward_type: string;
  sort_order: number;
  target_url?: string;
  thumbnail_url?: string;
};

const REWARD_TYPE_CONFIG: Record<string, {
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  gradient: string;
  badgeColor: string;
}> = {
  PHOTO: {
    label: "무료 인화권",
    sublabel: "사진 다운로드",
    icon: <Camera className="w-4 h-4" />,
    gradient: "from-[#0055FF] to-[#00C2FF]",
    badgeColor: "bg-blue-100 text-blue-700",
  },
  AI: {
    label: "AI 보정권",
    sublabel: "AI 전체 보정",
    icon: <Bot className="w-4 h-4" />,
    gradient: "from-[#7B2BFF] to-[#C84BFF]",
    badgeColor: "bg-purple-100 text-purple-700",
  },
  RETOUCH: {
    label: "디테일 정밀 보정",
    sublabel: "디테일 보정",
    icon: <Sparkles className="w-4 h-4" />,
    gradient: "from-[#F59E0B] to-[#FBBF24]",
    badgeColor: "bg-amber-100 text-amber-700",
  },
};

function RewardCard({ event, index, onClick }: { event: RewardEvent; index: number; onClick: () => void }) {
  const config = REWARD_TYPE_CONFIG[event.reward_type] || REWARD_TYPE_CONFIG.PHOTO;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      onClick={onClick}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
    >
      <div className="flex">
        <div className="relative w-28 h-28 flex-shrink-0 bg-gray-100">
          {event.image_url ? (
            <Image src={event.image_url} alt={event.title} fill sizes="112px" className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">No Image</div>
          )}
          {event.badge_text && (
            <span className="absolute top-2 left-2 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
              {event.badge_text}
            </span>
          )}
        </div>

        <div className="flex-1 p-3 flex flex-col justify-center min-w-0">
          <h3 className="text-sm font-bold text-gray-900 truncate">{event.title}</h3>
          <p className="text-[11px] text-gray-400 mt-0.5 truncate">{event.subtitle || ""}</p>
          <div className="flex items-center gap-1.5 mt-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${config.badgeColor}`}>
              {config.icon}
              {config.sublabel}
            </span>
          </div>
        </div>

        <div className="flex items-center pr-3 flex-shrink-0">
          <div className={`relative w-[72px] h-[72px] rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all bg-gradient-to-br ${config.gradient} shadow-lg shadow-black/15`}>
            <span className="text-white text-xl font-extrabold leading-none drop-shadow-sm">
              +{event.reward_amount}
            </span>
            <span className="text-white font-extrabold text-[9px] mt-0.5 tracking-wide leading-tight text-center">
              미션 수행
            </span>
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

  const [events, setEvents] = useState<RewardEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  // 버블 DB에서 이벤트 로드
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/admin/events");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const data: RewardEvent[] = json.data || [];
        setEvents(data.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
      } catch (e) {
        console.error("[EventsPage] 이벤트 로드 실패:", e);
      } finally {
        setEventsLoading(false);
      }
    };
    load();
  }, []);

  // 쿠폰 모달
  const [couponModalOpen, setCouponModalOpen] = useState(false);
  const [tourDate, setTourDate] = useState("");
  const [phone4, setPhone4] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<{
    found: boolean;
    coupon_name?: string;
    code?: string;
    tour_date?: string;
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

  return (
    <div className="min-h-screen bg-[#FAFAF8] pb-24">
      {/* Hero Banner */}
      <div className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=800&h=500&fit=crop')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/70" />
        <div className="relative max-w-md mx-auto px-5 pt-14 pb-8">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-white/70 text-sm mb-1">{session ? `${userName}님을 위한` : "특별한"}</p>
            <h1 className="text-3xl font-extrabold text-white mb-2">이벤트 & 혜택</h1>
            <p className="text-white/50 text-xs">촬영권 · AI 보정권 · 디테일 보정권</p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-5 -mt-5 space-y-4">
        {/* 내 쿠폰 확인하기 — 은은한 스타일 */}
        <motion.button
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          onClick={() => setCouponModalOpen(true)}
          className="w-full rounded-2xl border border-gray-200 bg-white/80 p-4 flex items-center justify-between active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg border border-purple-200 bg-purple-50 flex items-center justify-center">
              <Ticket className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-700">내 쿠폰 확인하기</p>
              <p className="text-[11px] text-gray-400">투어 날짜 + 전화번호로 조회</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </motion.button>

        {/* 리워드 미션 리스트 */}
        <div id="reward-missions" className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">크레딧 미션</p>
            <div className="flex items-center gap-1 text-[10px] text-gray-400">
              <Zap className="w-3 h-3" />
              미션을 완료하고 크레딧 받기
            </div>
          </div>

          {eventsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-28 bg-white rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Gift className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">현재 진행 중인 이벤트가 없습니다.</p>
            </div>
          ) : (
            events.map((event, i) => (
              <RewardCard
                key={event._id}
                event={event}
                index={i}
                onClick={() => router.push(`/cheiz/events/${event._id}`)}
              />
            ))
          )}
        </div>

        {/* 프로모션 매거진 */}
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

        {/* 종료된 이벤트 */}
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

        {/* 안내 */}
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

      {/* 쿠폰 모달 */}
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
    </div>
  );
}
