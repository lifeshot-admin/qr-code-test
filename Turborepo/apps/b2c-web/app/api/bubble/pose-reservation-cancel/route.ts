import { NextRequest, NextResponse } from "next/server";

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
 * PATCH /api/bubble/pose-reservation-cancel
 * body: { folderId: number }
 * Bubble pose_reservation 테이블에서 folder_Id가 일치하는 레코드의 status를 "canceled"로 변경
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { folderId } = body;

    if (!folderId) {
      return NextResponse.json({ error: "folderId is required" }, { status: 400 });
    }

    const constraints = JSON.stringify([
      { key: "folder_Id", constraint_type: "equals", value: Number(folderId) },
    ]);
    const searchUrl = `${getBaseUrl()}/pose_reservation?constraints=${encodeURIComponent(constraints)}&limit=5`;

    const searchRes = await fetch(searchUrl, { method: "GET", headers: headers(), cache: "no-store" });
    if (!searchRes.ok) {
      const errText = await searchRes.text();
      console.error(`[POSE_CANCEL] 검색 실패 ${searchRes.status}:`, errText);
      return NextResponse.json({ error: "Search failed" }, { status: searchRes.status });
    }

    const searchData = await searchRes.json();
    const results = searchData?.response?.results || [];

    if (results.length === 0) {
      return NextResponse.json({ success: true, message: "No pose_reservation found" });
    }

    const updateResults = await Promise.allSettled(
      results.map((r: any) =>
        fetch(`${getBaseUrl()}/pose_reservation/${r._id}`, {
          method: "PATCH",
          headers: headers(),
          body: JSON.stringify({ status: "canceled" }),
          cache: "no-store",
        })
      )
    );

    const successCount = updateResults.filter(r => r.status === "fulfilled").length;
    console.log(`[POSE_CANCEL] ${successCount}/${results.length} 레코드 canceled 처리 완료`);

    return NextResponse.json({ success: true, updatedCount: successCount });
  } catch (error: any) {
    console.error("[POSE_CANCEL] Exception:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
