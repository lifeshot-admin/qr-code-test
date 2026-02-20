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
 * POST /api/bubble/review-image
 * review_image 테이블에 새 레코드 생성
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = `${getBaseUrl()}/review_image`;

    const res = await fetch(url, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(
        `[POST /api/bubble/review-image] HTTP ${res.status}:`,
        errText,
      );
      return NextResponse.json(
        { error: "Failed to create review image" },
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
    console.error("[POST /api/bubble/review-image] Exception:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
