import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BUBBLE_API_TOKEN = process.env.BUBBLE_API_TOKEN || "";
const BUBBLE_API_BASE_URL = process.env.BUBBLE_API_BASE_URL || "";
const BUBBLE_USE_VERSION_TEST =
  process.env.BUBBLE_USE_VERSION_TEST === "true" ||
  process.env.BUBBLE_USE_VERSION_TEST === "1";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

function getBubbleBaseUrl(): string {
  const host = BUBBLE_API_BASE_URL.replace(/\/$/, "");
  const versionPath = BUBBLE_USE_VERSION_TEST ? "/version-test" : "";
  return `${host}${versionPath}/api/1.1/obj`;
}

/**
 * POST /api/webhooks/photo-arrive
 *
 * Java 백오피스에서 폴더 상태를 COMPLETED로 변경 시 호출.
 * Bubble notification 테이블에 PHOTO_ARRIVE 알림을 생성.
 *
 * Request body:
 * {
 *   userId: number,
 *   folderId: number,
 *   folderName: string,
 *   photoCount: number,
 *   secret: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, folderId, folderName, photoCount, secret } = body;

    if (!secret || secret !== WEBHOOK_SECRET) {
      console.error("[WEBHOOK_PHOTO] ❌ Invalid secret");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!userId || !folderId) {
      return NextResponse.json({ error: "userId and folderId are required" }, { status: 400 });
    }

    const bubbleUrl = `${getBubbleBaseUrl()}/notification`;
    const notifBody = {
      user_Id: Number(userId),
      type: "PHOTO_ARRIVE",
      title: "사진이 도착했어요! 📸",
      body: `${folderName || "촬영지"}에서 ${photoCount || 0}장의 사진이 준비됐어요`,
      link_id: Number(folderId),
      is_read: false,
    };

    const bubbleRes = await fetch(bubbleUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${BUBBLE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(notifBody),
      cache: "no-store",
    });

    if (!bubbleRes.ok) {
      const errText = await bubbleRes.text();
      console.error(`[WEBHOOK_PHOTO] Bubble 알림 생성 실패 ${bubbleRes.status}:`, errText);
      return NextResponse.json({ error: "Failed to create notification" }, { status: 502 });
    }

    console.log(`[WEBHOOK_PHOTO] ✅ PHOTO_ARRIVE 알림 생성 완료 → userId=${userId}, folderId=${folderId}`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[WEBHOOK_PHOTO] Exception:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
