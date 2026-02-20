import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const API_BASE_URL =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";

export const dynamic = "force-dynamic";

function sanitizeAuthHeader(rawToken: string): string {
  let pure = rawToken;
  while (/^Bearer\s+/i.test(pure)) {
    pure = pure.replace(/^Bearer\s+/i, "");
  }
  pure = pure.trim();
  return `Bearer ${pure}`;
}

/**
 * GET /api/backend/user-search-nickname?nickname=...&page=1&size=10
 * Proxies to Java GET /api/v1/user/search/nickname
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const nickname = searchParams.get("nickname");
    const page = searchParams.get("page") || "1";
    const size = searchParams.get("size") || "10";

    if (!nickname || nickname.trim().length < 2) {
      return NextResponse.json({ content: [] });
    }

    const session = await getServerSession(authOptions);
    const accessToken = (session as any)?.accessToken;

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = new URLSearchParams({ nickname, page, size });
    const backendUrl = `${API_BASE_URL}/api/v1/user/search/nickname?${params.toString()}`;
    const authHeader = sanitizeAuthHeader(accessToken);

    const res = await fetch(backendUrl, {
      method: "GET",
      headers: { Authorization: authHeader },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[USER_SEARCH] Backend ${res.status}:`, errText.substring(0, 200));
      return NextResponse.json({ content: [] }, { status: res.status });
    }

    const data = await res.json();

    const content = data?.data?.content || data?.content || data?.data || [];
    return NextResponse.json({ content: Array.isArray(content) ? content : [] });
  } catch (error: any) {
    console.error("[USER_SEARCH] Exception:", error?.message);
    return NextResponse.json({ content: [] }, { status: 500 });
  }
}
