import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";

// ━━━ POST /api/v1/orders — 주문서 생성 ━━━
// ✅ 백엔드 명세 준수:
//    rawPhotoIds (원본 사진), detailPhotoIds (리터칭 사진), colorPhotoIds (빈 배열)
//    issuedCouponIds (쿠폰 ID 리스트)
//    photoCreditsUsed 등 명세 밖 필드 제거
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as any)?.accessToken || "";
    const userLan = (session as any)?.user?.lan || "ko";

    if (!token) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // ━━━ [A] 필드명 정규화 + 타입 강제 (number[]) ━━━
    const toIntArray = (arr: any): number[] => {
      if (!Array.isArray(arr)) return [];
      return arr.map((v: any) => typeof v === "number" ? v : parseInt(String(v), 10)).filter((n: number) => !isNaN(n));
    };

    const normalizedBody = {
      folderId: typeof body.folderId === "number" ? body.folderId : parseInt(String(body.folderId), 10) || body.folderId,
      // ✅ photoIds → rawPhotoIds (number[])
      rawPhotoIds: toIntArray(body.rawPhotoIds || body.photoIds),
      // ✅ retouchPhotoIds → detailPhotoIds (number[])
      detailPhotoIds: toIntArray(body.detailPhotoIds || body.retouchPhotoIds),
      // ✅ colorPhotoIds — 항상 빈 배열 (number[])
      colorPhotoIds: toIntArray(body.colorPhotoIds),
      // ✅ issuedCouponIds — 항상 포함 (빈 배열이라도 전송!)
      issuedCouponIds: toIntArray(body.issuedCouponIds),
      // ✅ retoucherId — null 허용
      retoucherId: body.retoucherId ? Number(body.retoucherId) : null,
    };

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("[ORDERS_API] 📡 주문 생성 요청");
    console.log("[ORDERS_API]   🌐 Accept-Language:", userLan);
    console.log("[ORDERS_API]   📦 정규화된 body:", JSON.stringify(normalizedBody).substring(0, 600));
    console.log("[ORDERS_API]   🔍 rawPhotoIds 개수:", normalizedBody.rawPhotoIds.length);
    console.log("[ORDERS_API]   🔍 detailPhotoIds 개수:", normalizedBody.detailPhotoIds.length);
    console.log("[ORDERS_API]   🔍 colorPhotoIds 개수:", normalizedBody.colorPhotoIds.length);
    console.log("[ORDERS_API]   🎟️ issuedCouponIds:", JSON.stringify(normalizedBody.issuedCouponIds));
    console.log("[ORDERS_API]   👷 retoucherId:", normalizedBody.retoucherId);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const authHeader = token.startsWith("Bearer ") ? token : `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/api/v1/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
        "Accept-Language": userLan,  // ✅ [B] 전역 언어 주입
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

    // data.id 추출 (다중 경로)
    const orderId = parsed.data?.id || parsed.id || parsed.orderId || parsed.data?.orderId;
    console.log("[ORDERS_API] ✅ 주문 생성 완료 — orderId:", orderId);

    return NextResponse.json({
      success: true,
      orderId,
      data: parsed.data || parsed,
    });
  } catch (e: any) {
    console.error("[ORDERS_API] ❌ 에러:", e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
