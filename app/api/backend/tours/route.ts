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

    const rawText = await res.text();
    console.log(`[TOURS_PROXY] Status: ${res.status} | Body length: ${rawText.length}`);
    console.log(`[TOURS_PROXY] Body preview: ${rawText.substring(0, 300)}`);

    if (!res.ok) {
      console.error(`[TOURS_PROXY] ❌ HTTP ${res.status}: ${rawText.substring(0, 500)}`);
      return NextResponse.json({ data: [], error: `Backend ${res.status}` }, { status: res.status });
    }

    let json: any;
    try {
      json = JSON.parse(rawText);
    } catch (parseErr) {
      console.error(`[TOURS_PROXY] ❌ JSON 파싱 실패:`, parseErr);
      return NextResponse.json({ data: [], error: "Invalid JSON from backend", rawPreview: rawText.substring(0, 200) }, { status: 502 });
    }

    console.log(`[TOURS_PROXY] ✅ 응답 키: ${Object.keys(json).join(", ")}`);
    if (json.data) {
      const d = json.data;
      console.log(`[TOURS_PROXY] ✅ data 타입: ${Array.isArray(d) ? "array(" + d.length + ")" : typeof d}, content 존재: ${!!d.content}`);
    }

    return NextResponse.json(json);
  } catch (error: any) {
    console.error("[TOURS_PROXY] ❌ Exception:", error.message);
    return NextResponse.json({ data: [], error: error.message }, { status: 500 });
  }
}
