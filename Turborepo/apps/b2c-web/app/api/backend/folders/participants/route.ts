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
 * GET /api/backend/folders/participants?scheduleId={number}&excludeUserId={number}
 * Java GET /api/v1/folders/participants 프록시
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const accessToken = (session as any)?.accessToken;

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const scheduleId = searchParams.get("scheduleId");
    if (!scheduleId) {
      return NextResponse.json({ error: "scheduleId is required" }, { status: 400 });
    }

    const authHeader = sanitizeAuthHeader(accessToken);
    const queryParams = new URLSearchParams({ scheduleId });

    const excludeUserId = searchParams.get("excludeUserId");
    if (excludeUserId) queryParams.set("excludeUserId", excludeUserId);

    const backendUrl = `${API_BASE_URL}/api/v1/folders/participants?${queryParams.toString()}`;
    console.log(`[PARTICIPANTS] GET ${backendUrl}`);

    const res = await fetch(backendUrl, {
      method: "GET",
      headers: { Authorization: authHeader },
      cache: "no-store",
    });

    const text = await res.text();
    console.log(`[PARTICIPANTS] 응답: ${res.status} ${text.substring(0, 300)}`);

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
    console.error("[PARTICIPANTS] 예외:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
