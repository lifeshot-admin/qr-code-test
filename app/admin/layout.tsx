"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Map, Camera, CalendarCheck, ShoppingCart,
  Users, FileText, Ticket, FolderOpen, ChevronLeft, ChevronRight,
  LogOut, Settings,
} from "lucide-react";
import { signOut } from "next-auth/react";

const ADMIN_ROLES = ["Admin", "SuperAdmin", "ROLE_ADMIN"];

const MENU_ITEMS = [
  { href: "/admin", label: "대시보드", icon: LayoutDashboard },
  { href: "/admin/tours", label: "투어 관리", icon: Map },
  { href: "/admin/reservations", label: "예약 관리", icon: CalendarCheck },
  { href: "/admin/orders", label: "주문 & 결제", icon: ShoppingCart },
  { href: "/admin/users", label: "사용자 관리", icon: Users },
  { href: "/admin/content", label: "콘텐츠 관리", icon: FileText },
  { href: "/admin/coupons", label: "쿠폰 & 크레딧", icon: Ticket },
  { href: "/admin/photos", label: "사진 & AI", icon: FolderOpen },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // /admin/login 페이지는 레이아웃 없이 children만 렌더링
  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (isLoginPage) return; // 로그인 페이지에서는 리다이렉트 하지 않음
    if (status === "authenticated" && session?.user?.role) {
      if (!ADMIN_ROLES.includes(session.user.role)) {
        router.replace("/cheiz");
      }
    }
    if (status === "unauthenticated") {
      router.replace("/admin/login?callbackUrl=/admin");
    }
  }, [status, session, router, isLoginPage]);

  // 로그인 페이지는 사이드바/헤더 없이 렌더링
  if (isLoginPage) {
    return <>{children}</>;
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-12 h-12 bg-gray-200 rounded-xl mx-auto mb-3" />
          <div className="h-4 w-24 bg-gray-200 rounded mx-auto" />
        </div>
      </div>
    );
  }

  if (!session || !ADMIN_ROLES.includes(session.user.role || "")) {
    return null;
  }

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full bg-white border-r border-gray-200 z-40 transition-all duration-300 flex flex-col ${collapsed ? "w-[68px]" : "w-[240px]"}`}>
        {/* Logo */}
        <div className={`h-16 flex items-center border-b border-gray-100 px-4 ${collapsed ? "justify-center" : "gap-3"}`}>
          <div className="w-8 h-8 bg-[#0055FF] rounded-lg flex items-center justify-center flex-shrink-0">
            <Settings className="w-4 h-4 text-white" />
          </div>
          {!collapsed && <span className="font-bold text-gray-900 text-sm">CHEIZ Admin</span>}
        </div>

        {/* Menu */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? "bg-[#0055FF]/10 text-[#0055FF]"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                } ${collapsed ? "justify-center" : ""}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${active ? "text-[#0055FF]" : ""}`} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-100 p-2 space-y-0.5">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all"
          >
            {collapsed ? <ChevronRight className="w-5 h-5 mx-auto" /> : <><ChevronLeft className="w-5 h-5" /><span>접기</span></>}
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all ${collapsed ? "justify-center" : ""}`}
          >
            <LogOut className="w-5 h-5" />
            {!collapsed && <span>로그아웃</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${collapsed ? "ml-[68px]" : "ml-[240px]"}`}>
        {/* Top Bar */}
        <header className="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur-lg border-b border-gray-100 flex items-center justify-between px-6">
          <div>
            <h1 className="text-sm font-bold text-gray-900">
              {MENU_ITEMS.find((m) => isActive(m.href))?.label || "관리자"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-bold text-gray-700">{session.user.nickname || session.user.name}</p>
              <p className="text-[10px] text-gray-400">{session.user.role}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#0055FF] flex items-center justify-center text-white text-xs font-bold">
              {(session.user.nickname || session.user.name || "A").charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
