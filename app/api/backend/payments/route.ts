import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";

// ━━━ POST /api/v1/payments/photo/{photoOrderId} — 결제 생성 (Stripe clientSecret 확보) ━━━
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as any)?.accessToken || "";
    const userLan = (session as any)?.user?.lan || "ko";

    if (!token) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { photoOrderId, ...rest } = body;

    if (!photoOrderId) {
      return NextResponse.json({ success: false, error: "photoOrderId is required" }, { status: 400 });
    }

    console.log("[PAYMENTS_API] 📡 결제 생성 요청 — photoOrderId:", photoOrderId, "| Accept-Language:", userLan);

    const authHeader = token.startsWith("Bearer ") ? token : `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/api/v1/payments/photo/${photoOrderId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
        "Accept-Language": userLan,  // ✅ [B] 전역 언어 주입
      },
      body: Object.keys(rest).length > 0 ? JSON.stringify(rest) : undefined,
    });

    const text = await res.text();
    console.log("[PAYMENTS_API] 📦 응답 status:", res.status, "body:", text.substring(0, 500));

    let parsed: any;
    try { parsed = JSON.parse(text); } catch {
      console.error("[PAYMENTS_API] ❌ JSON 파싱 실패:", text.substring(0, 200));
      return NextResponse.json({ success: false, error: "JSON parse error" }, { status: 500 });
    }

    if (!res.ok) {
      return NextResponse.json({ success: false, error: parsed.message || `Backend ${res.status}`, data: parsed }, { status: res.status });
    }

    // clientSecret 추출 (다중 경로)
    const clientSecret =
      parsed.data?.clientSecret ||
      parsed.clientSecret ||
      parsed.data?.client_secret ||
      parsed.client_secret;

    // paymentIntentId 추출 (다중 경로)
    const paymentIntentId =
      parsed.data?.paymentIntentId ||
      parsed.paymentIntentId ||
      parsed.data?.payment_intent_id ||
      parsed.data?.id;

    console.log("[PAYMENTS_API] clientSecret:", clientSecret ? "OK" : "MISSING", "| paymentIntentId:", paymentIntentId || "N/A");

    return NextResponse.json({
      success: true,
      clientSecret,
      paymentIntentId: paymentIntentId || (clientSecret ? clientSecret.split("_secret_")[0] : null),
      data: parsed.data || parsed,
    });
  } catch (e: any) {
    console.error("[PAYMENTS_API] ❌ 에러:", e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
