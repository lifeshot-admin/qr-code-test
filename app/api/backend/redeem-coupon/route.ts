import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";

export const dynamic = "force-dynamic";

/**
 * ✅ Bearer 세척 유틸 (route 내부용)
 * 세션의 accessToken이 이미 "Bearer xxx"일 수 있으므로
 * 이중 Bearer 원천 차단: 모든 Bearer 접두사 제거 → trim → 한 번만 조립
 */
function sanitizeAuthHeader(rawToken: string): string {
  let pure = rawToken;
  while (/^Bearer\s+/i.test(pure)) {
    pure = pure.replace(/^Bearer\s+/i, "");
  }
  pure = pure.trim();
  return `Bearer ${pure}`;
}

/**
 * ✅ SNAP → PHOTO 강제 치환
 * 백엔드가 SNAP으로 보내도 프론트에서는 무조건 PHOTO로 처리
 */
function normalizeCredType(rawType: string): string {
  const upper = rawType.toUpperCase().trim();
  if (upper === "SNAP" || upper === "SNAP_DOWNLOAD" || upper === "DOWNLOAD") return "PHOTO";
  if (upper === "AI" || upper === "AI_RETOUCH") return "AI_RETOUCH";
  return upper;
}

/**
 * ✅ 크레딧 파싱 공통 로직 (register/redeem 응답 모두 사용)
 * - SNAP 키는 PHOTO로 강제 치환
 * - 깊은 경로 탐색 (credits/addedCredits/balances/items)
 */
function parseCreditResponse(data: any): {
  photo: number; ai: number; retouch: number;
} {
  let photo = 0;
  let ai = 0;
  let retouch = 0;

  // ━━━ 전략 1: data.credits / data.addedCredits / data.balances 오브젝트 ━━━
  const creditObj = data.credits || data.addedCredits || data.balances;
  if (creditObj && typeof creditObj === "object") {
    // PHOTO 또는 SNAP 키 모두 PHOTO로 합산
    photo =
      creditObj.PHOTO?.count ?? creditObj.PHOTO ??
      creditObj.SNAP?.count ?? creditObj.SNAP ??
      creditObj.photoCredits ?? creditObj.photo ?? 0;
    ai =
      creditObj.AI_RETOUCH?.count ?? creditObj.AI_RETOUCH ??
      creditObj.AI?.count ?? creditObj.AI ??
      creditObj.aiCredits ?? 0;
    retouch =
      creditObj.RETOUCH?.count ?? creditObj.RETOUCH ??
      creditObj.retouchCredits ?? 0;
  }

  // ━━━ 전략 2: 플랫 키 ━━━
  if (photo === 0 && ai === 0 && retouch === 0) {
    photo = data.addedPhoto ?? data.photoCount ?? data.PHOTO ?? data.SNAP ?? 0;
    ai = data.addedAi ?? data.aiCount ?? data.AI_RETOUCH ?? data.AI ?? 0;
    retouch = data.addedRetouch ?? data.retouchCount ?? data.RETOUCH ?? 0;
  }

  // ━━━ 전략 3: items 배열 (SNAP → PHOTO 강제 치환) ━━━
  const items = data.items || data.giftItems;
  if (Array.isArray(items)) {
    for (const item of items) {
      const type = normalizeCredType(item.type || item.creditType || "");
      const cnt = item.count ?? item.quantity ?? 1;
      if (type === "PHOTO") photo += cnt;
      else if (type === "AI_RETOUCH") ai += cnt;
      else if (type === "RETOUCH") retouch += cnt;
    }
  }

  return { photo, ai, retouch };
}

