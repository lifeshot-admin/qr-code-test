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
 */
function normalizeCredType(rawType: string): string {
  const upper = rawType.toUpperCase().trim();
  if (upper === "SNAP" || upper === "SNAP_DOWNLOAD" || upper === "DOWNLOAD") return "PHOTO";
  if (upper === "AI" || upper === "AI_RETOUCH") return "AI_RETOUCH";
  return upper;
}

/**
 * GET /api/backend/wallet
 *
 * ✅ Swagger 규격:
 *   GET /api/v1/users/{userId}/wallet/coupons
 *   Authorization: Bearer {accessToken}
 *
 * ✅ 헤더 세척: Bearer 이중 방지 + trim
 * ✅ SNAP → PHOTO 강제 치환
 *
 * Returns: { photoCredits, aiCredits, retouchCredits, coupons }
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const accessToken = (session as any)?.accessToken;
    const userId = (session as any)?.user?.id;
    const userLan = (session as any)?.user?.lan || "ko";

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("[WALLET] 💰 GET /api/backend/wallet 호출");
    console.log(`[WALLET]   🔑 accessToken 존재: ${!!accessToken}`);
    console.log(`[WALLET]   👤 userId: ${userId}`);
    console.log(`[WALLET]   🌐 Accept-Language: ${userLan}`);

    if (!accessToken) {
      return NextResponse.json(
        { error: "Unauthorized - no access token in session" },
        { status: 401 }
      );
    }

    if (!userId) {
      return NextResponse.json({
        success: true,
        photoCredits: 0,
        aiCredits: 0,
        retouchCredits: 0,
        coupons: [],
        fallback: true,
      });
    }

    const backendUrl = `${API_BASE_URL}/api/v1/users/${userId}/wallet/coupons`;
    console.log(`[WALLET]   📡 요청 URL: ${backendUrl}`);

    // ✅ 헤더 세척: Bearer 이중 방지 + trim
    const authHeader = sanitizeAuthHeader(accessToken);

    const backendRes = await fetch(backendUrl, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        "Accept-Language": userLan,  // ✅ [B] 유저 언어 설정 반영
        "Content-Type": "application/json",
      },
    });

    console.log(`[WALLET]   📥 백엔드 응답 status: ${backendRes.status}`);

    const responseText = await backendRes.text();
    console.log(
      `[WALLET]   📥 백엔드 응답 body (500자): ${responseText.substring(0, 500)}`
    );

    if (!backendRes.ok) {
      console.warn(
        `[WALLET] ⚠️ 백엔드 실패 (${backendRes.status}): ${responseText.substring(0, 200)}`
      );
      return NextResponse.json({
        success: true,
        photoCredits: 0,
        aiCredits: 0,
        retouchCredits: 0,
        coupons: [],
        fallback: true,
      });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = {};
    }

    const data = parsed.data || parsed;

    let photoCredits = 0;
    let aiCredits = 0;
    let retouchCredits = 0;
    const coupons: Array<{
      id: string;
      code: string;
      name: string;
      description: string;
      type: string;
      remainingCount: number;
      expiresAt: string | null;
    }> = [];

    // ━━━ 파싱 전략 (SNAP → PHOTO 강제 치환 포함) ━━━

    // 전략 A: data.balances 오브젝트 (예: { PHOTO: { count: 5 }, AI_RETOUCH: { count: 1 } })
    if (data.balances && typeof data.balances === "object") {
      console.log("[WALLET]   📦 파싱 전략 A: data.balances 감지");
      const b = data.balances;
      // ✅ PHOTO + SNAP 합산 (SNAP → PHOTO 강제 치환)
      const photoFromPhoto = b.PHOTO?.count ?? b.PHOTO?.remainingCount ?? b.PHOTO ?? 0;
      const photoFromSnap = b.SNAP?.count ?? b.SNAP?.remainingCount ?? b.SNAP ?? 0;
      photoCredits = (typeof photoFromPhoto === "number" ? photoFromPhoto : 0)
                   + (typeof photoFromSnap === "number" ? photoFromSnap : 0);
      if (photoFromSnap > 0) {
        console.log(`[WALLET]   🔄 SNAP(${photoFromSnap}) → PHOTO로 합산됨 (총 ${photoCredits})`);
      }
      aiCredits = b.AI_RETOUCH?.count ?? b.AI_RETOUCH?.remainingCount ?? b.AI?.count ?? b.AI ?? 0;
      retouchCredits = b.RETOUCH?.count ?? b.RETOUCH?.remainingCount ?? b.RETOUCH ?? 0;
    }
    // 전략 B: 배열 형식 (쿠폰 목록)
    else if (Array.isArray(data)) {
      console.log("[WALLET]   📦 파싱 전략 B: 배열 형식 감지");
      for (const item of data) {
        // ✅ SNAP → PHOTO 강제 치환
        const rawType = item.type || item.couponType || item.creditType || "";
        const type = normalizeCredType(rawType);
        const count = item.remainingCount ?? item.count ?? item.quantity ?? 1;

        if (type === "PHOTO") {
          photoCredits += count;
        } else if (type === "AI_RETOUCH") {
          aiCredits += count;
        } else if (type === "RETOUCH") {
          retouchCredits += count;
        }

        if (rawType.toUpperCase() === "SNAP") {
          console.log(`[WALLET]   🔄 쿠폰 항목 SNAP → PHOTO 치환됨 (count: ${count})`);
        }

        // ✅ 쿠폰 카드: UI에 노출할 type은 치환된 값 사용, 이름은 "사진 다운로드권"
        coupons.push({
          id: String(item.id || item.giftId || coupons.length),
          code: item.redeemCode || item.code || "",
          name: item.giftName || item.name || item.couponName || (type === "PHOTO" ? "사진 다운로드권" : "쿠폰"),
          description: item.description || item.giftDescription || "",
          type: type,   // ✅ SNAP이 아닌 PHOTO로 저장
          remainingCount: count,
          expiresAt: item.expiresAt || item.expiredAt || item.expirationDate || null,
        });
      }
    }
    // 전략 C: 플랫 오브젝트 (예: { photoCredits: 5, aiCredits: 1 })
    else if (typeof data === "object" && data !== null) {
      console.log("[WALLET]   📦 파싱 전략 C: 플랫 오브젝트 형식 감지");
      // ✅ SNAP + PHOTO 합산
      photoCredits = (data.photoCredits ?? data.PHOTO ?? data.photoCount ?? 0)
                   + (data.SNAP ?? data.snapCredits ?? 0);
      aiCredits = data.aiCredits ?? data.AI_RETOUCH ?? data.AI ?? data.aiRetouchCredits ?? 0;
      retouchCredits = data.retouchCredits ?? data.RETOUCH ?? data.retouchCount ?? 0;

      if (data.SNAP || data.snapCredits) {
        console.log(`[WALLET]   🔄 플랫 SNAP(${data.SNAP ?? data.snapCredits}) → PHOTO로 합산됨`);
      }

      // 쿠폰 리스트가 별도 필드에 있을 수 있음
      const couponArray = data.coupons || data.gifts || data.issuedGifts;
      if (Array.isArray(couponArray)) {
        for (const item of couponArray) {
          const rawType = item.type || item.couponType || "";
          const type = normalizeCredType(rawType);
          coupons.push({
            id: String(item.id || item.giftId || coupons.length),
            code: item.redeemCode || item.code || "",
            name: item.giftName || item.name || (type === "PHOTO" ? "사진 다운로드권" : "쿠폰"),
            description: item.description || "",
            type: type,   // ✅ SNAP → PHOTO 치환
            remainingCount: item.remainingCount ?? item.count ?? 1,
            expiresAt: item.expiresAt || item.expiredAt || null,
          });
        }
      }
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`[WALLET] ✅ 크레딧 잔액 조회 완료`);
    console.log(`[WALLET]   📸 PHOTO: ${photoCredits}`);
    console.log(`[WALLET]   🎨 AI: ${aiCredits}`);
    console.log(`[WALLET]   ✨ RETOUCH: ${retouchCredits}`);
    console.log(`[WALLET]   🎟️ 쿠폰 수: ${coupons.length}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return NextResponse.json({
      success: true,
      photoCredits,
      aiCredits,
      retouchCredits,
      coupons,
      raw: parsed,
    });
  } catch (error: any) {
    console.error("[WALLET] ❌ wallet 예외:", error);
    return NextResponse.json(
      {
        success: true,
        photoCredits: 0,
        aiCredits: 0,
        retouchCredits: 0,
        coupons: [],
        error: error.message,
        fallback: true,
      },
      { status: 200 }
    );
  }
}
