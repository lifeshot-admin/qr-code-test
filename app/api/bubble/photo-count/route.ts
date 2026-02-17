import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BUBBLE_BASE = (process.env.BUBBLE_API_BASE_URL || "https://lifeshot.me").replace(/\/$/, "");
const BUBBLE_TOKEN = process.env.BUBBLE_API_TOKEN || "";
const USE_VERSION_TEST =
  process.env.BUBBLE_USE_VERSION_TEST === "true" || process.env.BUBBLE_USE_VERSION_TEST === "1";

function getBubbleObjUrl(): string {
  const vp = USE_VERSION_TEST ? "/version-test" : "";
  return `${BUBBLE_BASE}${vp}/api/1.1/obj`;
}

/**
 * GET /api/bubble/photo-count?tourId=27
 *
 * Bubble의 tour_photo_count 테이블에서 사진 장수를 반환.
 *
 * - tourId 지정 시: 해당 투어의 photo_count 합계만 반환
 * - tourId 미지정: 전체 합계 반환
 */
export async function GET(req: NextRequest) {
  const bubbleUrl = getBubbleObjUrl();
  const tourId = req.nextUrl.searchParams.get("tourId");

  try {
    let fetchUrl: string;

    if (tourId) {
      // 특정 투어 필터
      const constraints = JSON.stringify([
        { key: "tour_Id", constraint_type: "equals", value: String(tourId) },
      ]);
      fetchUrl = `${bubbleUrl}/tour_photo_count?constraints=${encodeURIComponent(constraints)}&sort_field=updated_date&descending=true&limit=50`;
      console.log(`[PHOTO_COUNT] 투어별 조회 (tourId=${tourId}) → ${fetchUrl}`);
    } else {
      // 전체 합계
      fetchUrl = `${bubbleUrl}/tour_photo_count?sort_field=updated_date&descending=true&limit=50`;
      console.log(`[PHOTO_COUNT] 전체 조회 → ${fetchUrl}`);
    }

    const res = await fetch(fetchUrl, {
      headers: { Authorization: `Bearer ${BUBBLE_TOKEN}` },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(`[PHOTO_COUNT] Bubble 조회 실패: ${res.status}`);
      return NextResponse.json({ totalPhotos: 0, date: null, tourId: tourId || null });
    }

    const data = await res.json();
    const results = data?.response?.results || [];

    let totalPhotos = 0;
    let latestDate: string | null = null;

    for (const item of results) {
      totalPhotos += Number(item.photo_count) || 0;
      if (!latestDate && item.updated_date) {
        latestDate = item.updated_date;
      }
    }

    console.log(`[PHOTO_COUNT] ${tourId ? `투어 ${tourId}` : "전체"}: ${totalPhotos}장 (records: ${results.length})`);

    return NextResponse.json({
      totalPhotos,
      date: latestDate,
      tourId: tourId || null,
      recordCount: results.length,
    });
  } catch (e: any) {
    console.error("[PHOTO_COUNT] 에러:", e.message);
    return NextResponse.json({ totalPhotos: 0, date: null, tourId: tourId || null });
  }
}
