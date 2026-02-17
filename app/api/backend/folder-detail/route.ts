import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";

export const dynamic = "force-dynamic";

function sanitizeAuthHeader(rawToken: string): string {
  let pure = rawToken;
  while (/^Bearer\s+/i.test(pure)) {
    pure = pure.replace(/^Bearer\s+/i, "");
  }
  return `Bearer ${pure.trim()}`;
}

/**
 * GET /api/backend/folder-detail?folderId=...
 *
 * 자바 백엔드 GET /api/v1/folders/{folderId} 프록시
 * 폴더 상세 정보(scheduleId, name, personCount 등)를 반환
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId");

    if (!folderId) {
      return NextResponse.json(
        { success: false, error: "folderId is required" },
        { status: 400 },
      );
    }

    const session = await getServerSession(authOptions);
    const accessToken = (session as any)?.accessToken;
    const userLan = (session as any)?.user?.lan || "ko";

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const backendUrl = `${API_BASE_URL}/api/v1/folders/${folderId}`;
    const authHeader = sanitizeAuthHeader(accessToken);

    console.log(`[FOLDER_DETAIL] 조회 → ${backendUrl}`);

    const res = await fetch(backendUrl, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        "Accept-Language": userLan,
      },
      cache: "no-store",
    });

    const text = await res.text();
    console.log(`[FOLDER_DETAIL] 응답: ${res.status}`);

    if (!res.ok) {
      console.error(`[FOLDER_DETAIL] 실패: ${text.substring(0, 300)}`);
      return NextResponse.json(
        { success: false, error: `Backend ${res.status}`, detail: text.substring(0, 300) },
        { status: res.status },
      );
    }

    let parsed: any;
    try { parsed = JSON.parse(text); } catch { parsed = {}; }

    const folder = parsed.data || parsed;

    console.log(`[FOLDER_DETAIL] 폴더 정보 — scheduleId: ${folder.scheduleId}, name: ${folder.name}, personCount: ${folder.personCount}`);

    return NextResponse.json({
      success: true,
      folder: {
        id: folder.id,
        scheduleId: folder.scheduleId || folder.schedule_id || null,
        name: folder.name || folder.folderName || "",
        personCount: folder.personCount || folder.person_count || 1,
        status: folder.status || "",
        hostUserId: folder.hostUserId || folder.host_user_id || folder.userId || null,
        createdAt: folder.createdAt || folder.created_at || null,
      },
    });
  } catch (e: any) {
    console.error("[FOLDER_DETAIL] 에러:", e.message);
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 },
    );
  }
}
