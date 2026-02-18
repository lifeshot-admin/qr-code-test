import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const API_BASE_URL =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";

export const dynamic = "force-dynamic";

function sanitizeAuthHeader(rawToken: string): string {
  let pure = rawToken;
  while (/^Bearer\s+/i.test(pure)) {
    pure = pure.replace(/^Bearer\s+/i, "");
  }
  return `Bearer ${pure.trim()}`;
}

/**
 * GET /api/backend/ai-status?folderId=...
 *
 * AI 전용 엔드포인트 GET /api/v1/ai/photos?folderId={folderId} 를 사용하여
 * AI 보정 진행률을 정확하게 집계합니다.
 *
 * 응답 필드 매핑:
 *   - content[].status       → PROCESSING | COMPLETED | FAILED
 *   - content[].aiPhotoUrl   → AI 보정본 URL (존재 시 완료로 간주)
 *   - content[].folderPhotoUrl → 원본 URL
 *   - content[].completedAt  → 완료 시각
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId");

    if (!folderId) {
      return NextResponse.json(
        { success: false, error: "folderId is required" },
        { status: 400 },
      );
    }

    const session = await getServerSession(authOptions);
    const accessToken = (session as any)?.accessToken;
    const userLan = (session as any)?.user?.lan || "ko";

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const authHeader = sanitizeAuthHeader(accessToken);

    // ━━━ AI 전용 API 호출 ━━━
    const aiPhotosUrl = `${API_BASE_URL}/api/v1/ai/photos?folderId=${folderId}`;
    console.log(`[AI_STATUS] 호출: ${aiPhotosUrl}`);

    const aiRes = await fetch(aiPhotosUrl, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        "Accept-Language": userLan,
      },
      cache: "no-store",
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => "");
      console.error(`[AI_STATUS] Backend ${aiRes.status} for folderId=${folderId}: ${errText.substring(0, 300)}`);
      return NextResponse.json(
        { success: false, error: `Backend ${aiRes.status}` },
        { status: aiRes.status },
      );
    }

    const resText = await aiRes.text();
    let parsed: any;
    try { parsed = JSON.parse(resText); } catch { parsed = {}; }

    // ━━━ 사진 배열 추출 (다중 경로 대응) ━━━
    let aiPhotos: any[] = [];
    if (parsed.content && Array.isArray(parsed.content)) {
      aiPhotos = parsed.content;
    } else if (parsed.data?.content && Array.isArray(parsed.data.content)) {
      aiPhotos = parsed.data.content;
    } else if (parsed.data && Array.isArray(parsed.data)) {
      aiPhotos = parsed.data;
    } else if (Array.isArray(parsed)) {
      aiPhotos = parsed;
    }

    const totalCount = aiPhotos.length;

    // ━━━ 디버그 로그: 첫 2장 필드 확인 ━━━
    if (aiPhotos.length > 0) {
      const sample = aiPhotos.slice(0, 2);
      console.log(`[AI_STATUS] folderId=${folderId}, totalAiPhotos=${totalCount}`);
      for (let i = 0; i < sample.length; i++) {
        const p = sample[i];
        console.log(`[AI_STATUS] photo[${i}] keys: ${JSON.stringify(Object.keys(p))}`);
        console.log(`[AI_STATUS] photo[${i}] status=${p.status}, aiPhotoUrl=${p.aiPhotoUrl ? "EXISTS" : "null"}, folderPhotoUrl=${p.folderPhotoUrl ? "EXISTS" : "null"}, completedAt=${p.completedAt}`);
      }
    } else {
      console.warn(`[AI_STATUS] folderId=${folderId}: AI 사진 0장`);
      console.warn(`[AI_STATUS] parsed keys: ${JSON.stringify(Object.keys(parsed))}`);
      console.warn(`[AI_STATUS] parsed (first 500): ${JSON.stringify(parsed).substring(0, 500)}`);
    }

    // ━━━ AI 상태 집계 ━━━
    let completedCount = 0;
    let processingCount = 0;
    let failedCount = 0;

    for (const photo of aiPhotos) {
      const status = String(photo.status || "").toUpperCase().trim();
      const hasOutput = !!photo.aiPhotoUrl;

      if (status === "COMPLETED" || status === "DONE" || status === "SUCCESS" || hasOutput) {
        completedCount++;
      } else if (status === "PROCESSING" || status === "IN_PROGRESS" || status === "RUNNING") {
        processingCount++;
      } else if (status === "FAILED" || status === "ERROR" || status === "FAILURE") {
        failedCount++;
      }
    }

    const pendingCount = totalCount - completedCount - processingCount - failedCount;
    const isComplete = totalCount > 0 && completedCount === totalCount;

    console.log(
      `[AI_STATUS] folderId=${folderId} 집계: ` +
      `total=${totalCount}, completed=${completedCount}, processing=${processingCount}, ` +
      `pending=${pendingCount}, failed=${failedCount}, isComplete=${isComplete}`
    );

    return NextResponse.json({
      success: true,
      folderId: Number(folderId),
      totalCount,
      completedCount,
      processingCount,
      pendingCount,
      failedCount,
      isComplete,
      percentage: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
    });
  } catch (e: any) {
    console.error("[AI_STATUS] 에러:", e.message);
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 },
    );
  }
}
