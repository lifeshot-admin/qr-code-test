import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_BASE_URL =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";

/**
 * GET /api/backend/tours/[tourId]
 * 프록시: GET /api/v1/tours/search/{tourId}
 *
 * Swagger 규격: Accept-Language 헤더로 언어 전달
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { tourId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const lang = searchParams.get("lang") || "ko";
    const tourId = params.tourId;

    const url = `${API_BASE_URL}/api/v1/tours/search/${tourId}`;
    console.log(`[TOUR_DETAIL_PROXY] GET ${url} | Accept-Language: ${lang}`);

    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "Accept-Language": lang,
      },
      cache: "no-store",
    });

    const rawText = await res.text();
    console.log(`[TOUR_DETAIL_PROXY] Status: ${res.status} | Body length: ${rawText.length}`);
    console.log(`[TOUR_DETAIL_PROXY] Body preview: ${rawText.substring(0, 400)}`);

    if (!res.ok) {
      console.error(`[TOUR_DETAIL_PROXY] ❌ HTTP ${res.status}: ${rawText.substring(0, 500)}`);
      return NextResponse.json({ data: null, error: `Backend ${res.status}` }, { status: res.status });
    }

    let json: any;
    try {
      json = JSON.parse(rawText);
    } catch {
      console.error(`[TOUR_DETAIL_PROXY] ❌ JSON 파싱 실패`);
      return NextResponse.json({ data: null, error: "Invalid JSON from backend" }, { status: 502 });
    }

    return NextResponse.json(json);
  } catch (error: any) {
    console.error("[TOUR_DETAIL_PROXY] ❌ Exception:", error.message);
    return NextResponse.json({ data: null, error: error.message }, { status: 500 });
  }
}
