import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_BASE_URL =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";

/**
 * GET /api/backend/tours
 * 프록시: GET /api/v1/tours/search
 * 클라이언트 CORS 우회용 서버 사이드 프록시
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const viewLanguage = searchParams.get("viewLanguage") || "ko";

    const url = `${API_BASE_URL}/api/v1/tours/search?viewLanguage=${viewLanguage}`;
    console.log(`[TOURS_PROXY] GET ${url}`);

    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    console.log(`[TOURS_PROXY] Status: ${res.status}`);

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.error(`[TOURS_PROXY] ❌ HTTP ${res.status}: ${errorText.substring(0, 500)}`);
      return NextResponse.json({ data: [], error: `Backend ${res.status}` }, { status: res.status });
    }

    const json = await res.json();
    return NextResponse.json(json);
  } catch (error: any) {
    console.error("[TOURS_PROXY] ❌ Exception:", error.message);
    return NextResponse.json({ data: [], error: error.message }, { status: 500 });
  }
}
