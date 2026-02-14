import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * ⏰ 타임스탬프 생성 함수
 */
const getTimestamp = (): string => {
  const now = new Date();
  return `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;
};

/**
 * 🔍 버블 예약 조회 - folder_Id 기반
 *
 * GET /api/bubble/pose-reservation-by-folder?folder_id=11093
 *
 * 해당 folder_Id에 대한 pose_reservation 존재 여부 + reserved_pose 개수를 반환
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folder_id");

    if (!folderId) {
      return NextResponse.json({ success: false, error: "folder_id required" }, { status: 400 });
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

    console.log(`${getTimestamp()} 🔍 [LOOKUP] folder_id=${folderId} 예약 조회 시작`);

    // ✨ Slug Fallback
    const endpointNames = ["pose_reservation", "pose-reservation"];
    let reservationData: any = null;

    for (const ep of endpointNames) {
      const constraints = JSON.stringify([
        { key: "folder_Id", constraint_type: "equals", value: Number(folderId) },
      ]);
      const url = `${BUBBLE_API_BASE_URL}/obj/${ep}?constraints=${encodeURIComponent(constraints)}`;
      console.log(`${getTimestamp()} 🔍 [LOOKUP] Trying: ${url}`);

      try {
        const res = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${BUBBLE_API_TOKEN}`,
            "Content-Type": "application/json",
          },
        });

        if (res.ok) {
          const json = await res.json();
          const results = json?.response?.results ?? [];
          console.log(`${getTimestamp()} ✅ [LOOKUP] ${ep} → ${results.length}개 결과`);

          if (results.length > 0) {
            // 최신 것 선택
            reservationData = results.sort((a: any, b: any) =>
              new Date(b["Created Date"] || 0).getTime() - new Date(a["Created Date"] || 0).getTime()
            )[0];
          }
          break;
        } else if (res.status === 404) {
          console.warn(`${getTimestamp()} ⚠️ [LOOKUP] ${ep} 404, trying next...`);
          continue;
        }
      } catch (e) {
        console.error(`${getTimestamp()} ❌ [LOOKUP] ${ep} fetch error:`, e);
        continue;
      }
    }

    if (!reservationData) {
      console.log(`${getTimestamp()} 📭 [LOOKUP] folder_id=${folderId} 예약 없음`);
      return NextResponse.json({
        success: true,
        has_reservation: false,
        reservation: null,
        pose_count: 0,
      });
    }

    // reserved_pose 조회 (개수 + spot_pose_Id 목록)
    let poseCount = 0;
    const reservationId = reservationData._id;
    let reservedPoses: { id: string; spot_pose_Id: string }[] = [];

    const poseEndpoints = ["reserved_pose", "reserved-pose"];
    for (const ep of poseEndpoints) {
      const constraints = JSON.stringify([
        { key: "pose_reservation_Id", constraint_type: "equals", value: reservationId },
      ]);
      const url = `${BUBBLE_API_BASE_URL}/obj/${ep}?constraints=${encodeURIComponent(constraints)}`;

      try {
        const res = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${BUBBLE_API_TOKEN}`,
            "Content-Type": "application/json",
          },
        });

        if (res.ok) {
          const json = await res.json();
          const results = json?.response?.results ?? [];
          poseCount = results.length;

          // ✅ [수정 기능] 각 reserved_pose의 spot_pose_Id 추출
          reservedPoses = results.map((r: any) => ({
            id: r._id,
            spot_pose_Id: r.spot_pose_Id,
          }));

          console.log(`${getTimestamp()} ✅ [LOOKUP] reserved_pose → ${poseCount}개`);
          console.log(`${getTimestamp()} 📋 [LOOKUP] spot_pose_Ids:`, reservedPoses.map(p => p.spot_pose_Id));
          break;
        } else if (res.status === 404) {
          continue;
        }
      } catch (e) {
        continue;
      }
    }

    console.log(`${getTimestamp()} 📦 [LOOKUP] 결과: reservation_id=${reservationId}, status=${reservationData.status}, poses=${poseCount}`);

    return NextResponse.json({
      success: true,
      has_reservation: true,
      reservation: {
        id: reservationData._id,
        folder_Id: reservationData.folder_Id,
        tour_Id: reservationData.tour_Id,
        user_Id: reservationData.user_Id,
        status: reservationData.status || "pending",
        qrcode_url: reservationData.qrcode_url,
        created_date: reservationData["Created Date"],
      },
      pose_count: poseCount,
      reserved_poses: reservedPoses, // ✅ 수정 기능용: 기존 선택된 포즈 ID 목록
    });
  } catch (error) {
    console.error(`${getTimestamp()} ❌ [LOOKUP] Error:`, error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
