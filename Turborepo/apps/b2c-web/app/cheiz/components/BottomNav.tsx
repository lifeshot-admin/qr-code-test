"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Home, Sparkles, User, Bell } from "lucide-react";

const navItems = [
  { href: "/cheiz", label: "홈", icon: Home },
  { href: "/cheiz/events", label: "이벤트", icon: Sparkles },
  { href: "/cheiz/notifications", label: "알림", icon: Bell },
  { href: "/cheiz/mypage", label: "마이페이지", icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [hasUnread, setHasUnread] = useState(false);

  const userId = (session?.user as any)?.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/bubble/notifications?userId=${userId}&is_read=no`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setHasUnread((data.count ?? 0) > 0);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [userId, pathname]);

  const isEventDetail = /^\/cheiz\/events\/.+/.test(pathname);
  const isBookingDetail = /^\/cheiz\/my-tours\/\d+/.test(pathname);
  if (pathname.startsWith("/cheiz/reserve") || isEventDetail || isBookingDetail) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-md mx-auto flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive =
            item.href === "/cheiz"
              ? pathname === "/cheiz"
              : pathname.startsWith(item.href);

          const isBell = item.icon === Bell;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[48px] px-3 py-1.5 rounded-xl transition-colors active:scale-95 active:bg-gray-50 select-none touch-manipulation ${
                isActive
                  ? "text-cheiz-primary"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <div className="relative">
                <item.icon
                  className={`w-5 h-5 ${
                    isActive ? "stroke-[2.5]" : "stroke-[1.5]"
                  }`}
                />
                {isBell && hasUnread && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-cheiz-primary rounded-full" />
                )}
              </div>
              <span
                className={`text-[10px] leading-tight ${
                  isActive ? "font-bold" : "font-medium"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
