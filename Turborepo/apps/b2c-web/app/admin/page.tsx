"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  CalendarCheck, ShoppingCart, Users, Camera,
  TrendingUp, ArrowUpRight, Loader2,
} from "lucide-react";

type DashboardStats = {
  totalTours: number;
  totalUsers: number;
  todayReservations: number;
  monthlyRevenue: number;
};

function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  color,
}: {
  title: string;
  value: string;
  icon: any;
  trend?: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {trend && (
          <span className="flex items-center gap-0.5 text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
            <ArrowUpRight className="w-3 h-3" />
            {trend}
          </span>
        )}
      </div>
      <p className="text-2xl font-extrabold text-gray-900 mb-0.5">{value}</p>
      <p className="text-xs text-gray-400 font-medium">{title}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalTours: 0,
    totalUsers: 0,
    todayReservations: 0,
    monthlyRevenue: 0,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setStats({
        totalTours: 12,
        totalUsers: 847,
        todayReservations: 23,
        monthlyRevenue: 2340000,
      });
      setLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const userName = session?.user?.nickname || session?.user?.name || "관리자";

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h2 className="text-xl font-extrabold text-gray-900">
          안녕하세요, {userName}님
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          CHEIZ 백오피스에 오신 것을 환영합니다.
        </p>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
              <div className="w-10 h-10 bg-gray-200 rounded-xl mb-4" />
              <div className="h-7 bg-gray-200 rounded w-20 mb-1" />
              <div className="h-3 bg-gray-100 rounded w-28" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="활성 투어"
            value={String(stats.totalTours)}
            icon={Camera}
            color="bg-cheiz-primary"
          />
          <StatCard
            title="오늘 예약"
            value={String(stats.todayReservations)}
            icon={CalendarCheck}
            trend="+12%"
            color="bg-green-500"
          />
          <StatCard
            title="총 사용자"
            value={stats.totalUsers.toLocaleString()}
            icon={Users}
            trend="+5%"
            color="bg-cheiz-primary"
          />
          <StatCard
            title="이번 달 매출"
            value={`₩${(stats.monthlyRevenue / 10000).toFixed(0)}만`}
            icon={ShoppingCart}
            trend="+18%"
            color="bg-amber-500"
          />
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 최근 예약 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 text-sm">최근 예약</h3>
            <button className="text-xs text-cheiz-primary font-bold hover:underline">전체 보기</button>
          </div>
          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-8 h-8 bg-gray-200 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-gray-200 rounded w-32" />
                    <div className="h-2.5 bg-gray-100 rounded w-20" />
                  </div>
                  <div className="h-5 w-14 bg-gray-100 rounded-full" />
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400 text-center py-6">
                관리자 API 연동 후 표시됩니다.
              </p>
            )}
          </div>
        </div>

        {/* 빠른 작업 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 text-sm">빠른 작업</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "배너 수정", icon: "🖼️", href: "/admin/content" },
              { label: "이벤트 관리", icon: "🎁", href: "/admin/content" },
              { label: "리뷰 승인", icon: "⭐", href: "/admin/content" },
              { label: "쿠폰 발행", icon: "🎟️", href: "/admin/coupons" },
            ].map((action) => (
              <button
                key={action.label}
                onClick={() => window.location.href = action.href}
                className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-left"
              >
                <span className="text-lg">{action.icon}</span>
                <span className="text-sm font-medium text-gray-700">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-bold text-gray-900 text-sm mb-3">시스템 정보</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <p className="text-gray-400 mb-0.5">데이터 소스</p>
            <p className="font-bold text-gray-700">Java Backend + Bubble DB</p>
          </div>
          <div>
            <p className="text-gray-400 mb-0.5">결제 시스템</p>
            <p className="font-bold text-gray-700">Stripe</p>
          </div>
          <div>
            <p className="text-gray-400 mb-0.5">이메일</p>
            <p className="font-bold text-gray-700">SendGrid</p>
          </div>
          <div>
            <p className="text-gray-400 mb-0.5">환경</p>
            <p className="font-bold text-gray-700">{process.env.NODE_ENV}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
