"use client";

import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  // ━━━ /admin/login 페이지는 레이아웃 없이 children만 렌더링 ━━━
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  // 로딩 중 → 스켈레톤 (리다이렉트 X)
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-400 text-lg">로딩 중...</div>
      </div>
    );
  }

  // 미인증 → 안내 메시지만 표시 (리다이렉트 X)
  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-gray-500 mb-4">로그인이 필요합니다.</p>
          <button
            onClick={() => { window.location.href = "/admin/login"; }}
            className="px-6 py-2.5 bg-[#0055FF] text-white rounded-xl text-sm font-semibold"
          >
            관리자 로그인
          </button>
        </div>
      </div>
    );
  }

  // ━━━ 로그인 확인 완료 → 전체 레이아웃 렌더링 (role 체크 없음) ━━━
  const navItems = [
    { label: "대시보드", href: "/admin" },
    { label: "투어 관리", href: "/admin/tours" },
    { label: "예약 관리", href: "/admin/reservations" },
    { label: "주문 관리", href: "/admin/orders" },
    { label: "콘텐츠 관리", href: "/admin/content" },
    { label: "사진 관리", href: "/admin/photos" },
    { label: "쿠폰 관리", href: "/admin/coupons" },
    { label: "유저 관리", href: "/admin/users" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 사이드바 */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-xl font-bold text-[#0055FF]">Cheiz Admin</h1>
          <p className="text-xs text-gray-400 mt-1">{session.user?.email}</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[#0055FF] text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            className="w-full px-4 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            로그아웃
          </button>
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <main className="flex-1">
        <header className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-800">
              {navItems.find(n => pathname === n.href || (n.href !== "/admin" && pathname.startsWith(n.href)))?.label || "관리자"}
            </h2>
            <span className="text-sm text-gray-500">
              {session.user?.name || session.user?.email}
            </span>
          </div>
        </header>
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
