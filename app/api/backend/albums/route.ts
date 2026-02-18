import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const API_BASE =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";

// GET /api/backend/albums — 유저의 앨범 목록 조회
// Java: GET /api/v1/albums?userId={userId}  (쿼리 파라미터 방식)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as any)?.accessToken || "";
    const userId = (session as any)?.user?.id || (session as any)?.userId;
    const userLan = (session as any)?.user?.lan || "ko";

    if (!token || !userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    console.log("[ALBUMS_API] 📡 앨범 목록 조회 — userId:", userId, "(쿼리 파라미터 방식)");

    const authHeader = token.startsWith("Bearer ") ? token : `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/api/v1/albums?userId=${userId}`, {
      method: "GET",
      headers: {
        "Authorization": authHeader,
        "Accept": "application/json",
        "Accept-Language": userLan,
      },
    });

    const text = await res.text();
    console.log("[ALBUMS_API] 📦 응답 status:", res.status, "body:", text.substring(0, 500));

    let parsed: any;
    try { parsed = JSON.parse(text); } catch {
      if (res.ok) return NextResponse.json({ success: true, albums: [], count: 0 });
      return NextResponse.json({ success: false, error: "JSON parse error" }, { status: 500 });
    }

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: parsed.message || `Backend ${res.status}` },
        { status: res.status }
      );
    }

    // 응답 구조 대응: { data: { content: [...] } } 또는 { content: [...] } 또는 배열
    let albums: any[] = [];
    if (parsed?.data?.content && Array.isArray(parsed.data.content)) {
      albums = parsed.data.content;
    } else if (parsed?.content && Array.isArray(parsed.content)) {
      albums = parsed.content;
    } else if (Array.isArray(parsed?.data)) {
      albums = parsed.data;
    } else if (Array.isArray(parsed)) {
      albums = parsed;
    }

    console.log("[ALBUMS_API] ✅ 앨범 수:", albums.length);

    return NextResponse.json({
      success: true,
      albums,
      count: albums.length,
      raw: parsed,
    });
  } catch (e: any) {
    console.error("[ALBUMS_API] ❌ 에러:", e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
