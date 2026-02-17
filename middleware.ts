import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * RBAC Middleware - Role-Based Access Control
 * + 진단 로그 삽입 (범인 추적용)
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ━━━ [진단 로그] 모든 요청에 대해 경로 출력 ━━━
  console.log(`\n[MW] ========================================`);
  console.log(`[MW] 📍 pathname: ${pathname}`);
  console.log(`[MW] 🌐 full URL: ${request.nextUrl.href}`);

  // Public paths (no auth required)
  const publicPaths = [
    "/",
    "/api/auth",
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

  // ━━━ [진단 로그] 공개 경로 판단 결과 ━━━
  const matchedPublicPath = publicPaths.find((path) => pathname.startsWith(path));
  console.log(`[MW] 🔓 isLocalePublicPath: ${isLocalePublicPath}`);
  console.log(`[MW] 🔓 matchedPublicPath: ${matchedPublicPath || "NONE"}`);

  if (matchedPublicPath || isLocalePublicPath) {
    console.log(`[MW] ✅ PUBLIC — 통과 (${matchedPublicPath || "locale패턴"})`);
    return NextResponse.next();
  }

  // Get session token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // ━━━ [진단 로그] 토큰 상태 ━━━
  console.log(`[MW] 🔑 token 존재: ${!!token}`);
  if (token) {
    console.log(`[MW] 🔑 token.role: ${token.role || "없음"}`);
    console.log(`[MW] 🔑 token.email: ${token.email || "없음"}`);
    console.log(`[MW] 🔑 token.error: ${(token as any).error || "없음"}`);
  }

  // ━━━ Admin 경로 전용 처리 ━━━
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (!token) {
      console.log(`[MW] ❌ Admin 토큰 없음 → /admin/login`);
      const url = new URL("/admin/login", request.url);
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }

    const userRole = (token.role as string) || "User";
    const adminRoles = ["Admin", "SuperAdmin", "ROLE_ADMIN"];
    if (!adminRoles.includes(userRole)) {
      console.log(`[MW] ❌ Admin 권한 부족: role=${userRole}`);
      const url = new URL("/admin/login", request.url);
      url.searchParams.set("error", "access_denied");
      return NextResponse.redirect(url);
    }

    console.log(`[MW] ✅ Admin 통과`);
    return NextResponse.next();
  }

  // ━━━ 일반 경로: 토큰 없으면 로그인으로 ━━━
  if (!token) {
    console.log(`[MW] ❌ 토큰 없음 → /auth/signin (callbackUrl: ${pathname})`);
    const url = new URL("/auth/signin", request.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  const hasError = !!(token as any).error;
  if (hasError) {
    console.warn(`[MW] ⚠️ 토큰 에러: ${(token as any).error} — 통과시킴`);
  }

  const userRole = (token.role as string) || "User";

  // 일반 사용자 역할 목록 (Java 백엔드의 ROLE_USER, ROLE_SNAP 형식 모두 포함)
  const userAllowedRoles = ["User", "ROLE_USER", "Photographer", "ROLE_SNAP", "Admin", "SuperAdmin", "ROLE_ADMIN"];
  const photographerRoles = ["Photographer", "ROLE_SNAP", "Admin", "SuperAdmin", "ROLE_ADMIN"];

  if (pathname.startsWith("/photographer")) {
    if (!photographerRoles.includes(userRole)) {
      console.log(`[MW] ❌ 포토그래퍼 권한 부족: role="${userRole}" (허용: ${photographerRoles.join(",")})`);
      const url = new URL("/cheiz", request.url);
      url.searchParams.set("error", "access_denied");
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/cheiz")) {
    if (!userRole || !userAllowedRoles.includes(userRole)) {
      console.log(`[MW] ❌ /cheiz 권한 부족: role="${userRole}" (허용: ${userAllowedRoles.join(",")})`);
      const url = new URL("/auth/signin", request.url);
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }
  }

  console.log(`[MW] ✅ 최종 통과: ${pathname}`);
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
