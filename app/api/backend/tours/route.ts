import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_BASE_URL =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";

/**
 * GET /api/backend/tours
 * 프록시: GET /api/v1/tours/search
 *
 * Swagger 규격:
 *  - 언어: Accept-Language 헤더 (쿼리 파라미터 아님)
 *  - 페이지네이션: page(1부터), size, sortBy, sortDir
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lang = searchParams.get("lang") || "ko";
    const page = searchParams.get("page") || "1";
    const size = searchParams.get("size") || "10";
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortDir = searchParams.get("sortDir") || "desc";

    const queryParams = new URLSearchParams({ page, size, sortBy, sortDir });
    const url = `${API_BASE_URL}/api/v1/tours/search?${queryParams.toString()}`;

    console.log(`[TOURS_PROXY] GET ${url} | Accept-Language: ${lang}`);

    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "Accept-Language": lang,
      },
      cache: "no-store",
    });

    const rawText = await res.text();
    console.log(`[TOURS_PROXY] Status: ${res.status} | Body length: ${rawText.length}`);
    console.log(`[TOURS_PROXY] Body preview: ${rawText.substring(0, 400)}`);

    if (!res.ok) {
      console.error(`[TOURS_PROXY] ❌ HTTP ${res.status}: ${rawText.substring(0, 500)}`);
      return NextResponse.json({ content: [], error: `Backend ${res.status}` }, { status: res.status });
    }

    let json: any;
    try {
      json = JSON.parse(rawText);
    } catch (parseErr) {
      console.error(`[TOURS_PROXY] ❌ JSON 파싱 실패:`, parseErr);
      return NextResponse.json({ content: [], error: "Invalid JSON from backend" }, { status: 502 });
    }

    const contentArr = json.content || json.data?.content || json.data || [];
    console.log(`[TOURS_PROXY] ✅ 전달할 content 수: ${Array.isArray(contentArr) ? contentArr.length : "N/A"}`);

    return NextResponse.json(json);
  } catch (error: any) {
    console.error("[TOURS_PROXY] ❌ Exception:", error.message);
    return NextResponse.json({ content: [], error: error.message }, { status: 500 });
  }
}
