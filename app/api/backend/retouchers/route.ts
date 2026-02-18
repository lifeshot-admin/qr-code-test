import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";

// ━━━ GET /api/v1/retouchers/search → ID 7 (박환 작가) 필터링 ━━━
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as any)?.accessToken || "";
    const userLan = (session as any)?.user?.lan || "ko";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept-Language": userLan,  // ✅ [B] 전역 언어 주입
    };
    if (token) headers["Authorization"] = token.startsWith("Bearer ") ? token : `Bearer ${token}`;

    const url = `${API_BASE}/api/v1/retouchers/search`;
    console.log("[RETOUCHERS_API] 📡 호출:", url, "| Accept-Language:", userLan);

    const res = await fetch(url, { method: "GET", headers });
    console.log("[RETOUCHERS_API] 📡 status:", res.status);

    if (!res.ok) {
      console.error("[RETOUCHERS_API] ❌ 백엔드 실패:", res.status);
      return NextResponse.json({ success: false, error: `Backend ${res.status}` }, { status: res.status });
    }

    const text = await res.text();
    let parsed: any;
    try { parsed = JSON.parse(text); } catch {
      console.error("[RETOUCHERS_API] ❌ JSON 파싱 실패:", text.substring(0, 200));
      return NextResponse.json({ success: false, error: "JSON parse error" }, { status: 500 });
    }

    console.log("[RETOUCHERS_API] 📦 raw 타입:", typeof parsed, Array.isArray(parsed) ? "Array" : "Object");
    console.log("[RETOUCHERS_API] 📦 raw 내용:", JSON.stringify(parsed).substring(0, 500));

    // ━━━ 다중 경로 추출 ━━━
    let retouchers: any[] = [];
    if (Array.isArray(parsed)) {
      retouchers = parsed;
      console.log("[RETOUCHERS_API] 🔍 경로: 최상위 배열, 개수:", retouchers.length);
    } else if (parsed.content && Array.isArray(parsed.content)) {
      retouchers = parsed.content;
      console.log("[RETOUCHERS_API] 🔍 경로: parsed.content, 개수:", retouchers.length);
    } else if (parsed.data && Array.isArray(parsed.data)) {
      retouchers = parsed.data;
      console.log("[RETOUCHERS_API] 🔍 경로: parsed.data, 개수:", retouchers.length);
    } else if (parsed.data?.content && Array.isArray(parsed.data.content)) {
      retouchers = parsed.data.content;
      console.log("[RETOUCHERS_API] 🔍 경로: parsed.data.content, 개수:", retouchers.length);
    } else if (parsed.retouchers && Array.isArray(parsed.retouchers)) {
      retouchers = parsed.retouchers;
      console.log("[RETOUCHERS_API] 🔍 경로: parsed.retouchers, 개수:", retouchers.length);
    } else {
      console.warn("[RETOUCHERS_API] ⚠️ 리터쳐 배열 추출 실패 — 알 수 없는 구조. 키:", Object.keys(parsed));
    }

    // ━━━ ID 7 필터링 (디버깅 촘촘) ━━━
    console.log("[RETOUCHERS_API] 🔍 전체 리터쳐 ID 목록:", retouchers.map((r: any) => ({ id: r.id, retoucherId: r.retoucherId, name: r.nickname || r.name })));

    const target = retouchers.find((r: any) => r.id === 7 || r.retoucherId === 7 || r.id === "7" || r.retoucherId === "7");

    if (target) {
      console.log("[RETOUCHERS_API] ✅ ID 7 발견:", JSON.stringify(target).substring(0, 300));
      return NextResponse.json({
        success: true,
        retoucher: {
          id: target.id || target.retoucherId || 7,
          name: target.nickname || target.name || "박환",
          title: target.title || "CHEIZ 전속 리터쳐",
          avatar: target.profileImage || target.avatarUrl || target.profileImageUrl || "",
          description: target.description || target.introduction || "",
          rating: target.rating || target.averageRating || 4.9,
          reviewCount: target.reviewCount || target.totalReviews || 312,
          completedCount: target.completedCount || target.totalCompleted || 2847,
          avgDeliveryDays: target.avgDeliveryDays || target.averageDeliveryDays || 3,
          pricePerPhoto: target.pricePerPhoto || target.price || target.retouchPrice || 15000,
          specialties: target.specialties || target.tags || [],
        },
      });
    }

    console.warn("[RETOUCHERS_API] ⚠️ ID 7 미발견 — 전체 리스트 반환 (개수:", retouchers.length, ")");
    return NextResponse.json({
      success: true,
      retoucher: null,
      allRetouchers: retouchers.map((r: any) => ({
        id: r.id || r.retoucherId,
        name: r.nickname || r.name,
        pricePerPhoto: r.pricePerPhoto || r.price || r.retouchPrice,
      })),
    });
  } catch (e: any) {
    console.error("[RETOUCHERS_API] ❌ 에러:", e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
