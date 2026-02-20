import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const API_BASE_URL =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";

export const dynamic = "force-dynamic";

function sanitizeAuthHeader(rawToken: string): string {
  let pure = rawToken;
  while (/^Bearer\s+/i.test(pure)) pure = pure.replace(/^Bearer\s+/i, "");
  return `Bearer ${pure.trim()}`;
}

/**
 * GET /api/backend/folders/invitations/search
 * Java GET /api/v1/folders/invitations/search 프록시
 * Query: folderId, userId, acceptanceStatusSet, page, size, sortBy, sortDir
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const accessToken = (session as any)?.accessToken;

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const authHeader = sanitizeAuthHeader(accessToken);

    const queryParams = new URLSearchParams();
    const forwardKeys = ["folderId", "userId", "acceptanceStatusSet", "page", "size", "sortBy", "sortDir"];
    forwardKeys.forEach((key) => {
      const val = searchParams.get(key);
      if (val) queryParams.set(key, val);
    });

    if (!queryParams.has("page")) queryParams.set("page", "1");
    if (!queryParams.has("size")) queryParams.set("size", "20");

    const backendUrl = `${API_BASE_URL}/api/v1/folders/invitations/search?${queryParams.toString()}`;
    console.log(`[INVITATIONS_SEARCH] GET ${backendUrl}`);

    const res = await fetch(backendUrl, {
      method: "GET",
      headers: { Authorization: authHeader },
      cache: "no-store",
    });

    const text = await res.text();
    console.log(`[INVITATIONS_SEARCH] 응답: ${res.status} ${text.substring(0, 500)}`);

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: text, httpStatus: res.status },
        { status: res.status },
      );
    }

    let parsed: any;
    try { parsed = JSON.parse(text); } catch { parsed = {}; }

    return NextResponse.json({ success: true, data: parsed.data || parsed });
  } catch (e: any) {
    console.error("[INVITATIONS_SEARCH] 예외:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
