import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_BASE_URL =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";

/**
 * GET /api/backend/tours/[tourId]
 * 프록시: GET /api/v1/tours/search/{tourId}
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { tourId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const viewLanguage = searchParams.get("viewLanguage") || "ko";
    const tourId = params.tourId;

    const url = `${API_BASE_URL}/api/v1/tours/search/${tourId}?viewLanguage=${viewLanguage}`;
    console.log(`[TOUR_DETAIL_PROXY] GET ${url}`);

    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    console.log(`[TOUR_DETAIL_PROXY] Status: ${res.status}`);

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.error(`[TOUR_DETAIL_PROXY] ❌ HTTP ${res.status}: ${errorText.substring(0, 500)}`);
      return NextResponse.json({ data: null, error: `Backend ${res.status}` }, { status: res.status });
    }

    const json = await res.json();
    return NextResponse.json(json);
  } catch (error: any) {
    console.error("[TOUR_DETAIL_PROXY] ❌ Exception:", error.message);
    return NextResponse.json({ data: null, error: error.message }, { status: 500 });
  }
}
