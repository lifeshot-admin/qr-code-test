import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * RBAC Middleware - Role-Based Access Control
 * 
 * Rules:
 * - /cheiz/* : Requires 'User' role
 * - /photographer/* : Requires 'Photographer' role (or 'ROLE_SNAP')
 * - Unauthorized access → Redirect with toast notification
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths (no auth required)
  const publicPaths = [
    "/",
    "/api/auth",
    "/auth/signin",
    "/auth/signup",
    "/auth/error",
    "/_next",
    "/favicon.ico",
  ];

  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Get session token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Not authenticated → Redirect to signin
  if (!token) {
    const url = new URL("/auth/signin", request.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // Get user role from token
  const userRole = (token.role as string) || "User";

  // Role-based access control
  if (pathname.startsWith("/photographer")) {
    // Only Photographers (ROLE_SNAP) can access
    if (userRole !== "Photographer" && userRole !== "ROLE_SNAP") {
      console.log(`[RBAC] Access denied: ${userRole} attempted to access /photographer`);
      
      const url = new URL("/cheiz", request.url);
      url.searchParams.set("error", "access_denied");
      url.searchParams.set("message", "사진작가 전용 페이지입니다.");
      
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/cheiz")) {
    // Standard users can access
    // Photographers are also allowed (they can browse as users)
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
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
