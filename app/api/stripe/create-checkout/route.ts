import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-12-18.acacia",
});

export const dynamic = "force-dynamic";

/**
 * Stripe Checkout Session 생성
 * POST /api/stripe/create-checkout
 *
 * Body:
 *   aiRetouching: boolean  - AI 보정 선택 여부
 *   tourId: number         - 투어 ID
 *   tourName: string       - 투어 이름
 *   poseCount: number      - 선택한 포즈 수
 *   folderId: number       - 폴더 ID
 *   totalAmount: number    - 총 결제 금액 (크레딧 적용 후)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session as any)?.user?.id || (session as any)?.user?.email || "unknown";

    const body = await request.json();
    const { aiRetouching, tourId, tourName, poseCount, folderId, totalAmount } = body;

    const SK = process.env.STRIPE_SECRET_KEY || "";
    const skEnv = SK.startsWith("sk_test") ? "TEST" : SK.startsWith("sk_live") ? "LIVE" : "UNKNOWN";

    if (!SK) {
      console.error("[STRIPE] ❌ STRIPE_SECRET_KEY is not set");
      return NextResponse.json(
        { error: "Stripe is not configured" },
        { status: 500 }
      );
    }

    // ━━━ 결제 데이터 검증 로그 ━━━
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("💳 [STRIPE] Checkout Session 생성 요청:");
    console.log(`  🔑 Stripe 환경: ${skEnv} (${SK.substring(0, 12)}...)`);
    console.log(`  👤 userId: ${userId}`);
    console.log(`  🎫 tourId: ${tourId}`);
    console.log(`  📁 folderId: ${folderId}`);
    console.log(`  📸 poseCount: ${poseCount}`);
    console.log(`  ✨ aiRetouching: ${aiRetouching}`);
    console.log(`  🏷️ tourName: ${tourName}`);
    console.log(`  💰 totalAmount (클라이언트 계산): ${totalAmount}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Line items
    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    // AI 보정 옵션 (4,980원)
    if (aiRetouching) {
      const unitAmount = 4980;
      console.log(`  💰 [STRIPE] AI 보정 unit_amount: ${unitAmount}원 (KRW)`);
      line_items.push({
        price_data: {
          currency: "krw",
          product_data: {
            name: "AI 보정 서비스",
            description: `${tourName || "투어"} - ${poseCount}개 포즈 AI 보정`,
          },
          unit_amount: unitAmount, // KRW는 소수점 없음
        },
        quantity: 1,
      });
    }

    console.log(`  📦 [STRIPE] line_items 개수: ${line_items.length}`);
    console.log(`  💵 [STRIPE] 총 결제 금액: ${line_items.reduce((sum, item) => sum + ((item.price_data?.unit_amount || 0) * (item.quantity || 1)), 0)}원`);

    // 기본 예약은 무료이므로 AI 보정만 결제 대상
    if (line_items.length === 0) {
      console.log("  ⏭️ [STRIPE] 결제 건너뛰기 (무료)");
      return NextResponse.json({
        skipPayment: true,
        message: "No payment required",
      });
    }

    const origin = request.headers.get("origin") || "http://localhost:3000";

    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items,
      mode: "payment",
      success_url: `${origin}/cheiz/reserve/success?session_id={CHECKOUT_SESSION_ID}&tour_id=${tourId}&folder_id=${folderId}`,
      cancel_url: `${origin}/cheiz/reserve/checkout?tour_id=${tourId}&folder_id=${folderId}&cancelled=true`,
      metadata: {
        tourId: String(tourId),
        folderId: String(folderId),
        poseCount: String(poseCount),
        aiRetouching: String(aiRetouching),
        userId: String(userId),
      },
    });

    console.log("[STRIPE] ✅ Checkout Session created:", stripeSession.id);

    return NextResponse.json({
      sessionId: stripeSession.id,
      url: stripeSession.url,
    });
  } catch (error: any) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
