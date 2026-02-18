import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_BASE_URL =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";

/**
 * GET /api/backend/schedules-search
 * 프록시: GET /api/v1/schedules/search
 *
 * Swagger 규격: Accept-Language 헤더, tourId 쿼리 파라미터
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tourId = searchParams.get("tourId") || "";
    const lang = searchParams.get("lang") || searchParams.get("viewLanguage") || "ko";

    if (!tourId) {
      return NextResponse.json({ content: [], error: "tourId required" }, { status: 400 });
    }

    const queryParams = new URLSearchParams({ tourId });
    const url = `${API_BASE_URL}/api/v1/schedules/search?${queryParams.toString()}`;
    console.log(`[SCHEDULES_PROXY] GET ${url} | Accept-Language: ${lang}`);

    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "Accept-Language": lang,
      },
      cache: "no-store",
    });

    const rawText = await res.text();
    console.log(`[SCHEDULES_PROXY] Status: ${res.status} | Body length: ${rawText.length}`);

    if (!res.ok) {
      console.error(`[SCHEDULES_PROXY] ❌ HTTP ${res.status}: ${rawText.substring(0, 500)}`);
      return NextResponse.json({ content: [], error: `Backend ${res.status}` }, { status: res.status });
    }

    let json: any;
    try {
      json = JSON.parse(rawText);
    } catch {
      console.error(`[SCHEDULES_PROXY] ❌ JSON 파싱 실패`);
      return NextResponse.json({ content: [], error: "Invalid JSON from backend" }, { status: 502 });
    }

    return NextResponse.json(json);
  } catch (error: any) {
    console.error("[SCHEDULES_PROXY] ❌ Exception:", error.message);
    return NextResponse.json({ content: [], error: error.message }, { status: 500 });
  }
}
