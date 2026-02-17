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
  pure = pure.trim();
  return `Bearer ${pure}`;
}

/**
 * PATCH /api/backend/user
 * 프로필 수정: 닉네임, 언어
 * Body: { nickname?: string, language?: string }
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const accessToken = (session as any)?.accessToken;
    const userId = (session as any)?.user?.id;

    if (!accessToken || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const authHeader = sanitizeAuthHeader(accessToken);

    console.log("[USER_API] PATCH /api/backend/user");
    console.log(`[USER_API]   userId: ${userId}`);
    console.log(`[USER_API]   body: ${JSON.stringify(body)}`);

    const backendRes = await fetch(`${API_BASE_URL}/api/v1/user/${userId}`, {
      method: "PATCH",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        "Accept-Language": body.language || "ko",
      },
      body: JSON.stringify(body),
    });

    const text = await backendRes.text();
    console.log(`[USER_API]   응답: ${backendRes.status} ${text.substring(0, 300)}`);

    if (!backendRes.ok) {
      return NextResponse.json(
        { error: "프로필 수정 실패", detail: text },
        { status: backendRes.status }
      );
    }

    let parsed: any;
    try { parsed = JSON.parse(text); } catch { parsed = {}; }

    return NextResponse.json({ success: true, data: parsed.data || parsed });
  } catch (error: any) {
    console.error("[USER_API] PATCH 예외:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/backend/user
 * 회원탈퇴
 * Query: ?reasons=reason1,reason2
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const accessToken = (session as any)?.accessToken;
    const userId = (session as any)?.user?.id;

    if (!accessToken || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authHeader = sanitizeAuthHeader(accessToken);
    const { searchParams } = new URL(request.url);
    const reasons = searchParams.get("reasons") || "";

    console.log("[USER_API] DELETE /api/backend/user");
    console.log(`[USER_API]   userId: ${userId}, reasons: ${reasons}`);

    const backendUrl = `${API_BASE_URL}/api/v1/user/${userId}${reasons ? `?reasons=${encodeURIComponent(reasons)}` : ""}`;

    const backendRes = await fetch(backendUrl, {
      method: "DELETE",
      headers: {
        Authorization: authHeader,
        "Accept-Language": "ko",
      },
    });

    const text = await backendRes.text();
    console.log(`[USER_API]   삭제 응답: ${backendRes.status} ${text.substring(0, 300)}`);

    if (!backendRes.ok) {
      return NextResponse.json(
        { error: "회원탈퇴 실패", detail: text },
        { status: backendRes.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[USER_API] DELETE 예외:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * GET /api/backend/user?action=check-nickname&nickname=xxx
 * GET /api/backend/user?action=withdrawal-reasons
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const accessToken = (session as any)?.accessToken;

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authHeader = sanitizeAuthHeader(accessToken);
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    // ━━━ action=me : GET /api/v1/user/me → 최신 유저 프로필 조회 ━━━
    if (action === "me") {
      const userLan = (session as any)?.user?.lan || "ko";
      console.log("[USER_API] GET /api/v1/user/me — 최신 프로필 동기화");

      const backendRes = await fetch(`${API_BASE_URL}/api/v1/user/me`, {
        headers: {
          Authorization: authHeader,
          "Accept-Language": userLan,
        },
      });

      const text = await backendRes.text();
      console.log(`[USER_API]   /me 응답 (${backendRes.status}): ${text.substring(0, 500)}`);

      if (!backendRes.ok) {
        return NextResponse.json({ success: false, error: "프로필 조회 실패" }, { status: backendRes.status });
      }

      let parsed: any;
      try { parsed = JSON.parse(text); } catch { parsed = {}; }

      const userData = parsed.data || parsed;

      // ✅ 형님이 지시한 로그: 닉네임에 "음!" 또는 "정윤식"이 들어있는지 확인
      const nickname = userData.nickname || userData.name || "";
      const profileImage = userData.profileImageUrl || userData.profileImage || userData.image || "";
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("[USER_ME] 📋 최신 유저 데이터:");
      console.log(`  🏷️ nickname: "${nickname}"`);
      console.log(`  🖼️ profileImage: "${profileImage ? profileImage.substring(0, 80) + '...' : '없음'}"`);
      console.log(`  📧 email: "${userData.email || ''}"`);
      console.log(`  🌐 language: "${userData.lan || userData.language || ''}"`);
      console.log(`  🔑 id: ${userData.id || 'N/A'}`);
      console.log(`  ✅ "음!" 포함: ${nickname.includes("음!") ? "YES" : "NO"}`);
      console.log(`  ✅ "정윤식" 포함: ${nickname.includes("정윤식") ? "YES" : "NO"}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      return NextResponse.json({
        success: true,
        user: {
          id: userData.id,
          nickname,
          name: userData.name || nickname,
          email: userData.email || "",
          image: profileImage,
          profileImageUrl: profileImage,
          role: userData.role || "User",
          lan: userData.lan || userData.language || "ko",
        },
      });
    }

    if (action === "check-nickname") {
      const nickname = searchParams.get("nickname") || "";
      console.log(`[USER_API] GET 닉네임 중복 검사: "${nickname}"`);

      const backendRes = await fetch(
        `${API_BASE_URL}/api/v1/user/search/nickname?nickname=${encodeURIComponent(nickname)}`,
        {
          headers: {
            Authorization: authHeader,
            "Accept-Language": "ko",
          },
        }
      );

      const text = await backendRes.text();
      let parsed: any;
      try { parsed = JSON.parse(text); } catch { parsed = {}; }

      console.log(`[USER_API]   닉네임 중복 체크 응답 (${backendRes.status}):`, text.substring(0, 300));

      // 다양한 백엔드 응답 구조에 대응
      const isDuplicate =
        parsed.data?.length > 0 ||
        parsed.isDuplicate === true ||
        parsed.exists === true ||
        parsed.duplicate === true ||
        (parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data) && parsed.data.id) ||
        backendRes.status === 409;

      console.log(`[USER_API]   결과: isDuplicate=${isDuplicate}, available=${!isDuplicate}`);

      return NextResponse.json({
        success: true,
        available: !isDuplicate,
        nickname,
      });
    }

    if (action === "withdrawal-reasons") {
      console.log("[USER_API] GET 탈퇴 사유 목록");

      const backendRes = await fetch(
        `${API_BASE_URL}/api/v1/user/withdrawal-reasons`,
        {
          headers: {
            Authorization: authHeader,
            "Accept-Language": "ko",
          },
        }
      );

      const text = await backendRes.text();
      let parsed: any;
      try { parsed = JSON.parse(text); } catch { parsed = {}; }

      const reasons = parsed.data || parsed.reasons || parsed || [];

      return NextResponse.json({ success: true, reasons: Array.isArray(reasons) ? reasons : [] });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("[USER_API] GET 예외:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
