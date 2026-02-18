"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Sparkles, User } from "lucide-react";

const navItems = [
  { href: "/cheiz", label: "홈", icon: Home },
  { href: "/cheiz/events", label: "이벤트", icon: Sparkles },
  { href: "/cheiz/mypage", label: "마이페이지", icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();

  // 몰입형 페이지에서는 GNB 숨김
  const isEventDetail = /^\/cheiz\/events\/.+/.test(pathname);
  if (pathname.startsWith("/cheiz/reserve") || isEventDetail) {
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

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[48px] px-3 py-1.5 rounded-xl transition-colors active:scale-95 active:bg-gray-50 select-none touch-manipulation ${
                isActive
                  ? "text-[#0055FF]"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <item.icon
                className={`w-5 h-5 ${
                  isActive ? "stroke-[2.5]" : "stroke-[1.5]"
                }`}
              />
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
