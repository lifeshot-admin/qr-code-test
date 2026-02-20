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
 * GET /api/backend/check-schedule-availability?scheduleId={number}
 *
 * 해당 스케줄에 대해 현재 유저가 이미 예약(폴더 생성)을 했는지 검증.
 * Java GET /api/v1/folders?userId={userId} 결과에서 scheduleId 매칭 & 활성 상태 확인.
 *
 * Returns:
 *   { available: true }  → 예약 가능
 *   { available: false, reason: "..." } → 이미 예약됨
 */
export async function GET(req: NextRequest) {
  try {
    const scheduleId = req.nextUrl.searchParams.get("scheduleId");
    if (!scheduleId) {
      return NextResponse.json({ error: "scheduleId is required" }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    const accessToken = (session as any)?.accessToken;
    const userId = (session as any)?.user?.id;

    if (!accessToken || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authHeader = sanitizeAuthHeader(accessToken);
    const backendUrl = `${API_BASE_URL}/api/v1/folders?userId=${userId}`;

    console.log(`[SCHEDULE_CHECK] GET ${backendUrl} — scheduleId=${scheduleId}`);

    const res = await fetch(backendUrl, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        "Accept-Language": "ko",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(`[SCHEDULE_CHECK] 백엔드 실패: ${res.status}`);
      // 백엔드 에러 시 "가능"으로 처리 (실제 create-folder에서 최종 검증)
      return NextResponse.json({ available: true });
    }

    const text = await res.text();
    let parsed: any;
    try { parsed = JSON.parse(text); } catch { parsed = {}; }

    const folders = parsed.data?.content || parsed.content || parsed.data || [];
    if (!Array.isArray(folders)) {
      return NextResponse.json({ available: true });
    }

    const ACTIVE_STATUSES = ["RESERVED", "PENDING", "COMPLETED", "UPLOAD_COMPLETED", "PAYMENT_IN_PROGRESS"];
    const duplicate = folders.find((f: any) => {
      const fScheduleId = f.scheduleResponse?.id || f.scheduleId || f.schedule_id;
      const fStatus = f.status || "";
      return String(fScheduleId) === String(scheduleId) && ACTIVE_STATUSES.includes(fStatus);
    });

    if (duplicate) {
      console.log(`[SCHEDULE_CHECK] ⚠️ 중복 발견 — folderId: ${duplicate.id}, status: ${duplicate.status}`);
      return NextResponse.json({
        available: false,
        reason: "이미 예약된 스케줄이 있습니다. 다른 시간을 선택해주세요.",
        existingFolderId: duplicate.id,
      });
    }

    console.log(`[SCHEDULE_CHECK] ✅ 예약 가능 — scheduleId: ${scheduleId}`);
    return NextResponse.json({ available: true });
  } catch (e: any) {
    console.error("[SCHEDULE_CHECK] 예외:", e.message);
    return NextResponse.json({ available: true });
  }
}
