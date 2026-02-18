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

    // ━━━ AI 보정 사진 병합: /api/v1/ai/photos 에서 aiPhotoUrl 가져오기 ━━━
    try {
      const aiPhotosUrl = `${API_BASE_URL}/api/v1/ai/photos?folderId=${folderId}`;
      console.log(`[PHOTOS_API]   🤖 AI photos URL: ${aiPhotosUrl}`);

      const aiRes = await fetch(aiPhotosUrl, {
        method: "GET",
        headers: {
          Authorization: authHeader,
          "Accept-Language": userLan,
        },
      });

      if (aiRes.ok) {
        const aiText = await aiRes.text();
        let aiParsed: any;
        try { aiParsed = JSON.parse(aiText); } catch { aiParsed = {}; }

        let aiPhotos: any[] = [];
        if (aiParsed.content && Array.isArray(aiParsed.content)) {
          aiPhotos = aiParsed.content;
        } else if (aiParsed.data?.content && Array.isArray(aiParsed.data.content)) {
          aiPhotos = aiParsed.data.content;
        } else if (aiParsed.data && Array.isArray(aiParsed.data)) {
          aiPhotos = aiParsed.data;
        } else if (Array.isArray(aiParsed)) {
          aiPhotos = aiParsed;
        }

        if (aiPhotos.length > 0) {
          console.log(`[PHOTOS_API]   🤖 AI 사진 ${aiPhotos.length}장 병합 시작`);

          // aiPhotoUrl 매핑: folderPhotoUrl 또는 id로 원본 사진과 매칭
          const aiMap = new Map<string, string>();
          for (const ai of aiPhotos) {
            // folderPhotoUrl → aiPhotoUrl 매핑
            if (ai.folderPhotoUrl && ai.aiPhotoUrl) {
              aiMap.set(ai.folderPhotoUrl, ai.aiPhotoUrl);
            }
            // id 기반 매핑도 시도
            if (ai.folderPhotoId && ai.aiPhotoUrl) {
              aiMap.set(String(ai.folderPhotoId), ai.aiPhotoUrl);
            }
          }

          // 원본 사진에 aiUrl 병합
          for (const photo of photos) {
            const matchByUrl = aiMap.get(photo.url) || aiMap.get(photo.imageUrl) || aiMap.get(photo.originalUrl) || aiMap.get(photo.photoUrl);
            const matchById = aiMap.get(String(photo.id)) || aiMap.get(String(photo.photoId));

            if (matchByUrl) {
              photo.aiUrl = matchByUrl;
            } else if (matchById) {
              photo.aiUrl = matchById;
            }
          }

          // URL 매칭이 안 된 경우: 순서 기반 매핑 (동일 인덱스)
          const unmatchedPhotos = photos.filter((p: any) => !p.aiUrl);
          if (unmatchedPhotos.length > 0 && aiPhotos.length > 0) {
            console.log(`[PHOTOS_API]   🤖 URL 미매칭 ${unmatchedPhotos.length}장 → 순서 기반 매핑 시도`);
            for (let i = 0; i < Math.min(photos.length, aiPhotos.length); i++) {
              if (!photos[i].aiUrl && aiPhotos[i].aiPhotoUrl) {
                photos[i].aiUrl = aiPhotos[i].aiPhotoUrl;
              }
            }
          }

          const aiUrlCount = photos.filter((p: any) => p.aiUrl).length;
          console.log(`[PHOTOS_API]   🤖 AI URL 병합 완료: ${aiUrlCount}/${photos.length}장에 aiUrl 설정됨`);
        } else {
          console.log(`[PHOTOS_API]   🤖 AI 사진 없음 (일반 폴더)`);
        }
      } else {
        console.log(`[PHOTOS_API]   🤖 AI photos API ${aiRes.status} — 건너뜀 (일반 폴더일 수 있음)`);
      }
    } catch (aiErr: any) {
      console.warn(`[PHOTOS_API]   🤖 AI photos 병합 실패 (무시): ${aiErr.message}`);
    }

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
