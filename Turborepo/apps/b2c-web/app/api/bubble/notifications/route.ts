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
 * GET /api/bubble/notifications?userId={number}&is_read={yes|no}
 * Bubble notification 테이블 조회 (Created Date 내림차순)
 */
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const constraints: any[] = [
      { key: "user_Id", constraint_type: "equals", value: Number(userId) },
    ];

    const isRead = req.nextUrl.searchParams.get("is_read");
    if (isRead === "yes" || isRead === "no") {
      constraints.push({
        key: "is_read",
        constraint_type: "equals",
        value: isRead === "yes",
      });
    }

    const params = new URLSearchParams({
      constraints: JSON.stringify(constraints),
      sort_field: "Created Date",
      descending: "true",
      limit: "50",
    });

    const url = `${getBaseUrl()}/notification?${params.toString()}`;
    const res = await fetch(url, { method: "GET", headers: headers(), cache: "no-store" });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[GET /api/bubble/notifications] HTTP ${res.status}:`, errText);
      return NextResponse.json({ error: "Bubble API error", notifications: [] }, { status: res.status });
    }

    const json = await res.json();
    const results = json?.response?.results ?? [];

    return NextResponse.json({ notifications: results, count: results.length });
  } catch (error) {
    console.error("[GET /api/bubble/notifications] Exception:", error);
    return NextResponse.json({ error: "Internal server error", notifications: [] }, { status: 500 });
  }
}

/**
 * POST /api/bubble/notifications
 * Bubble notification 테이블에 새 레코드 생성
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { created_at, updated_at, ...cleanBody } = body;

    const url = `${getBaseUrl()}/notification`;
    const res = await fetch(url, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(cleanBody),
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[POST /api/bubble/notifications] HTTP ${res.status}:`, errText);
      return NextResponse.json({ error: "Failed to create notification" }, { status: res.status });
    }

    const rawText = await res.text();
    if (!rawText || rawText.trim() === "") {
      return NextResponse.json({ success: true, id: null });
    }

    const json = JSON.parse(rawText);
    const createdId = json?.id || json?.response?.id || json?.response?._id;
    return NextResponse.json({ success: true, id: createdId });
  } catch (error) {
    console.error("[POST /api/bubble/notifications] Exception:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/bubble/notifications
 * body: { id: string } → is_read: true 업데이트
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const url = `${getBaseUrl()}/notification/${id}`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ is_read: true }),
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[PATCH /api/bubble/notifications] HTTP ${res.status}:`, errText);
      return NextResponse.json({ error: "Failed to update notification" }, { status: res.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PATCH /api/bubble/notifications] Exception:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
