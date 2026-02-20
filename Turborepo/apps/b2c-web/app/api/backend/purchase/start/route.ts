import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

const API_BASE =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function sanitizeAuth(raw: string): string {
  let pure = raw;
  while (/^Bearer\s+/i.test(pure)) pure = pure.replace(/^Bearer\s+/i, "");
  return `Bearer ${pure.trim()}`;
}

/**
 * POST /api/backend/purchase/start
 *
 * 프론트엔드 통합 엔드포인트: 주문 생성 → 금액 판단 → 0원 즉시 완료 OR Stripe URL 반환
 *
 * Request Body:
 *   folderId:        number   (필수) 폴더 ID
 *   rawPhotoIds:     number[] (필수) 원본 사진 ID
 *   detailPhotoIds:  number[] (선택) 리터치 사진 ID (기본 [])
 *   retoucherId:     number|null (선택) 리터처 ID
 *   credit:          { PHOTO?: number, RETOUCH?: number } (선택) 크레딧 사용량
 *   origin:          string   (필수) 현재 도메인 (Stripe 리다이렉트용)
 *
 * Response:
 *   0원 결제:  { success: true, type: "FREE",   orderId, message }
 *   유료 결제: { success: true, type: "STRIPE", orderId, checkoutUrl }
 *   에러:      { success: false, error, step }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as any)?.accessToken || "";
    const userLan = (session as any)?.user?.lan || "ko";

    if (!token) {
      return NextResponse.json(
        { success: false, error: "로그인이 필요합니다.", step: "AUTH" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { folderId, rawPhotoIds, detailPhotoIds, retoucherId, credit, origin } = body;

    if (!folderId || !origin) {
      return NextResponse.json(
        { success: false, error: "folderId, origin은 필수입니다.", step: "VALIDATION" },
        { status: 400 },
      );
    }

    const authHeader = sanitizeAuth(token);
    const toIntArray = (arr: any): number[] => {
      if (!Array.isArray(arr)) return [];
      return arr.map((v: any) => (typeof v === "number" ? v : parseInt(String(v), 10))).filter((n: number) => !isNaN(n));
    };

    const normalizedOrder: Record<string, any> = {
      folderId: typeof folderId === "number" ? folderId : parseInt(String(folderId), 10),
      rawPhotoIds: toIntArray(rawPhotoIds),
      detailPhotoIds: toIntArray(detailPhotoIds),
      colorPhotoIds: [],
      issuedCouponIds: [],
      retoucherId: retoucherId ? Number(retoucherId) : null,
    };

    if (credit && typeof credit === "object") {
      const c: Record<string, number> = {};
      if (typeof credit.PHOTO === "number" && credit.PHOTO > 0) c.PHOTO = credit.PHOTO;
      if (typeof credit.RETOUCH === "number" && credit.RETOUCH > 0) c.RETOUCH = credit.RETOUCH;
      if (Object.keys(c).length > 0) normalizedOrder.credit = c;
    }

    const N = normalizedOrder.rawPhotoIds.length;
    const M = normalizedOrder.detailPhotoIds.length;

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("[PURCHASE_START] 🚀 통합 구매 시작");
    console.log("[PURCHASE_START]   folderId:", normalizedOrder.folderId);
    console.log("[PURCHASE_START]   원본:", N, "장 / 리터치:", M, "장");
    console.log("[PURCHASE_START]   credit:", JSON.stringify(normalizedOrder.credit || {}));

    // ━━━ Step 1: Java 주문 생성 ━━━
    const orderRes = await fetch(`${API_BASE}/api/v1/orders/photo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        "Accept-Language": userLan,
      },
      body: JSON.stringify(normalizedOrder),
    });

    const orderText = await orderRes.text();
    let orderParsed: any;
    try { orderParsed = JSON.parse(orderText); } catch {
      console.error("[PURCHASE_START] ❌ 주문 응답 파싱 실패:", orderText.substring(0, 200));
      return NextResponse.json(
        { success: false, error: "주문 생성 응답을 파싱할 수 없습니다.", step: "ORDER" },
        { status: 500 },
      );
    }

    if (!orderRes.ok) {
      console.error("[PURCHASE_START] ❌ 주문 생성 실패:", orderRes.status, orderParsed.message);
      return NextResponse.json(
        { success: false, error: orderParsed.message || `주문 생성 실패 (${orderRes.status})`, step: "ORDER", data: orderParsed },
        { status: orderRes.status },
      );
    }

    const orderData = orderParsed.data || orderParsed;
    const orderId = orderData?.id || orderParsed.id || orderParsed.orderId || orderData?.orderId;
    const totalPayment = orderData?.totalPayment ?? orderData?.totalAmount ?? null;

    if (!orderId) {
      console.error("[PURCHASE_START] ❌ orderId 없음:", JSON.stringify(orderParsed).substring(0, 300));
      return NextResponse.json(
        { success: false, error: "주문 ID를 받지 못했습니다.", step: "ORDER" },
        { status: 500 },
      );
    }

    console.log("[PURCHASE_START]   ✅ orderId:", orderId, "| totalPayment:", totalPayment);

    // 크레딧 전액 커버 판정
    const photoCredit = normalizedOrder.credit?.PHOTO || 0;
    const retouchCredit = normalizedOrder.credit?.RETOUCH || 0;
    const creditCoversAll = (photoCredit >= N) && (M === 0 || retouchCredit >= M);
    const actualPayment = creditCoversAll ? 0 : (typeof totalPayment === "number" ? totalPayment : 0);

    console.log("[PURCHASE_START]   creditCoversAll:", creditCoversAll, "| actualPayment:", actualPayment);

    // ━━━ Step 2A: 0원 결제 — 즉시 완료 ━━━
    if (actualPayment <= 0) {
      console.log("[PURCHASE_START] 💎 0원 결제 → 즉시 완료 처리");

      const completeRes = await fetch(`${API_BASE}/api/v1/payments/photo/${orderId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
          "Accept-Language": userLan,
        },
      });

      const completeText = await completeRes.text();
      console.log("[PURCHASE_START]   완료 응답:", completeRes.status, completeText.substring(0, 300));

      if (!completeRes.ok && completeRes.status !== 204) {
        let errMsg = "결제 완료 처리에 실패했습니다.";
        try { errMsg = JSON.parse(completeText).message || errMsg; } catch {}
        console.error("[PURCHASE_START] ❌ 0원 완료 실패:", completeRes.status);
        return NextResponse.json(
          { success: false, error: errMsg, step: "COMPLETE", orderId },
          { status: completeRes.status },
        );
      }

      console.log("[PURCHASE_START] ✅ 0원 구매 완료 — 앨범 생성 트리거됨");
      return NextResponse.json({
        success: true,
        type: "FREE",
        orderId,
        totalPayment: 0,
        message: "크레딧 결제가 완료되었습니다. 앨범이 생성됩니다.",
      });
    }

    // ━━━ Step 2B: 유료 결제 — Stripe Checkout Session 생성 ━━━
    console.log("[PURCHASE_START] 💳 유료 결제 → Stripe Checkout 생성");

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "krw",
            product_data: {
              name: `Cheiz 사진 앨범 (${N}장${M ? ` + 리터칭 ${M}장` : ""})`,
              description: `주문번호: ${orderId}`,
            },
            unit_amount: actualPayment,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/cheiz/folder/${folderId}/redeem?checkout_success=true&session_id={CHECKOUT_SESSION_ID}&orderId=${orderId}&n=${N}&m=${M}&paid=${actualPayment}`,
      cancel_url: `${origin}/cheiz/folder/${folderId}/redeem?checkout_cancelled=true&orderId=${orderId}&n=${N}&m=${M}`,
      metadata: {
        photoOrderId: String(orderId),
        folderId: String(folderId),
      },
    });

    console.log("[PURCHASE_START] ✅ Checkout URL 생성 완료");

    return NextResponse.json({
      success: true,
      type: "STRIPE",
      orderId,
      totalPayment: actualPayment,
      checkoutUrl: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  } catch (e: any) {
    console.error("[PURCHASE_START] ❌ 예외:", e.message);
    return NextResponse.json(
      { success: false, error: e.message || "시스템 오류가 발생했습니다.", step: "SYSTEM" },
      { status: 500 },
    );
  }
}
