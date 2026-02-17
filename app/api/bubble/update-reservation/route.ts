import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/bubble/update-reservation
 *
 * Bubble DB의 pose_reservation 레코드를 부분 업데이트합니다.
 * 주 용도: 예약 생성 후 qrcode_url 필드를 채워넣기 위함.
 *
 * Body: { reservation_id: string, qrcode_url?: string, status?: string }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { reservation_id, ...updateFields } = body;

    if (!reservation_id) {
      return NextResponse.json(
        { success: false, error: "reservation_id is required" },
        { status: 400 },
      );
    }

    let BUBBLE_API_BASE_URL =
      process.env.BUBBLE_API_BASE_URL ||
      "https://lifeshot.me/version-test/api/1.1";

    if (!BUBBLE_API_BASE_URL.includes("/version-test/")) {
      BUBBLE_API_BASE_URL = `${BUBBLE_API_BASE_URL.replace(/\/$/, "")}/version-test/api/1.1`;
    }
    if (!BUBBLE_API_BASE_URL.includes("/api/1.1")) {
      BUBBLE_API_BASE_URL = `${BUBBLE_API_BASE_URL}/api/1.1`;
    }

    const BUBBLE_API_TOKEN = process.env.BUBBLE_API_TOKEN;
    if (!BUBBLE_API_TOKEN) {
      return NextResponse.json(
        { success: false, error: "Server config error" },
        { status: 500 },
      );
    }

    console.log("━━━ [UPDATE_RESERVATION] 시작 ━━━");
    console.log(`  reservation_id: ${reservation_id}`);
    console.log(`  업데이트 필드:`, updateFields);

    // Slug fallback
    const endpointNames = ["pose_reservation", "pose-reservation"];
    let success = false;

    for (const ep of endpointNames) {
      const url = `${BUBBLE_API_BASE_URL}/obj/${ep}/${reservation_id}`;
      console.log(`  [PATCH] ${url}`);

      try {
        const res = await fetch(url, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${BUBBLE_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updateFields),
        });

        console.log(`  [PATCH] ${ep} → ${res.status}`);

        if (res.ok || res.status === 204) {
          success = true;
          console.log(`  ✅ [UPDATE_RESERVATION] 성공 (${ep})`);
          break;
        } else if (res.status === 404) {
          console.warn(`  ⚠️ ${ep} 404, trying next...`);
          continue;
        } else {
          const errText = await res.text();
          console.error(`  ❌ ${ep} error: ${errText.substring(0, 200)}`);
        }
      } catch (e) {
        console.error(`  ❌ ${ep} fetch error:`, e);
        continue;
      }
    }

    if (!success) {
      return NextResponse.json(
        { success: false, error: "All PATCH endpoints failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[UPDATE_RESERVATION] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
