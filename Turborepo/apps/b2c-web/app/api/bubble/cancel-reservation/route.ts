import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const getTimestamp = (): string => {
  const now = new Date();
  return `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;
};

/**
 * 예약 취소 (상태 변경 방식 — 레코드 삭제 아님!)
 *
 * PATCH /api/bubble/cancel-reservation
 * Body: { reservation_id: string }
 *
 * pose_reservation.status → "CANCELED" 로 업데이트
 * reserved_pose 레코드는 보존 (참조 무결성 유지)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { reservation_id } = body;

    if (!reservation_id) {
      return NextResponse.json({ success: false, error: "reservation_id required" }, { status: 400 });
    }

    let BUBBLE_API_BASE_URL = process.env.BUBBLE_API_BASE_URL || "https://lifeshot.me/version-test/api/1.1";
    if (!BUBBLE_API_BASE_URL.includes("/version-test/")) {
      BUBBLE_API_BASE_URL = `${BUBBLE_API_BASE_URL.replace(/\/$/, "")}/version-test/api/1.1`;
    }
    if (!BUBBLE_API_BASE_URL.includes("/api/1.1")) {
      BUBBLE_API_BASE_URL = `${BUBBLE_API_BASE_URL}/api/1.1`;
    }

    const BUBBLE_API_TOKEN = process.env.BUBBLE_API_TOKEN;
    if (!BUBBLE_API_TOKEN) {
      return NextResponse.json({ success: false, error: "Server config error" }, { status: 500 });
    }

    const authHeaders = {
      Authorization: `Bearer ${BUBBLE_API_TOKEN}`,
      "Content-Type": "application/json",
    };

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`${getTimestamp()} 🔄 [CANCEL] 예약 상태 변경 시작: ${reservation_id}`);

    // pose_reservation 상태를 CANCELED로 업데이트 (삭제 아님!)
    const endpoints = ["pose_reservation", "pose-reservation"];
    let updated = false;

    for (const ep of endpoints) {
      const patchUrl = `${BUBBLE_API_BASE_URL}/obj/${ep}/${reservation_id}`;
      console.log(`${getTimestamp()} 🔄 [CANCEL] PATCH 시도: ${patchUrl}`);

      try {
        const res = await fetch(patchUrl, {
          method: "PATCH",
          headers: authHeaders,
          body: JSON.stringify({ status: "CANCELED" }),
        });

        console.log(`${getTimestamp()} 📦 [CANCEL] 응답: ${res.status} ${res.statusText}`);

        if (res.ok || res.status === 204) {
          updated = true;
          console.log(`${getTimestamp()} ✅ [CANCEL] pose_reservation 상태 → CANCELED (${ep})`);
          break;
        } else if (res.status === 404) {
          console.warn(`${getTimestamp()} ⚠️ [CANCEL] ${ep}/${reservation_id} 404 → 다음 슬러그 시도`);
          continue;
        } else {
          const errText = await res.text();
          console.error(`${getTimestamp()} ❌ [CANCEL] ${ep} PATCH 실패: ${res.status} ${errText.substring(0, 200)}`);
        }
      } catch (e: any) {
        console.error(`${getTimestamp()} ❌ [CANCEL] ${ep} PATCH 예외:`, e.message);
        continue;
      }
    }

    console.log(`${getTimestamp()} ${updated ? "✅✅✅" : "❌❌❌"} [CANCEL] 예약 상태 변경 ${updated ? "완료" : "실패"}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return NextResponse.json({
      success: updated,
      status_changed: updated ? "CANCELED" : null,
    });
  } catch (error) {
    console.error(`${getTimestamp()} ❌ [CANCEL] Error:`, error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
