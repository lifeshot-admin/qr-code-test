import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAiFolder } from "@/lib/bubble";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";

function stripAllBearer(token: string): string {
  let t = token;
  while (/^Bearer\s+/i.test(t)) t = t.replace(/^Bearer\s+/i, "");
  return t.trim();
}

/**
 * 서버 사이드 토큰 갱신 (세션의 refreshToken 사용)
 */
async function tryRefreshToken(session: any): Promise<string | null> {
  const rawRefresh = (session as any)?.refreshToken || (session as any)?.user?.refreshToken;
  if (!rawRefresh) return null;
  const cleanRefresh = stripAllBearer(String(rawRefresh));
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/token/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept-Language": "ko" },
      body: JSON.stringify({ refreshToken: cleanRefresh }),
    });
    if (!res.ok) return null;
    const authHeader = res.headers.get("authorization") || res.headers.get("Authorization");
    if (authHeader) return stripAllBearer(authHeader);
    const data = await res.json();
    const bodyToken = data.data?.accessToken || data.accessToken || data.data?.access_token;
    return bodyToken ? stripAllBearer(String(bodyToken)) : null;
  } catch { return null; }
}

/**
 * POST /api/backend/ai-folder
 *
 * [Step 1] Bubble create-folder 워크플로우 호출 프록시
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const rawToken = (session as any)?.accessToken || "";
    const userId = (session as any)?.user?.id || "";

    if (!rawToken) {
      return NextResponse.json(
        { success: false, error: "인증이 만료되었습니다. 다시 로그인해주세요.", code: "AUTH_EXPIRED" },
        { status: 401 },
      );
    }

    let pureToken = stripAllBearer(rawToken);

    const body = await req.json();
    const scheduleId = Number(body.scheduleId);
    const hostUserId = Number(body.hostUserId) || Number(userId) || 0;
    const name = body.name || `AI_RETOUCH_${scheduleId}`;
    const personCount = Number(body.personCount) || 1;
    const sourceFolderId = body.sourceFolderId || null;

    if (!scheduleId) {
      return NextResponse.json(
        { success: false, error: "scheduleId is required" },
        { status: 400 },
      );
    }

    console.log(
      `[AI_FOLDER] Step 1 — scheduleId: ${scheduleId}, hostUserId: ${hostUserId}, name: ${name}, personCount: ${personCount}, source: ${sourceFolderId}`,
    );

    // credit: "false" → 결제대기(PAYMENT_PENDING) 잠금 없이 즉시 RESERVED 상태로 생성
    let result = await createAiFolder({
      token: pureToken,
      scheduleId,
      hostUserId,
      name,
      personCount,
      credit: "false",
    });

    console.log(`[AI_FOLDER] credit: false — 결제대기 우회 모드`);

    // 1차 실패 시 토큰 갱신 후 재시도
    if (!result.success) {
      const errStr = String(result.error || "");
      const isAuthError = errStr.includes("401") || errStr.includes("INVALID") || errStr.includes("Unauthorized") || errStr.includes("expired");
      console.warn(`[AI_FOLDER] 1차 실패: ${errStr}, 인증 관련: ${isAuthError}`);

      if (isAuthError) {
        console.log("[AI_FOLDER] 🔄 토큰 갱신 후 재시도...");
        const newToken = await tryRefreshToken(session);
        if (newToken) {
          result = await createAiFolder({
            token: newToken,
            scheduleId,
            hostUserId,
            name,
            personCount,
            credit: "false",
          });
          console.log(`[AI_FOLDER] 재시도 결과: ${result.success ? '성공' : '실패'}`);
        }
      }
    }

    if (!result.success) {
      console.error("[AI_FOLDER] 최종 실패:", result.error);
      const errStr = String(result.error || "");
      const isAuthErr = errStr.includes("401") || errStr.includes("INVALID") || errStr.includes("Unauthorized");
      return NextResponse.json(
        {
          success: false,
          error: isAuthErr ? "인증이 만료되었습니다. 다시 로그인해주세요." : result.error,
          code: isAuthErr ? "AUTH_EXPIRED" : undefined,
        },
        { status: isAuthErr ? 401 : 502 },
      );
    }

    console.log(`[AI_FOLDER] 성공 → folderId: ${result.folderId}`);

    return NextResponse.json({
      success: true,
      folderId: result.folderId,
    });
  } catch (e: any) {
    console.error("[AI_FOLDER] 에러:", e.message);
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 },
    );
  }
}
