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
 * POST /api/backend/gift-register
 *
 * 크레딧 미션 CLICK 타입: gift_Id로 기프트를 유저에게 등록
 * 백엔드: POST /api/v1/gifts/issued/register
 *
 * Body: { giftId: number }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const accessToken = (session as any)?.accessToken;
    const userLan = (session as any)?.user?.lan || "ko";

    if (!accessToken) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const { giftId } = body;

    if (!giftId) {
      return NextResponse.json({ error: "giftId가 필요합니다." }, { status: 400 });
    }

    const authHeader = sanitizeAuthHeader(accessToken);
    const endpoint = `${API_BASE_URL}/api/v1/gifts/issued/register`;

    const requestBody = { giftId: Number(giftId), dryRun: false };

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("[GIFT_REGISTER] POST /api/backend/gift-register");
    console.log(`[GIFT_REGISTER]   giftId: ${giftId}`);
    console.log(`[GIFT_REGISTER]   endpoint: ${endpoint}`);
    console.log(`[GIFT_REGISTER]   body: ${JSON.stringify(requestBody)}`);
    console.log(`[GIFT_REGISTER]   token: ${authHeader.substring(0, 40)}...`);

    const backendRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        "Accept-Language": userLan,
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await backendRes.text();
    console.log(`[GIFT_REGISTER]   응답: ${backendRes.status}`);
    console.log(`[GIFT_REGISTER]   body (500자): ${responseText.substring(0, 500)}`);

    if (!backendRes.ok) {
      let errorMsg = "기프트 등록에 실패했습니다.";
      let isDuplicate = false;
      try {
        const errParsed = JSON.parse(responseText);
        errorMsg = errParsed.message || errParsed.error || errorMsg;
        // 중복 등록 감지 (409 Conflict 또는 메시지 기반)
        if (
          backendRes.status === 409 ||
          errorMsg.includes("이미") ||
          errorMsg.includes("already") ||
          errorMsg.includes("duplicate")
        ) {
          isDuplicate = true;
          errorMsg = "이미 참여한 이벤트입니다.";
        }
      } catch {}

      console.log(`[GIFT_REGISTER]   ❌ 실패: ${errorMsg} (중복: ${isDuplicate})`);

      return NextResponse.json(
        { success: false, error: errorMsg, isDuplicate },
        { status: isDuplicate ? 200 : backendRes.status }
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = {};
    }

    console.log("[GIFT_REGISTER]   ✅ 기프트 등록 성공!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return NextResponse.json({
      success: true,
      data: parsed.data || parsed,
    });
  } catch (error: any) {
    console.error("[GIFT_REGISTER] ❌ 예외:", error);
    return NextResponse.json(
      { success: false, error: error.message || "기프트 등록 실패" },
      { status: 500 }
    );
  }
}
