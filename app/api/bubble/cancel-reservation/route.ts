import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const getTimestamp = (): string => {
  const now = new Date();
  return `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;
};

/**
 * 🗑️ 버블 예약 취소 (pose_reservation + reserved_pose 삭제)
 *
 * DELETE /api/bubble/cancel-reservation
 * Body: { reservation_id: string }
 *
 * 📌 [운영 로직] Status 흐름:
 *   pending → (취소 시) 레코드 삭제
 *   scanned/completed → 삭제 불가 (이미 진행 중)
 */
export async function DELETE(request: NextRequest) {
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
    console.log(`${getTimestamp()} 🗑️ [CANCEL] 예약 취소 시작: ${reservation_id}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // STEP 1: reserved_pose 하위 레코드 삭제
    const poseEndpoints = ["reserved_pose", "reserved-pose"];
    let deletedPoseCount = 0;
    let confirmedPoseEp: string | null = null;

    for (const ep of poseEndpoints) {
      const constraints = JSON.stringify([
        { key: "pose_reservation_Id", constraint_type: "equals", value: reservation_id },
      ]);
      const url = `${BUBBLE_API_BASE_URL}/obj/${ep}?constraints=${encodeURIComponent(constraints)}`;

      try {
        const res = await fetch(url, {
          method: "GET",
          headers: authHeaders,
        });

        if (res.ok) {
          confirmedPoseEp = ep;
          const json = await res.json();
          const poses = json?.response?.results ?? [];
          console.log(`${getTimestamp()} 📸 [CANCEL] reserved_pose ${poses.length}개 발견 (${ep})`);

          // 각 포즈 삭제
          for (const pose of poses) {
            try {
              const deleteUrl = `${BUBBLE_API_BASE_URL}/obj/${ep}/${pose._id}`;
              const delRes = await fetch(deleteUrl, {
                method: "DELETE",
                headers: authHeaders,
              });

              if (delRes.ok || delRes.status === 204) {
                deletedPoseCount++;
                console.log(`${getTimestamp()}   ✅ Deleted reserved_pose: ${pose._id}`);
              } else {
                console.error(`${getTimestamp()}   ❌ Failed to delete: ${pose._id} (${delRes.status})`);
              }
            } catch (e) {
              console.error(`${getTimestamp()}   ❌ Delete exception: ${pose._id}`, e);
            }
          }
          break;
        } else if (res.status === 404) {
          continue;
        }
      } catch (e) {
        continue;
      }
    }

    console.log(`${getTimestamp()} 📸 [CANCEL] reserved_pose 삭제 완료: ${deletedPoseCount}개`);

    // STEP 2: pose_reservation 마스터 레코드 삭제
    const reservationEndpoints = ["pose_reservation", "pose-reservation"];
    let masterDeleted = false;

    for (const ep of reservationEndpoints) {
      const deleteUrl = `${BUBBLE_API_BASE_URL}/obj/${ep}/${reservation_id}`;
      console.log(`${getTimestamp()} 🗑️ [CANCEL] Trying DELETE: ${deleteUrl}`);

      try {
        const delRes = await fetch(deleteUrl, {
          method: "DELETE",
          headers: authHeaders,
        });

        if (delRes.ok || delRes.status === 204) {
          masterDeleted = true;
          console.log(`${getTimestamp()} ✅ [CANCEL] pose_reservation 삭제 성공 (${ep})`);
          break;
        } else if (delRes.status === 404) {
          console.warn(`${getTimestamp()} ⚠️ [CANCEL] ${ep}/${reservation_id} 404, trying next...`);
          continue;
        } else {
          const errText = await delRes.text();
          console.error(`${getTimestamp()} ❌ [CANCEL] ${ep} 삭제 실패: ${delRes.status} ${errText}`);
        }
      } catch (e) {
        console.error(`${getTimestamp()} ❌ [CANCEL] ${ep} 삭제 예외:`, e);
        continue;
      }
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`${getTimestamp()} ${masterDeleted ? "✅✅✅" : "❌❌❌"} [CANCEL] 예약 취소 ${masterDeleted ? "완료" : "실패"}`);
    console.log(`${getTimestamp()}   Master 삭제: ${masterDeleted ? "✅" : "❌"}`);
    console.log(`${getTimestamp()}   Detail 삭제: ${deletedPoseCount}개`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return NextResponse.json({
      success: masterDeleted,
      deleted_poses: deletedPoseCount,
      master_deleted: masterDeleted,
    });
  } catch (error) {
    console.error(`${getTimestamp()} ❌ [CANCEL] Error:`, error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
