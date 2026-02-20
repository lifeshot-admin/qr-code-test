import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const API_BASE =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";

// ━━━ POST: Stripe Checkout Session 검증 → Java 백엔드 주문 완료 트리거 ━━━
// 결제 완료 후 success_url로 돌아온 프론트엔드가 이 API를 호출
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as any)?.accessToken || "";
    const userLan = (session as any)?.user?.lan || "ko";

    if (!token) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ success: false, error: "sessionId is required" }, { status: 400 });
    }

    // ━━━ Step 1: Stripe Checkout Session 검증 ━━━
    console.log("[VERIFY_CHECKOUT] 📡 Session 검증 — id:", sessionId);
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
    console.log("[VERIFY_CHECKOUT]   payment_status:", checkoutSession.payment_status);
    console.log("[VERIFY_CHECKOUT]   metadata:", JSON.stringify(checkoutSession.metadata));

    if (checkoutSession.payment_status !== "paid") {
      console.error("[VERIFY_CHECKOUT] ❌ 결제 미완료 — status:", checkoutSession.payment_status);
      return NextResponse.json(
        { success: false, error: "결제가 완료되지 않았습니다.", status: checkoutSession.payment_status },
        { status: 400 }
      );
    }

    const photoOrderId = checkoutSession.metadata?.photoOrderId;
    if (!photoOrderId) {
      console.error("[VERIFY_CHECKOUT] ❌ metadata에 photoOrderId 없음");
      return NextResponse.json({ success: false, error: "photoOrderId not found in session" }, { status: 400 });
    }

    // ━━━ Step 2: Java 백엔드에 결제 완료 알림 (앨범 생성 트리거) ━━━
    console.log("[VERIFY_CHECKOUT] 📡 Java 백엔드 완료 처리 — photoOrderId:", photoOrderId);
    const authHeader = token.startsWith("Bearer ") ? token : `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/api/v1/payments/photo/${photoOrderId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
        "Accept-Language": userLan,
      },
    });

    const text = await res.text();
    console.log("[VERIFY_CHECKOUT] 📦 백엔드 응답 status:", res.status, "body:", text.substring(0, 500));

    if (res.ok || res.status === 204) {
      console.log("[VERIFY_CHECKOUT] ✅ 주문 완료 — 앨범 생성 트리거 성공");
      return NextResponse.json({
        success: true,
        orderId: photoOrderId,
        paymentStatus: checkoutSession.payment_status,
        amountTotal: checkoutSession.amount_total,
      });
    }

    let parsed: any;
    try { parsed = JSON.parse(text); } catch { parsed = { raw: text.substring(0, 200) }; }

    console.error("[VERIFY_CHECKOUT] ❌ 백엔드 완료 처리 실패:", res.status);
    return NextResponse.json(
      { success: false, error: parsed.message || `Backend ${res.status}`, data: parsed },
      { status: res.status }
    );
  } catch (e: any) {
    console.error("[VERIFY_CHECKOUT] ❌ 에러:", e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
