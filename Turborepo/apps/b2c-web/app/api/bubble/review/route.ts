import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const API_TOKEN = process.env.BUBBLE_API_TOKEN || "";
const API_BASE_URL = process.env.BUBBLE_API_BASE_URL || "";
const USE_VERSION_TEST =
  process.env.BUBBLE_USE_VERSION_TEST === "true" ||
  process.env.BUBBLE_USE_VERSION_TEST === "1";

function getBaseUrl(): string {
  const host = API_BASE_URL.replace(/\/$/, "");
  const versionPath = USE_VERSION_TEST ? "/version-test" : "";
  return `${host}${versionPath}/api/1.1/obj`;
}

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${API_TOKEN}`,
    "Content-Type": "application/json",
  };
}

/**
 * GET /api/bubble/review?album_Id={albumId}
 * album_Id로 리뷰 존재 여부 조회 (deleted/hide 상태 제외)
 */
export async function GET(req: NextRequest) {
  try {
    const albumId = req.nextUrl.searchParams.get("album_Id");
    if (!albumId) {
      return NextResponse.json(
        { error: "album_Id is required" },
        { status: 400 },
      );
    }

    const constraints = JSON.stringify([
      { key: "album_Id", constraint_type: "equals", value: albumId },
      { key: "status", constraint_type: "not equal", value: "deleted" },
      { key: "status", constraint_type: "not equal", value: "hide" },
    ]);
    const url = `${getBaseUrl()}/review?constraints=${encodeURIComponent(constraints)}`;

    const res = await fetch(url, {
      method: "GET",
      headers: headers(),
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[GET /api/bubble/review] HTTP ${res.status}:`, errText);
      return NextResponse.json(
        { error: "Bubble API error", reviews: [] },
        { status: res.status },
      );
    }

    const json = await res.json();
    const results = json?.response?.results ?? [];

    return NextResponse.json({ reviews: results, count: results.length });
  } catch (error) {
    console.error("[GET /api/bubble/review] Exception:", error);
    return NextResponse.json(
      { error: "Internal server error", reviews: [] },
      { status: 500 },
    );
  }
}

/**
 * POST /api/bubble/review
 * review 테이블에 새 레코드 생성
 * Bubble 시스템 필드(Created Date 등)와 충돌하는 필드는 제거
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { created_at, updated_at, ...cleanBody } = body;

    const url = `${getBaseUrl()}/review`;

    const res = await fetch(url, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(cleanBody),
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[POST /api/bubble/review] HTTP ${res.status}:`, errText);
      return NextResponse.json(
        { error: "Failed to create review" },
        { status: res.status },
      );
    }

    const rawText = await res.text();
    if (!rawText || rawText.trim() === "") {
      return NextResponse.json({ success: true, id: null });
    }

    const json = JSON.parse(rawText);
    const createdId = json?.id || json?.response?.id || json?.response?._id;

    return NextResponse.json({ success: true, id: createdId });
  } catch (error) {
    console.error("[POST /api/bubble/review] Exception:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
