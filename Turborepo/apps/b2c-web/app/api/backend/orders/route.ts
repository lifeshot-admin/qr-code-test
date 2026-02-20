import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const API_BASE =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";

// ━━━ POST /api/v1/orders/photo — 크레딧 포함 주문서 생성 ━━━
// credit: { PHOTO: n, RETOUCH: m } 으로 크레딧 사용량 명시
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as any)?.accessToken || "";
    const userLan = (session as any)?.user?.lan || "ko";

    if (!token) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const toIntArray = (arr: any): number[] => {
      if (!Array.isArray(arr)) return [];
      return arr.map((v: any) => typeof v === "number" ? v : parseInt(String(v), 10)).filter((n: number) => !isNaN(n));
    };

    const normalizedBody: Record<string, any> = {
      folderId: typeof body.folderId === "number" ? body.folderId : parseInt(String(body.folderId), 10) || body.folderId,
      rawPhotoIds: toIntArray(body.rawPhotoIds || body.photoIds),
      detailPhotoIds: toIntArray(body.detailPhotoIds || body.retouchPhotoIds),
      colorPhotoIds: toIntArray(body.colorPhotoIds),
      issuedCouponIds: toIntArray(body.issuedCouponIds),
      retoucherId: body.retoucherId ? Number(body.retoucherId) : null,
    };

    // credit 객체: 프론트에서 전달한 크레딧 사용량
    if (body.credit && typeof body.credit === "object") {
      normalizedBody.credit = {};
      if (typeof body.credit.PHOTO === "number" && body.credit.PHOTO > 0) {
        normalizedBody.credit.PHOTO = body.credit.PHOTO;
      }
      if (typeof body.credit.RETOUCH === "number" && body.credit.RETOUCH > 0) {
        normalizedBody.credit.RETOUCH = body.credit.RETOUCH;
      }
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("[ORDERS_API] 📡 주문 생성 요청 → /api/v1/orders/photo");
    console.log("[ORDERS_API]   🌐 Accept-Language:", userLan);
    console.log("[ORDERS_API]   📦 body:", JSON.stringify(normalizedBody).substring(0, 600));
    console.log("[ORDERS_API]   🔍 rawPhotoIds:", normalizedBody.rawPhotoIds.length, "장");
    console.log("[ORDERS_API]   🔍 detailPhotoIds:", normalizedBody.detailPhotoIds.length, "장");
    console.log("[ORDERS_API]   🎫 credit:", JSON.stringify(normalizedBody.credit || {}));
    console.log("[ORDERS_API]   👷 retoucherId:", normalizedBody.retoucherId);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const authHeader = token.startsWith("Bearer ") ? token : `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/api/v1/orders/photo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
        "Accept-Language": userLan,
      },
      body: JSON.stringify(normalizedBody),
    });

    const text = await res.text();
    console.log("[ORDERS_API] 📦 응답 status:", res.status, "body:", text.substring(0, 500));

    let parsed: any;
    try { parsed = JSON.parse(text); } catch {
      console.error("[ORDERS_API] ❌ JSON 파싱 실패:", text.substring(0, 200));
      return NextResponse.json({ success: false, error: "JSON parse error", raw: text.substring(0, 200) }, { status: 500 });
    }

    if (!res.ok) {
      console.error("[ORDERS_API] ❌ 주문 생성 실패:", res.status, parsed.message || JSON.stringify(parsed).substring(0, 300));
      return NextResponse.json({ success: false, error: parsed.message || `Backend ${res.status}`, data: parsed }, { status: res.status });
    }

    const data = parsed.data || parsed;
    const orderId = data?.id || parsed.id || parsed.orderId || data?.orderId;
    const totalPayment = data?.totalPayment ?? data?.totalAmount ?? null;

    console.log("[ORDERS_API] ✅ 주문 생성 완료 — orderId:", orderId, "| totalPayment:", totalPayment);

    return NextResponse.json({
      success: true,
      orderId,
      totalPayment,
      data,
    });
  } catch (e: any) {
    console.error("[ORDERS_API] ❌ 에러:", e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
