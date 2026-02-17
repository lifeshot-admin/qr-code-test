import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";

export const dynamic = "force-dynamic";

/**
 * Strips all Bearer prefixes using a while loop, trims whitespace,
 * then adds a single Bearer prefix back.
 */
function sanitizeAuthHeader(rawToken: string): string {
  let pure = rawToken;
  while (/^Bearer\s+/i.test(pure)) {
    pure = pure.replace(/^Bearer\s+/i, "");
  }
  pure = pure.trim();
  return `Bearer ${pure}`;
}

/**
 * GET /api/backend/folder-photos?folderId=...
 * Proxies to Java backend to fetch photos from a folder.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId");

    console.log("[PHOTOS_API] GET /api/backend/folder-photos");
    console.log(`[PHOTOS_API]   folderId: ${folderId ?? "MISSING"}`);

    if (!folderId || folderId.trim() === "") {
      console.log("[PHOTOS_API] ❌ folderId missing → 400");
      return NextResponse.json(
        { error: "folderId is required" },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);
    const accessToken = (session as any)?.accessToken;
    const userLan = (session as any)?.user?.lan || "ko";

    console.log(`[PHOTOS_API]   accessToken 존재: ${!!accessToken}`);
    console.log(`[PHOTOS_API]   🌐 Accept-Language: ${userLan}`);

    if (!accessToken) {
      console.log("[PHOTOS_API] ❌ no auth → 401");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const backendUrl = `${API_BASE_URL}/api/v1/folders/${folderId}/photos`;
    const authHeader = sanitizeAuthHeader(accessToken);

    console.log(`[PHOTOS_API]   📡 Backend URL: ${backendUrl}`);

    const backendRes = await fetch(backendUrl, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        "Accept-Language": userLan,  // ✅ [B] 유저 언어 설정 반영
      },
    });

    console.log(`[PHOTOS_API]   📥 Backend status: ${backendRes.status}`);

    const responseText = await backendRes.text();
    console.log(
      `[PHOTOS_API]   📥 Response (first 300 chars): ${responseText.substring(0, 300)}`
    );

    if (!backendRes.ok) {
      console.log(`[PHOTOS_API] ❌ Backend error ${backendRes.status}`);
      return NextResponse.json(
        { error: "Backend request failed", detail: responseText },
        { status: backendRes.status }
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = {};
    }

    // ━━━ 핵심 수정: 백엔드 응답 구조에 맞는 다중 경로 추출 ━━━
    // 백엔드는 { content: [...] } 또는 { data: { content: [...] } } 형식으로 응답
    let rawPhotos: any[] = [];

    if (parsed.content && Array.isArray(parsed.content)) {
      // 가장 가능성 높은 경로: { content: [...] }
      rawPhotos = parsed.content;
      console.log(`[PHOTOS_API]   ✅ [경로 1] parsed.content에서 ${rawPhotos.length}장 추출`);
    } else if (parsed.data?.content && Array.isArray(parsed.data.content)) {
      // { data: { content: [...] } }
      rawPhotos = parsed.data.content;
      console.log(`[PHOTOS_API]   ✅ [경로 2] parsed.data.content에서 ${rawPhotos.length}장 추출`);
    } else if (parsed.data && Array.isArray(parsed.data)) {
      // { data: [...] }
      rawPhotos = parsed.data;
      console.log(`[PHOTOS_API]   ✅ [경로 3] parsed.data(배열)에서 ${rawPhotos.length}장 추출`);
    } else if (parsed.photos && Array.isArray(parsed.photos)) {
      // { photos: [...] }
      rawPhotos = parsed.photos;
      console.log(`[PHOTOS_API]   ✅ [경로 4] parsed.photos에서 ${rawPhotos.length}장 추출`);
    } else if (Array.isArray(parsed)) {
      // 최상위가 배열
      rawPhotos = parsed;
      console.log(`[PHOTOS_API]   ✅ [경로 5] parsed 자체가 배열: ${rawPhotos.length}장`);
    } else {
      console.warn(`[PHOTOS_API]   ⚠️ 어떤 경로에서도 사진 배열 미발견!`);
      console.warn(`[PHOTOS_API]   📦 parsed keys: ${Object.keys(parsed).join(", ")}`);
      rawPhotos = [];
    }

    // Normalize: if type === "SNAP", change to "PHOTO"
    const photos = rawPhotos.map((p: any) => ({
      ...p,
      type: p.type === "SNAP" ? "PHOTO" : p.type,
    }));

    console.log(`[PHOTOS_API] ✅ Success, photos count: ${photos.length}`);

    return NextResponse.json({
      success: true,
      photos,
    });
  } catch (error: any) {
    console.error("[PHOTOS_API] ❌ Exception:", error?.message);
    return NextResponse.json(
      { error: error.message || "Failed to fetch photos" },
      { status: 500 }
    );
  }
}
