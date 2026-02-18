import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const API_BASE =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";

// GET /api/backend/albums/[albumId]/photos — 앨범 내 사진 목록
// Java: GET /api/v1/albums/{albumId}/photos?photoType=ALL&page=0&size=100
export async function GET(
  req: NextRequest,
  { params }: { params: { albumId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as any)?.accessToken || "";
    const userLan = (session as any)?.user?.lan || "ko";

    if (!token) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { albumId } = params;
    const { searchParams } = new URL(req.url);
    const photoType = searchParams.get("photoType") || "";
    const page = searchParams.get("page") || "1";
    const size = searchParams.get("size") || "200";

    console.log("[ALBUM_PHOTOS] 📡 사진 조회 — albumId:", albumId, "| type:", photoType || "(전체)", "| page:", page, "| size:", size);

    const authHeader = token.startsWith("Bearer ") ? token : `Bearer ${token}`;

    // ALL 또는 빈 값이면 photoType 파라미터를 제거하여 백엔드가 전체를 반환하도록 함
    const isAll = !photoType || photoType.toUpperCase() === "ALL";
    const qsType = isAll ? "" : `photoType=${photoType}&`;
    const url = `${API_BASE}/api/v1/albums/${albumId}/photos?${qsType}page=${page}&size=${size}`;
    console.log("[ALBUM_PHOTOS] 🔗 호출 URL:", url);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": authHeader,
        "Accept": "application/json",
        "Accept-Language": userLan,
      },
    });

    const text = await res.text();
    console.log("[ALBUM_PHOTOS] 📦 응답 status:", res.status, "body:", text.substring(0, 800));

    let parsed: any;
    try { parsed = JSON.parse(text); } catch {
      console.error("[ALBUM_PHOTOS] ❌ JSON 파싱 실패 — raw:", text.substring(0, 200));
      if (res.ok) return NextResponse.json({ success: true, photos: [] });
      return NextResponse.json({ success: false, error: "JSON parse error" }, { status: 500 });
    }

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: parsed.message || `Backend ${res.status}` },
        { status: res.status }
      );
    }

    // 응답 구조 분석 로그
    console.log("[ALBUM_PHOTOS] 🔍 응답 구조 분석:");
    console.log("  최상위 키:", Object.keys(parsed));
    console.log("  parsed.content 존재:", !!parsed?.content, "| 타입:", typeof parsed?.content);
    console.log("  parsed.data 존재:", !!parsed?.data, "| 타입:", typeof parsed?.data);
    if (parsed?.data) console.log("  parsed.data 키:", Object.keys(parsed.data));

    // content 우선순위: 이 API는 content 배열에 직접 담아 반환
    let photos: any[] = [];
    if (Array.isArray(parsed?.content)) {
      photos = parsed.content;
      console.log("[ALBUM_PHOTOS] ✅ 추출경로: parsed.content →", photos.length, "장");
    } else if (parsed?.data?.content && Array.isArray(parsed.data.content)) {
      photos = parsed.data.content;
      console.log("[ALBUM_PHOTOS] ✅ 추출경로: parsed.data.content →", photos.length, "장");
    } else if (Array.isArray(parsed?.data)) {
      photos = parsed.data;
      console.log("[ALBUM_PHOTOS] ✅ 추출경로: parsed.data(배열) →", photos.length, "장");
    } else if (Array.isArray(parsed)) {
      photos = parsed;
      console.log("[ALBUM_PHOTOS] ✅ 추출경로: parsed(배열 자체) →", photos.length, "장");
    } else {
      console.warn("[ALBUM_PHOTOS] ⚠️ 사진 배열 추출 실패! 전체 키:", Object.keys(parsed));
    }

    if (photos.length > 0) {
      console.log("[ALBUM_PHOTOS] 📷 첫 번째 사진 샘플:", JSON.stringify(photos[0]).substring(0, 300));
    }

    return NextResponse.json({
      success: true,
      photos,
      count: photos.length,
      raw: parsed,
    });
  } catch (e: any) {
    console.error("[ALBUM_PHOTOS] ❌ 에러:", e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
