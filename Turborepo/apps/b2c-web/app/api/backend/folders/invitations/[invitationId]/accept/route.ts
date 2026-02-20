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

const BUBBLE_API_TOKEN = process.env.BUBBLE_API_TOKEN || "";
const BUBBLE_API_BASE_URL = process.env.BUBBLE_API_BASE_URL || "";
const BUBBLE_USE_VERSION_TEST =
  process.env.BUBBLE_USE_VERSION_TEST === "true" ||
  process.env.BUBBLE_USE_VERSION_TEST === "1";

function getBubbleBaseUrl(): string {
  const host = BUBBLE_API_BASE_URL.replace(/\/$/, "");
  const versionPath = BUBBLE_USE_VERSION_TEST ? "/version-test" : "";
  return `${host}${versionPath}/api/1.1/obj`;
}

/**
 * POST /api/backend/folders/invitations/[invitationId]/accept
 * Java POST /api/v1/folders/invitation/{invitationId}/accept 프록시
 * 성공 시 INVITE_ACCEPT 알림을 방장에게 전송
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ invitationId: string }> }) {
  try {
    const { invitationId } = await params;
    const session = await getServerSession(authOptions);
    const accessToken = (session as any)?.accessToken;
    const acceptorNickname = (session as any)?.user?.nickname || (session as any)?.user?.name || "일행";
    const acceptorUserId = Number((session as any)?.user?.id);

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authHeader = sanitizeAuthHeader(accessToken);
    const backendUrl = `${API_BASE_URL}/api/v1/folders/invitation/${invitationId}/accept`;

    console.log(`[INVITE_ACCEPT] POST ${backendUrl}`);

    const res = await fetch(backendUrl, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
    });

    const text = await res.text();
    console.log(`[INVITE_ACCEPT] 응답: ${res.status} ${text.substring(0, 300)}`);

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: text, httpStatus: res.status },
        { status: res.status },
      );
    }

    let parsed: any;
    try { parsed = JSON.parse(text); } catch { parsed = {}; }

    // 수락 성공 후: 방장에게 INVITE_ACCEPT 알림 전송 (비동기, 실패해도 수락 자체는 성공)
    try {
      // invitationId로 초대 정보 조회 → folderId 추출
      const searchUrl = `${API_BASE_URL}/api/v1/folders/invitations/search?invitationId=${invitationId}`;
      const searchRes = await fetch(searchUrl, {
        method: "GET",
        headers: { Authorization: authHeader },
      });

      let hostUserId: number | null = null;
      let folderId: number | null = null;

      if (searchRes.ok) {
        const searchText = await searchRes.text();
        let searchData: any;
        try { searchData = JSON.parse(searchText); } catch { searchData = {}; }

        const invitations = searchData?.data?.content || searchData?.content || searchData?.data || [];
        const inv = Array.isArray(invitations) && invitations.length > 0
          ? invitations[0]
          : searchData?.data || searchData;

        folderId = inv?.folderId || inv?.folder_id || null;

        if (folderId) {
          // folderId로 폴더 정보 조회 → 방장 userId
          const folderUrl = `${API_BASE_URL}/api/v1/folders/${folderId}`;
          const folderRes = await fetch(folderUrl, {
            method: "GET",
            headers: { Authorization: authHeader },
          });

          if (folderRes.ok) {
            const folderText = await folderRes.text();
            let folderData: any;
            try { folderData = JSON.parse(folderText); } catch { folderData = {}; }
            const folder = folderData?.data || folderData;
            hostUserId = folder?.hostUserId || folder?.userId || null;
          }
        }
      }

      // 방장에게 Bubble notification 전송
      if (hostUserId && hostUserId !== acceptorUserId) {
        const bubbleUrl = `${getBubbleBaseUrl()}/notification`;
        await fetch(bubbleUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${BUBBLE_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_Id: hostUserId,
            type: "INVITE_ACCEPT",
            title: "초대가 수락되었습니다 🤝",
            body: `${acceptorNickname}님이 초대를 수락했어요`,
            link_id: folderId,
            is_read: false,
          }),
        });
        console.log(`[INVITE_ACCEPT] ✅ INVITE_ACCEPT 알림 전송 → hostUserId=${hostUserId}`);
      }
    } catch (notifErr: any) {
      console.error("[INVITE_ACCEPT] ⚠️ 알림 전송 실패 (수락 자체는 성공):", notifErr.message);
    }

    return NextResponse.json({ success: true, data: parsed.data || parsed });
  } catch (e: any) {
    console.error("[INVITE_ACCEPT] 예외:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
