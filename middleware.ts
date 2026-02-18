import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Middleware — 최소한의 인증 가드 (안전 복원 버전)
 *
 * 원칙:
 * - 대부분의 경로는 무조건 통과 (공개)
 * - /admin/** 만 로그인 필수 (role 체크 없음)
 * - /photographer/** 만 로그인 필수
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ━━━ 0) 정적 파일 & Next 내부 경로 → 무조건 통과 ━━━
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // ━━━ 1) /admin/login → 무조건 통과 ━━━
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  // ━━━ 2) /admin/** → 로그인 여부만 확인 ━━━
  if (pathname.startsWith("/admin")) {
    try {
      const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
      if (!token) {
        const url = new URL("/admin/login", request.url);
        url.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(url);
      }
    } catch (e) {
      // getToken 실패 시에도 통과 (루프 방지)
      return NextResponse.next();
    }
    return NextResponse.next();
  }

  // ━━━ 3) /photographer → 로그인만 필요 ━━━
  if (pathname.startsWith("/photographer")) {
    try {
      const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
      if (!token) {
        const url = new URL("/auth/signin", request.url);
        url.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(url);
      }
    } catch (e) {
      return NextResponse.next();
    }
    return NextResponse.next();
  }

  // ━━━ 그 외 모든 경로 → 무조건 통과 ━━━
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * /admin, /photographer 경로만 실질적으로 가드
     * 나머지는 미들웨어 함수 내에서 즉시 next() 반환
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
