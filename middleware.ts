import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * RBAC Middleware - Role-Based Access Control
 * 
 * Rules:
 * - /cheiz/* : Requires 'User' role
 * - /photographer/* : Requires 'Photographer' role (or 'ROLE_SNAP')
 * - /admin/* : Requires 'Admin' / 'SuperAdmin' / 'ROLE_ADMIN' role
 * - /admin/login : Public (관리자 로그인 페이지)
 * - Unauthorized access → Redirect with toast notification
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths (no auth required)
  const publicPaths = [
    "/",
    "/api/auth",
    "/api/bubble/photo-count",
    "/api/bubble/reviews",
    "/api/bubble/tour",
    "/api/cron",
    "/auth/signin",
    "/auth/signup",
    "/auth/error",
    "/admin/login",
    "/_next",
    "/favicon.ico",
  ];

  // [locale] 경로는 인증 없이 접근 가능 (Public 홈페이지 + 투어 상세 페이지)
  const isLocalePublicPath = /^\/[a-z]{2}(\/|$)/.test(pathname);

  if (publicPaths.some((path) => pathname.startsWith(path)) || isLocalePublicPath) {
    return NextResponse.next();
  }

  // Get session token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // ━━━ Admin 경로 전용 처리 (토큰 없으면 /admin/login으로) ━━━
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (!token) {
      console.log(`[MIDDLEWARE] ❌ Admin 토큰 없음 → /admin/login (${pathname})`);
      const url = new URL("/admin/login", request.url);
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }

    const userRole = (token.role as string) || "User";
    const adminRoles = ["Admin", "SuperAdmin", "ROLE_ADMIN"];
    if (!adminRoles.includes(userRole)) {
      console.log(`[RBAC] Admin access denied: role=${userRole}, path=${pathname}`);
      const url = new URL("/admin/login", request.url);
      url.searchParams.set("error", "access_denied");
      url.searchParams.set("message", "관리자 전용 페이지입니다.");
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  // ━━━ 일반 경로: 토큰 없으면 일반 로그인으로 ━━━
  if (!token) {
    console.log(`[MIDDLEWARE] ❌ 토큰 없음 → 로그인 페이지로 리다이렉트 (${pathname})`);
    const url = new URL("/auth/signin", request.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  const hasError = !!(token as any).error;
  if (hasError) {
    console.warn(`[MIDDLEWARE] ⚠️ 토큰에 에러 있음: ${(token as any).error} — 하지만 통과시킴 (${pathname})`);
  }

  const userRole = (token.role as string) || "User";

  if (pathname.startsWith("/photographer")) {
    if (userRole !== "Photographer" && userRole !== "ROLE_SNAP") {
      console.log(`[RBAC] Access denied: ${userRole} attempted to access /photographer`);
      const url = new URL("/cheiz", request.url);
      url.searchParams.set("error", "access_denied");
      url.searchParams.set("message", "사진작가 전용 페이지입니다.");
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/cheiz")) {
    if (!userRole || (userRole !== "User" && userRole !== "Photographer" && userRole !== "ROLE_SNAP")) {
      console.log(`[RBAC] Invalid role: ${userRole}`);
      const url = new URL("/auth/signin", request.url);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
