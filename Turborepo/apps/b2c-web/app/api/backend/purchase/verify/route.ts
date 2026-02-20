import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

const API_BASE =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function sanitizeAuth(raw: string): string {
  let pure = raw;
  while (/^Bearer\s+/i.test(pure)) pure = pure.replace(/^Bearer\s+/i, "");
  return `Bearer ${pure.trim()}`;
}

function jsonResponse(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}

/**
 * POST /api/backend/purchase/verify
 *
 * Stripe 결제 완료 후 호출하는 통합 검증 엔드포인트:
 *   1. Stripe Session 조회 → payment_status 확인
 *   2. Java 백엔드 결제 완료 처리 (앨범 생성 트리거)
 *   3. 최종 결과 반환
 *
 * Request Body:
 *   sessionId: string (필수) Stripe Checkout Session ID
 *
 * Response:
 *   성공: { success: true, orderId, totalPaid, status: "COMPLETED" }
 *   실패: { success: false, error, step }
 */
export async function POST(req: NextRequest) {
  try {
    // 토큰 우선순위: ① 요청 헤더 Authorization (외부 호출: Bubble 등) → ② NextAuth 세션 (내부 호출: React)
    let token = "";
    let userLan = "ko";

    const headerAuth = req.headers.get("authorization") || "";
    if (headerAuth) {
      let pure = headerAuth;
      while (/^Bearer\s+/i.test(pure)) pure = pure.replace(/^Bearer\s+/i, "");
      token = pure.trim();
    }

    if (!token) {
      const session = await getServerSession(authOptions);
      token = (session as any)?.accessToken || "";
      userLan = (session as any)?.user?.lan || "ko";
    }

    if (!token) {
      return jsonResponse(
        { success: false, error: "로그인이 필요합니다. Authorization 헤더 또는 세션이 필요합니다.", step: "AUTH" },
        401,
      );
    }

    const body = await req.json();
    const { sessionId } = body;

    if (!sessionId) {
      return jsonResponse(
        { success: false, error: "sessionId는 필수입니다.", step: "VALIDATION" },
        400,
      );
    }

    const authHeader = sanitizeAuth(token);

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("[PURCHASE_VERIFY] 🔍 결제 검증 시작 — sessionId:", sessionId);

    // ━━━ Step 1: Stripe Session 검증 ━━━
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

    console.log("[PURCHASE_VERIFY]   payment_status:", checkoutSession.payment_status);
    console.log("[PURCHASE_VERIFY]   metadata:", JSON.stringify(checkoutSession.metadata));

    if (checkoutSession.payment_status !== "paid") {
      console.error("[PURCHASE_VERIFY] ❌ 결제 미완료:", checkoutSession.payment_status);
      return jsonResponse(
        {
          success: false,
          error: "결제가 완료되지 않았습니다.",
          step: "STRIPE_VERIFY",
          paymentStatus: checkoutSession.payment_status,
        },
        400,
      );
    }

    const orderId = checkoutSession.metadata?.photoOrderId;
    const folderId = checkoutSession.metadata?.folderId;

    if (!orderId) {
      console.error("[PURCHASE_VERIFY] ❌ metadata에 photoOrderId 없음");
      return jsonResponse(
        { success: false, error: "주문 정보를 찾을 수 없습니다.", step: "STRIPE_VERIFY" },
        400,
      );
    }

    console.log("[PURCHASE_VERIFY]   ✅ Stripe 검증 통과 — orderId:", orderId);

    // ━━━ Step 2: Java 백엔드 결제 완료 처리 (앨범 생성 트리거) ━━━
    console.log("[PURCHASE_VERIFY] 📡 Java 결제 완료 처리 시작");

    const completeRes = await fetch(`${API_BASE}/api/v1/payments/photo/${orderId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        "Accept-Language": userLan,
      },
    });

    const completeText = await completeRes.text();
    console.log("[PURCHASE_VERIFY]   완료 응답:", completeRes.status, completeText.substring(0, 300));

    if (!completeRes.ok && completeRes.status !== 204) {
      let errMsg = "결제 완료 처리에 실패했습니다. 고객센터에 문의해 주세요.";
      try { errMsg = JSON.parse(completeText).message || errMsg; } catch {}

      console.error("[PURCHASE_VERIFY] ❌ Java 완료 처리 실패:", completeRes.status);

      return jsonResponse(
        {
          success: false,
          error: errMsg,
          step: "BACKEND_COMPLETE",
          orderId,
          stripeVerified: true,
        },
        completeRes.status,
      );
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("[PURCHASE_VERIFY] ✅ 구매 완료!");
    console.log("[PURCHASE_VERIFY]   orderId:", orderId);
    console.log("[PURCHASE_VERIFY]   folderId:", folderId);
    console.log("[PURCHASE_VERIFY]   totalPaid:", checkoutSession.amount_total);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return jsonResponse({
      success: true,
      status: "COMPLETED",
      orderId,
      folderId,
      totalPaid: checkoutSession.amount_total,
      currency: checkoutSession.currency,
    });
  } catch (e: any) {
    console.error("[PURCHASE_VERIFY] ❌ 예외:", e.message);
    return jsonResponse(
      { success: false, error: e.message || "검증 중 오류가 발생했습니다.", step: "SYSTEM" },
      500,
    );
  }
}
