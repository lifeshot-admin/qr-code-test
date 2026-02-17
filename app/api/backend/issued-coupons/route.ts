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
 * GET /api/backend/issued-coupons
 * 
 * 백엔드 호출: GET /api/v1/issued-coupons
 * 
 * 응답 매핑:
 *  - templateName → 쿠폰 명칭
 *  - templateDescription → 설명
 *  - expiryDate → 유효기간 (yyyy년 mm월 dd일(ddd)까지 형식)
 *  - PHOTO / AI / RETOUCH 개수 → 혜택 정보
 *  - status (USED) → 사용 완료 표시
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const accessToken = (session as any)?.accessToken;
    const userLan = (session as any)?.user?.lan || "ko";

    console.log("[ISSUED_COUPONS] GET /api/backend/issued-coupons");
    console.log(`[ISSUED_COUPONS]   accessToken 존재: ${!!accessToken}`);
    console.log(`[ISSUED_COUPONS]   🌐 Accept-Language: ${userLan}`);

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authHeader = sanitizeAuthHeader(accessToken);
    const backendUrl = `${API_BASE_URL}/api/v1/issued-coupons`;

    console.log(`[ISSUED_COUPONS]   📡 Backend URL: ${backendUrl}`);

    const backendRes = await fetch(backendUrl, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        "Accept-Language": userLan,  // ✅ [B] 유저 언어 설정 반영
      },
    });

    console.log(`[ISSUED_COUPONS]   📥 Backend status: ${backendRes.status}`);

    const responseText = await backendRes.text();
    console.log(
      `[ISSUED_COUPONS]   📥 Response (500 chars): ${responseText.substring(0, 500)}`
    );

    if (!backendRes.ok) {
      console.warn(`[ISSUED_COUPONS] ⚠️ Backend error ${backendRes.status}`);
      return NextResponse.json(
        { success: true, coupons: [], fallback: true },
        { status: 200 }
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = {};
    }

    // ━━━ 백엔드 응답에서 content 배열 추출 ━━━
    let rawCoupons: any[] = [];
    if (parsed.content && Array.isArray(parsed.content)) {
      rawCoupons = parsed.content;
      console.log(`[ISSUED_COUPONS]   ✅ parsed.content에서 ${rawCoupons.length}개 추출`);
    } else if (parsed.data?.content && Array.isArray(parsed.data.content)) {
      rawCoupons = parsed.data.content;
      console.log(`[ISSUED_COUPONS]   ✅ parsed.data.content에서 ${rawCoupons.length}개 추출`);
    } else if (parsed.data && Array.isArray(parsed.data)) {
      rawCoupons = parsed.data;
      console.log(`[ISSUED_COUPONS]   ✅ parsed.data(배열)에서 ${rawCoupons.length}개 추출`);
    } else if (Array.isArray(parsed)) {
      rawCoupons = parsed;
      console.log(`[ISSUED_COUPONS]   ✅ parsed 자체가 배열: ${rawCoupons.length}개`);
    } else {
      console.warn(`[ISSUED_COUPONS]   ⚠️ 쿠폰 배열 미발견! keys: ${Object.keys(parsed).join(", ")}`);
    }

    // ━━━ 쿠폰 데이터 정규화 (UX 라이팅 적용) ━━━
    const coupons = rawCoupons.map((c: any) => {
      // ✅ template 객체를 최상단에서 먼저 선언 (하위 로직에서 참조)
      const tpl = c.template || c.couponTemplate || {};

      // SNAP → PHOTO 강제 치환
      const normalizeType = (type: string) => {
        const upper = (type || "").toUpperCase().trim();
        if (upper === "SNAP" || upper === "SNAP_DOWNLOAD" || upper === "DOWNLOAD") return "PHOTO";
        if (upper === "AI" || upper === "AI_RETOUCH") return "AI";
        return upper;
      };

      // 혜택 개수 추출
      const items = c.items || c.creditItems || tpl.items || [];
      let photoCount = 0;
      let aiCount = 0;
      let retouchCount = 0;

      if (Array.isArray(items)) {
        for (const item of items) {
          const type = normalizeType(item.type || item.creditType || "");
          const count = item.count ?? item.quantity ?? item.remainingCount ?? 1;
          if (type === "PHOTO") photoCount += count;
          else if (type === "AI") aiCount += count;
          else if (type === "RETOUCH") retouchCount += count;
        }
      }

      // 직접 필드에서도 추출 시도
      if (photoCount === 0 && aiCount === 0 && retouchCount === 0) {
        photoCount = c.photoCount ?? c.photoCredits ?? c.PHOTO ?? tpl.photoCount ?? tpl.PHOTO ?? 0;
        aiCount = c.aiCount ?? c.aiCredits ?? c.AI ?? tpl.aiCount ?? tpl.AI ?? 0;
        retouchCount = c.retouchCount ?? c.retouchCredits ?? c.RETOUCH ?? tpl.retouchCount ?? tpl.RETOUCH ?? 0;

        // SNAP → PHOTO 합산
        const snapCount = c.snapCount ?? c.SNAP ?? tpl.snapCount ?? tpl.SNAP ?? 0;
        if (snapCount > 0) photoCount += snapCount;
      }

      // 유효기간 포맷 (yyyy년 mm월 dd일(ddd)까지)
      const rawExpiry = c.expiryDate || c.expiresAt || c.expiredAt || c.expirationDate || tpl.expiryDate || null;
      let formattedExpiry: string | null = null;
      if (rawExpiry) {
        try {
          const d = new Date(rawExpiry);
          const days = ["일", "월", "화", "수", "목", "금", "토"];
          formattedExpiry = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일(${days[d.getDay()]})까지`;
        } catch {
          formattedExpiry = rawExpiry;
        }
      }

      // 사용 여부 확인
      const status = (c.status || c.couponStatus || "").toUpperCase();
      const isUsed = status === "USED" || status === "REDEEMED" || status === "EXPIRED";

      return {
        id: String(c.id || c.couponId || c.issuedCouponId || Math.random()),
        code: c.code || c.redeemCode || c.couponCode || "",
        templateName:
          c.templateName || c.couponTemplateName ||
          c.template_name || c["template name"] ||
          tpl.name || tpl.templateName ||
          c.name || c.couponName || c.giftName || c.title || "쿠폰",
        templateDescription:
          c.templateDescription || c.couponTemplateDescription ||
          c.template_description || c["template description"] ||
          tpl.description || tpl.templateDescription ||
          c.description || c.giftDescription || c.subtitle || "",
        expiryDate: rawExpiry,
        formattedExpiry,
        photoCount,
        aiCount,
        retouchCount,
        isUsed,
        status: c.status || "ACTIVE",
        raw: c,
      };
    });

    console.log(`[ISSUED_COUPONS] ✅ 정규화 완료: ${coupons.length}개 쿠폰`);
    if (rawCoupons.length > 0) {
      console.log(`[ISSUED_COUPONS] 🔍 첫 쿠폰 원본 키:`, Object.keys(rawCoupons[0]));
      console.log(`[ISSUED_COUPONS] 🔍 첫 쿠폰 원본 데이터 (300자):`, JSON.stringify(rawCoupons[0]).substring(0, 300));
      console.log(`[ISSUED_COUPONS] 🔍 첫 쿠폰 template 키:`, rawCoupons[0].template ? Object.keys(rawCoupons[0].template) : "없음");
      console.log(`[ISSUED_COUPONS] 🔍 첫 쿠폰 couponTemplate 키:`, rawCoupons[0].couponTemplate ? Object.keys(rawCoupons[0].couponTemplate) : "없음");
      console.log(`[ISSUED_COUPONS] 🔍 정규화 결과 첫 쿠폰:`, {
        templateName: coupons[0]?.templateName,
        templateDescription: coupons[0]?.templateDescription,
        photoCount: coupons[0]?.photoCount,
        aiCount: coupons[0]?.aiCount,
        retouchCount: coupons[0]?.retouchCount,
        status: coupons[0]?.status,
      });
    }

    return NextResponse.json({
      success: true,
      coupons,
    });
  } catch (error: any) {
    console.error("[ISSUED_COUPONS] ❌ Exception:", error?.message);
    return NextResponse.json(
      { success: true, coupons: [], fallback: true },
      { status: 200 }
    );
  }
}
