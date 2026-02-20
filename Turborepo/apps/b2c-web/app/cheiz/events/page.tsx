"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gift, Sparkles,
  MapPin, Clock, X, Search, Loader2, Copy, Check,
  Camera, Bot, Zap, CalendarClock, Flame,
} from "lucide-react";
import Image from "next/image";

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
  promotion?: string;
  expire_date?: string;
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
    gradient: "from-cheiz-primary to-[#00C2FF]",
    badgeColor: "bg-blue-100 text-blue-700",
  },
  AI: {
    label: "AI 보정권",
    sublabel: "AI 전체 보정",
    icon: <Bot className="w-4 h-4" />,
    gradient: "from-[#7B2BFF] to-[#C84BFF]",
    badgeColor: "bg-cheiz-primary/10 text-cheiz-dark",
  },
  RETOUCH: {
    label: "디테일 정밀 보정",
    sublabel: "디테일 보정",
    icon: <Sparkles className="w-4 h-4" />,
    gradient: "from-[#F59E0B] to-[#FBBF24]",
    badgeColor: "bg-amber-100 text-amber-700",
  },
};

function isExpired(dateStr?: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function RewardCard({ event, index, onClick }: { event: RewardEvent; index: number; onClick: () => void }) {
  const config = REWARD_TYPE_CONFIG[event.reward_type] || REWARD_TYPE_CONFIG.PHOTO;
  const remaining = daysUntil(event.expire_date);

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
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${config.badgeColor}`}>
              {config.icon}
              {config.sublabel}
            </span>
            {remaining !== null && remaining >= 0 && remaining <= 7 && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-500">
                <CalendarClock className="w-3 h-3" />
                D-{remaining === 0 ? "DAY" : remaining}
              </span>
            )}
          </div>
          {event.expire_date && (
            <p className="text-[10px] text-gray-400 mt-1">
              마감: {event.expire_date.slice(0, 10)}
            </p>
          )}
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

function PromoCard({ event, index, onClick }: { event: RewardEvent; index: number; onClick: () => void }) {
  const gradients = [
    "from-[#FF9A9E] to-[#FECFEF]",
    "from-[#667EEA] to-[#764BA2]",
    "from-[#F093FB] to-[#F5576C]",
    "from-[#4FACFE] to-[#00F2FE]",
  ];
  const bg = gradients[index % gradients.length];
  const remaining = daysUntil(event.expire_date);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.08 }}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${bg} p-6 min-h-[160px] flex flex-col justify-end cursor-pointer active:scale-[0.98] transition-transform shadow-sm`}
    >
      {event.badge_text && (
        <span className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-1 rounded-full">
          {event.badge_text}
        </span>
      )}
      {remaining !== null && remaining >= 0 && (
        <span className="absolute top-4 left-4 bg-black/20 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1">
          <Flame className="w-3 h-3" />
          {remaining === 0 ? "오늘 마감!" : `D-${remaining}`}
        </span>
      )}
      <div className="text-white/30 mb-3"><Camera className="w-10 h-10" /></div>
      <h3 className="text-xl font-bold text-white mb-1">{event.title}</h3>
      <p className="text-sm text-white/80">{event.subtitle || event.benefit_desc || ""}</p>
      {event.expire_date && (
        <p className="text-[11px] text-white/60 mt-2">마감: {event.expire_date.slice(0, 10)}</p>
      )}
    </motion.div>
  );
}

export default function EventsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const userName = (session?.user as any)?.nickname || session?.user?.name || "Cheiz";

  const [events, setEvents] = useState<RewardEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

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

  const { promoEvents, activeEvents, expiredEvents } = useMemo(() => {
    const promo: RewardEvent[] = [];
    const active: RewardEvent[] = [];
    const expired: RewardEvent[] = [];

    for (const evt of events) {
      if (isExpired(evt.expire_date)) {
        expired.push(evt);
      } else if (evt.promotion === "yes") {
        promo.push(evt);
      } else {
        active.push(evt);
      }
    }

    return { promoEvents: promo, activeEvents: active, expiredEvents: expired };
  }, [events]);

  /* 쿠폰 검색 관련 — 주석 처리 (나중에 재활성화 가능)
  const [couponModalOpen, setCouponModalOpen] = useState(false);
  const [tourDate, setTourDate] = useState("");
  const [phone4, setPhone4] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
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
  */

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

        {/* 시즌 프로모션 — DB에서 promotion=yes인 이벤트 */}
        {promoEvents.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">시즌 프로모션</p>
            </div>
            {promoEvents.map((evt, i) => (
              <PromoCard
                key={evt._id}
                event={evt}
                index={i}
                onClick={() => router.push(`/cheiz/events/${evt._id}`)}
              />
            ))}
          </div>
        )}

        {/* 크레딧 미션 리스트 */}
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
          ) : activeEvents.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Gift className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">현재 진행 중인 이벤트가 없습니다.</p>
            </div>
          ) : (
            activeEvents.map((event, i) => (
              <RewardCard
                key={event._id}
                event={event}
                index={i}
                onClick={() => router.push(`/cheiz/events/${event._id}`)}
              />
            ))
          )}
        </div>

        {/* 종료된 이벤트 */}
        {expiredEvents.length > 0 && (
          <div className="space-y-3 pt-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">종료된 이벤트</p>
            {expiredEvents.map((evt, i) => (
              <motion.div key={evt._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 + i * 0.05 }}
                className="bg-white rounded-2xl border border-gray-100 p-5 opacity-60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-600">{evt.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {evt.expire_date ? `마감: ${evt.expire_date.slice(0, 10)}` : "기간 종료"}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-full">종료</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}

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
    </div>
  );
}
