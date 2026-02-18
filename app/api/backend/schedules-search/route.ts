import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_BASE_URL =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";

/**
 * GET /api/backend/schedules-search
 * 프록시: GET /api/v1/schedules/search (Public, 인증 불필요)
 * 쿼리: ?tourId=29&viewLanguage=ko
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tourId = searchParams.get("tourId") || "";
    const viewLanguage = searchParams.get("viewLanguage") || "ko";

    if (!tourId) {
      return NextResponse.json({ data: [], error: "tourId required" }, { status: 400 });
    }

    const url = `${API_BASE_URL}/api/v1/schedules/search?tourId=${tourId}&viewLanguage=${viewLanguage}`;
    console.log(`[SCHEDULES_SEARCH_PROXY] GET ${url}`);

    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    console.log(`[SCHEDULES_SEARCH_PROXY] Status: ${res.status}`);

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.error(`[SCHEDULES_SEARCH_PROXY] ❌ HTTP ${res.status}: ${errorText.substring(0, 500)}`);
      return NextResponse.json({ data: [], error: `Backend ${res.status}` }, { status: res.status });
    }

    const json = await res.json();
    return NextResponse.json(json);
  } catch (error: any) {
    console.error("[SCHEDULES_SEARCH_PROXY] ❌ Exception:", error.message);
    return NextResponse.json({ data: [], error: error.message }, { status: 500 });
  }
}
