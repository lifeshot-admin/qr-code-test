"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Bell, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

type Notification = {
  _id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  link_id: number | null;
  link_id_bubble: string | null;
  user_Id: number;
  "Created Date": string;
};

const TYPE_CONFIG: Record<string, { emoji: string; route?: (linkId: number) => string }> = {
  BOOKING_COMPLETE:  { emoji: "📅", route: (id) => `/cheiz/my-tours/${id}` },
  BOOKING_CANCEL:    { emoji: "❌" },
  PHOTO_ARRIVE:      { emoji: "📸", route: (id) => `/cheiz/folder/${id}/arrive` },
  PAYMENT_COMPLETE:  { emoji: "💳", route: (id) => `/cheiz/my-tours/${id}` },
  POSE_COMPLETE:     { emoji: "🎭" },
  RETOUCH_COMPLETE:  { emoji: "✨", route: (id) => `/cheiz/folder/${id}` },
  INVITE_ARRIVE:     { emoji: "💌" },
  INVITE_SENT:       { emoji: "📨" },
  INVITE_ACCEPT:     { emoji: "🤝" },
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return `${Math.floor(days / 30)}개월 전`;
}

export default function NotificationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const userId = (session?.user as any)?.id;

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/bubble/notifications?userId=${userId}`);
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.replace("/auth/signin?callbackUrl=/cheiz/notifications");
      return;
    }
    fetchNotifications();
  }, [status, session, fetchNotifications, router]);

  const markAsRead = async (id: string) => {
    try {
      await fetch("/api/bubble/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, is_read: true } : n))
      );
    } catch {}
  };

  const handleClick = (n: Notification) => {
    const config = TYPE_CONFIG[n.type];
    markAsRead(n._id);

    if (config?.route && n.link_id) {
      router.push(config.route(n.link_id));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center pb-20">
        <Loader2 className="w-8 h-8 text-cheiz-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-md mx-auto px-5 py-4">
          <h1 className="text-lg font-bold text-cheiz-text">알림</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-24 gap-3">
            <div className="w-16 h-16 rounded-full bg-cheiz-surface flex items-center justify-center">
              <Bell className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-sm text-cheiz-sub">아직 알림이 없어요</p>
          </div>
        ) : (
          <div>
            {notifications.map((n, idx) => {
              const config = TYPE_CONFIG[n.type] || { emoji: "🔔" };
              const hasRoute = !!(config.route && n.link_id);

              return (
                <motion.button
                  key={n._id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  onClick={() => handleClick(n)}
                  className={`w-full flex items-start gap-3 px-5 py-4 text-left transition-colors active:bg-gray-50 border-b border-gray-50 ${
                    n.is_read ? "bg-white" : "bg-cheiz-surface/50"
                  }`}
                >
                  {!n.is_read && (
                    <span className="absolute left-2 mt-5 w-1.5 h-1.5 bg-cheiz-primary rounded-full flex-shrink-0" />
                  )}

                  <div className="w-10 h-10 rounded-full bg-cheiz-surface flex items-center justify-center text-lg flex-shrink-0 relative">
                    {!n.is_read && (
                      <span className="absolute -top-0.5 -left-0.5 w-2 h-2 bg-cheiz-primary rounded-full" />
                    )}
                    {config.emoji}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${n.is_read ? "text-cheiz-text" : "text-cheiz-text font-medium"}`}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-xs text-cheiz-sub mt-0.5 line-clamp-2">{n.body}</p>
                    )}
                  </div>

                  <span className="text-[10px] text-cheiz-sub whitespace-nowrap flex-shrink-0 pt-0.5">
                    {relativeTime(n["Created Date"])}
                  </span>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