/**
 * POST /api/backend/redeem-coupon
 *
 * ✅ 3단계 쿠폰 프로세스:
 *
 *   action="preview"  → POST /api/v1/gifts/issued/register + dryRun:true
 *                        토큰 없이 호출 → 쿠폰 정보만 미리보기 (소유권 X)
 *
 *   action="register" → POST /api/v1/gifts/issued/register + dryRun:false
 *                        토큰 필수 → 계정에 쿠폰 귀속 (소유권 확정)
 *
 *   action="redeem"   → POST /api/v1/gifts/issued/redeem
 *                        토큰 필수 → 쿠폰을 크레딧으로 전환
 *
 * ✅ Implicit Identity: Body에 userId 없음, 헤더로만 식별
 * ✅ SNAP → PHOTO 강제 치환
 *
 * Body: { couponCode: string, action: "preview"|"register"|"redeem" }
 * (하위호환: dryRun=true → preview, dryRun=false → redeem)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const accessToken = (session as any)?.accessToken;

    const body = await request.json();
    const { couponCode, dryRun } = body;

    // ✅ action 결정: 명시적 action 우선, 없으면 dryRun 하위호환
    let action: "preview" | "register" | "redeem" = body.action || "preview";
    if (!body.action) {
      // 하위호환: 기존 dryRun 방식
      action = dryRun === false ? "redeem" : "preview";
    }

    if (!couponCode || typeof couponCode !== "string" || couponCode.trim().length === 0) {
      return NextResponse.json(
        { error: "couponCode is required" },
        { status: 400 }
      );
    }

    const cleanCode = couponCode.trim();

    const actionLabels = {
      preview: "1단계 조회 (Preview)",
      register: "2단계 등록 (Register → 소유권 확정)",
      redeem: "3단계 전환 (Redeem → 크레딧)",
    };

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`[COUPON] 🎟️ POST /api/backend/redeem-coupon`);
    console.log(`[COUPON]   🎯 action: ${action} — ${actionLabels[action]}`);
    console.log(`[COUPON]   🔑 accessToken 존재: ${!!accessToken}`);
    console.log(`[COUPON]   🎫 couponCode: ${cleanCode}`);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ✅ 엔드포인트 + 요청 본문 결정
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let endpoint: string;
    let requestBody: any;

    if (action === "preview") {
      // ━━━ 1단계: register + dryRun:true (조회만, 소유권 X) ━━━
      endpoint = `${API_BASE_URL}/api/v1/gifts/issued/register`;
      requestBody = { redeemCode: cleanCode, dryRun: true };
    } else if (action === "register") {
      // ━━━ 2단계: register + dryRun:false (소유권 확정) ━━━
      endpoint = `${API_BASE_URL}/api/v1/gifts/issued/register`;
      requestBody = { redeemCode: cleanCode, dryRun: false };
    } else {
      // ━━━ 3단계: redeem (크레딧 전환) ━━━
      endpoint = `${API_BASE_URL}/api/v1/gifts/issued/redeem`;
      requestBody = { redeemCode: cleanCode };
    }

    console.log(`[COUPON]   📡 백엔드 URL: ${endpoint}`);
    console.log(`[COUPON]   📦 body: ${JSON.stringify(requestBody)}`);

    // ━━━ 요청 실행 ━━━
    let backendRes: Response;
    let responseText: string;

    if (action === "preview") {
      // ✅ 1단계(조회)는 토큰 없이 먼저 시도
      console.log(`[COUPON]   🔓 [preview] 토큰 없이 시도...`);
      const noAuthRes = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept-Language": "ko" },
        body: JSON.stringify(requestBody),
      });

      console.log(`[COUPON]   📥 [preview 토큰 없음] 응답: ${noAuthRes.status}`);

      if (noAuthRes.ok) {
        backendRes = noAuthRes;
        responseText = await noAuthRes.text();
      } else if (noAuthRes.status === 401 || noAuthRes.status === 403) {
        // 인증 필요 시 토큰 포함 재시도
        console.log(`[COUPON]   🔐 [preview] 인증 필요 → 토큰 포함 재시도`);
        if (!accessToken) {
          return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }
        const authRes = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: sanitizeAuthHeader(accessToken),
            "Content-Type": "application/json",
            "Accept-Language": "ko",
          },
          body: JSON.stringify(requestBody),
        });
        backendRes = authRes;
        responseText = await authRes.text();
      } else {
        backendRes = noAuthRes;
        responseText = await noAuthRes.text();
      }
    } else {
      // ✅ 2단계(등록) & 3단계(전환)는 토큰 필수
      if (!accessToken) {
        return NextResponse.json(
          { error: "Unauthorized - 로그인이 필요합니다." },
          { status: 401 }
        );
      }
      const authHeader = sanitizeAuthHeader(accessToken);

      backendRes = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          "Accept-Language": "ko",
        },
        body: JSON.stringify(requestBody),
      });
      responseText = await backendRes.text();
      console.log(`[COUPON]   📥 [${action}] 응답: ${backendRes.status}`);
    }

    console.log(`[COUPON]   📥 body (500자): ${responseText.substring(0, 500)}`);

    if (!backendRes.ok) {
      let errorMsg = "쿠폰 처리에 실패했습니다.";
      try {
        const errParsed = JSON.parse(responseText);
        errorMsg = errParsed.message || errParsed.error || errorMsg;
      } catch {}
      return NextResponse.json(
        { success: false, error: errorMsg },
        { status: backendRes.status }
      );
    }

    let parsed: any;
    try { parsed = JSON.parse(responseText); } catch { parsed = {}; }
    const data = parsed.data || parsed;

    // ━━━ 크레딧 파싱 (SNAP → PHOTO 강제 치환) ━━━
    const credits = parseCreditResponse(data);

    const couponInfo = {
      name: data.giftName ?? data.couponName ?? data.name ?? data.title ?? "쿠폰",
      description: data.description ?? data.giftDescription ?? data.detail ?? "",
      expiresAt: data.expiresAt ?? data.expiredAt ?? data.expirationDate ?? null,
      photoCredits: credits.photo,
      aiCredits: credits.ai,
      retouchCredits: credits.retouch,
    };

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`[COUPON] ✅ ${actionLabels[action]} 성공`);
    console.log(`[COUPON]   📸 PHOTO: ${credits.photo} (SNAP→PHOTO 치환)`);
    console.log(`[COUPON]   🎨 AI: ${credits.ai}`);
    console.log(`[COUPON]   ✨ RETOUCH: ${credits.retouch}`);
    console.log(`[COUPON]   🏷️ name: ${couponInfo.name}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return NextResponse.json({
      success: true,
      action,
      couponInfo,
      addedCredits: {
        photoCredits: credits.photo,
        aiCredits: credits.ai,
        retouchCredits: credits.retouch,
      },
      raw: parsed,
    });
  } catch (error: any) {
    console.error("[COUPON] ❌ 예외:", error);
    return NextResponse.json(
      { success: false, error: error.message || "쿠폰 처리 실패" },
      { status: 500 }
    );
  }
}
