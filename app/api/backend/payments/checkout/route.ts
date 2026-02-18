import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// ━━━ POST: Stripe Checkout Session 생성 ━━━
// 프론트에서 주문(orderId) 생성 후, 이 API를 호출하여 Checkout URL을 받아 리다이렉트
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { photoOrderId, amount, folderId, n, m, origin } = body;

    if (!photoOrderId || !amount || !folderId || !origin) {
      return NextResponse.json(
        { success: false, error: "photoOrderId, amount, folderId, origin 필수" },
        { status: 400 }
      );
    }

    console.log("[CHECKOUT] 📡 Checkout Session 생성 요청");
    console.log("[CHECKOUT]   orderId:", photoOrderId, "| amount:", amount, "KRW");
    console.log("[CHECKOUT]   folderId:", folderId, "| n:", n, "| m:", m);

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "krw",
            product_data: {
              name: `Cheiz 사진 앨범 (${n || 0}장${m ? ` + 리터칭 ${m}장` : ""})`,
              description: `주문번호: ${photoOrderId}`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/cheiz/folder/${folderId}/redeem?checkout_success=true&session_id={CHECKOUT_SESSION_ID}&orderId=${photoOrderId}&n=${n || 0}&m=${m || 0}&paid=${amount}`,
      cancel_url: `${origin}/cheiz/folder/${folderId}/redeem?checkout_cancelled=true&orderId=${photoOrderId}&n=${n || 0}&m=${m || 0}`,
      metadata: {
        photoOrderId: String(photoOrderId),
        folderId: String(folderId),
      },
    });

    console.log("[CHECKOUT] ✅ Session 생성 완료 — id:", checkoutSession.id);
    console.log("[CHECKOUT]   url:", checkoutSession.url?.substring(0, 80) + "...");

    return NextResponse.json({
      success: true,
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  } catch (e: any) {
    console.error("[CHECKOUT] ❌ 에러:", e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
