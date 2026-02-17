import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";

// ━━━ POST — Stripe 웹훅 프록시 (/api/v1/payments/webhook) ━━━
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const sig = req.headers.get("stripe-signature") || "";

    console.log("[WEBHOOK] 수신 — sig:", !!sig, "size:", rawBody.length);

    const res = await fetch(`${API_BASE}/api/v1/payments/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sig ? { "stripe-signature": sig } : {}),
      },
      body: rawBody,
    });

    const text = await res.text();
    console.log("[WEBHOOK] 백엔드 응답:", res.status);

    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[WEBHOOK] 에러:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
