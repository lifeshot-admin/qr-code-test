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
  return `Bearer ${pure.trim()}`;
}

/**
 * GET /api/backend/schedules
 *
 * 유저의 스케줄 목록 조회 (GET /api/v1/schedules)
 * getFallbackScheduleId()용 — 가장 최신 scheduleId 추출
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const accessToken = (session as any)?.accessToken;
    const userLan = (session as any)?.user?.lan || "ko";

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const backendUrl = `${API_BASE_URL}/api/v1/schedules`;
    const authHeader = sanitizeAuthHeader(accessToken);

    console.log(`[SCHEDULES] 스케줄 목록 조회 → ${backendUrl}`);

    const res = await fetch(backendUrl, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        "Accept-Language": userLan,
      },
      cache: "no-store",
    });

    const text = await res.text();
    console.log(`[SCHEDULES] 응답: ${res.status} (${text.length}bytes)`);

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `Backend ${res.status}` },
        { status: res.status },
      );
    }

    let parsed: any;
    try { parsed = JSON.parse(text); } catch { parsed = {}; }

    // 다중 경로 추출
    let schedules: any[] = [];
    if (Array.isArray(parsed.content)) schedules = parsed.content;
    else if (Array.isArray(parsed.data?.content)) schedules = parsed.data.content;
    else if (Array.isArray(parsed.data)) schedules = parsed.data;
    else if (Array.isArray(parsed)) schedules = parsed;

    console.log(`[SCHEDULES] ${schedules.length}건 추출`);

    // id 기준 내림차순 정렬 → 최신 scheduleId 확보
    const sorted = schedules
      .filter((s: any) => s.id)
      .sort((a: any, b: any) => Number(b.id) - Number(a.id));

    const latestScheduleId = sorted[0]?.id || null;
    console.log(`[SCHEDULES] 최신 scheduleId: ${latestScheduleId}`);

    return NextResponse.json({
      success: true,
      schedules: sorted.slice(0, 20),
      latestScheduleId,
    });
  } catch (e: any) {
    console.error("[SCHEDULES] 에러:", e.message);
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 },
    );
  }
}
