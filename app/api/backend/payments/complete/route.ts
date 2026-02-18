import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const API_BASE =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";

// 0원 주문(크레딧 전액) 완료 처리 — 앨범 생성 트리거
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as any)?.accessToken || "";
    const userLan = (session as any)?.user?.lan || "ko";

    if (!token) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { photoOrderId } = body;

    if (!photoOrderId) {
      return NextResponse.json({ success: false, error: "photoOrderId is required" }, { status: 400 });
    }

    console.log("[FREE_COMPLETE] 📡 0원 주문 완료 요청 — photoOrderId:", photoOrderId);

    const authHeader = token.startsWith("Bearer ") ? token : `Bearer ${token}`;

    // 0원 결제 완료 처리 — 앨범 생성 트리거
    const res = await fetch(`${API_BASE}/api/v1/payments/photo/${photoOrderId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
        "Accept-Language": userLan,
      },
    });

    const text = await res.text();
    console.log("[FREE_COMPLETE] 📦 응답 status:", res.status, "body:", text.substring(0, 500));

    let parsed: any;
    try { parsed = JSON.parse(text); } catch {
      // 빈 응답이면 성공으로 간주 (204 등)
      if (res.ok) {
        console.log("[FREE_COMPLETE] ✅ 빈 응답 — 성공 처리");
        return NextResponse.json({ success: true, orderId: photoOrderId });
      }
      return NextResponse.json({ success: false, error: "응답 파싱 실패" }, { status: 500 });
    }

    if (!res.ok) {
      console.error("[FREE_COMPLETE] ❌ 실패:", res.status, parsed.message || "");
      return NextResponse.json(
        { success: false, error: parsed.message || `Backend ${res.status}`, data: parsed },
        { status: res.status }
      );
    }

    console.log("[FREE_COMPLETE] ✅ 0원 결제 완료 — 앨범 생성 트리거됨");

    return NextResponse.json({
      success: true,
      orderId: photoOrderId,
      data: parsed.data || parsed,
    });
  } catch (e: any) {
    console.error("[FREE_COMPLETE] ❌ 에러:", e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
