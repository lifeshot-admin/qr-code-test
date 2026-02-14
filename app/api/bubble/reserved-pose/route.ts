import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * ⏰ 타임스탬프 생성 함수
 */
const getTimestamp = (): string => {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  return `[${hours}:${minutes}:${seconds}]`;
};

/**
 * 🏰 버블 왕국 - STEP 2: Detail Records 생성
 * 
 * POST /api/bubble/reserved-pose
 * 
 * 버블 DB의 reserved_pose 테이블에 선택된 포즈들을 저장합니다.
 * pose_reservation_Id로 부모 레코드와 연결됩니다.
 * 
 * ✨ Fallback Logic: reserved_pose 실패 시 reserved-pose 자동 재시도
 * 
 * Payload:
 * {
 *   pose_reservation_id: string,  // STEP 1에서 생성된 버블 ID
 *   selected_poses: [
 *     {
 *       spot_pose_id: string,
 *       spot_id: number,
 *       spot_name: string,
 *     }
 *   ]
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   created_count: number,
 *   reserved_pose_ids: string[]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pose_reservation_id, selected_poses } = body;

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`${getTimestamp()} 🏰 [BUBBLE KINGDOM] STEP 2: Creating reserved_pose records`);
    console.log(`${getTimestamp()} 🔗 Parent ID (pose_reservation_Id):`, pose_reservation_id);
    console.log(`${getTimestamp()} 📸 Selected poses count:`, selected_poses?.length || 0);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Validation
    if (!pose_reservation_id || !selected_poses || !Array.isArray(selected_poses)) {
      console.error(`${getTimestamp()} ❌ [BUBBLE] Invalid payload`);
      return NextResponse.json(
        {
          success: false,
          error: "Invalid payload: pose_reservation_id and selected_poses required",
        },
        { status: 400 }
      );
    }

    if (selected_poses.length === 0) {
      console.warn(`${getTimestamp()} ⚠️ [BUBBLE] No poses to save`);
      return NextResponse.json({
        success: true,
        created_count: 0,
        reserved_pose_ids: [],
      });
    }

    // ✅ [최우선] 베이스 URL에 version-test/api/1.1 강제 포함
    let BUBBLE_API_BASE_URL = process.env.BUBBLE_API_BASE_URL || "https://lifeshot.me/version-test/api/1.1";
    
    // 🔧 [안전장치] version-test가 없으면 자동 추가
    if (!BUBBLE_API_BASE_URL.includes("/version-test/")) {
      const baseUrl = BUBBLE_API_BASE_URL.replace(/\/$/, ""); // 끝 슬래시 제거
      BUBBLE_API_BASE_URL = `${baseUrl}/version-test/api/1.1`;
      console.log(`${getTimestamp()} ⚠️ [URL FIX] version-test 자동 추가: ${BUBBLE_API_BASE_URL}`);
    }
    
    // 🔧 [안전장치] /api/1.1이 없으면 자동 추가
    if (!BUBBLE_API_BASE_URL.includes("/api/1.1")) {
      BUBBLE_API_BASE_URL = `${BUBBLE_API_BASE_URL}/api/1.1`;
      console.log(`${getTimestamp()} ⚠️ [URL FIX] /api/1.1 자동 추가: ${BUBBLE_API_BASE_URL}`);
    }
    
    console.log(`${getTimestamp()} 🔗 [BASE URL] ${BUBBLE_API_BASE_URL}`);
    
    const BUBBLE_API_TOKEN = process.env.BUBBLE_API_TOKEN;

    if (!BUBBLE_API_TOKEN) {
      console.error(`${getTimestamp()} ❌ [BUBBLE] Missing BUBBLE_API_TOKEN`);
      return NextResponse.json(
        {
          success: false,
          error: "Server configuration error",
        },
        { status: 500 }
      );
    }

    // ✅ Create reserved_pose records in Bubble (loop)
    const createdIds: string[] = [];
    let successCount = 0;
    let failCount = 0;
    
    // ✨ Endpoint 이름을 fallback으로 찾기 위한 변수
    let confirmedEndpoint: string | null = null;
    let confirmedFullUrl: string | null = null;

    console.log(`${getTimestamp()} 📤 [BUBBLE API] Creating reserved_pose records...`);

    for (let i = 0; i < selected_poses.length; i++) {
      const pose = selected_poses[i];
      
      try {
        // ✅ [데이터] 버블 DB 규격에 맞춘 페이로드 생성
        // 🚨 [중요] created_at, spot_Id, spot_name 제거! (버블 DB 스키마 일치)
        // ✅ 최종 서류: 오직 2개 필드만 전송
        const bubblePayload = {
          pose_reservation_Id: pose_reservation_id,  // 부모 레코드 연결 (text 타입)
          spot_pose_Id: pose.spot_pose_id,           // 포즈 ID (text 타입)
          // spot_Id: 제거됨! ✅
          // spot_name: 제거됨! ✅
          // created_at: 제거됨! ✅
        };

        console.log(`${getTimestamp()}   📄 [${i + 1}/${selected_poses.length}] 최종 서류:`, {
          pose_reservation_Id: bubblePayload.pose_reservation_Id,
          spot_pose_Id: bubblePayload.spot_pose_Id,
          '⚠️ spot_Id': '제거됨 ✅',
          '⚠️ spot_name': '제거됨 ✅',
          '⚠️ created_at': '제거됨 ✅',
        });

        // ✨ [핵심] Slug Fallback 로직 (첫 번째 요청에서만 시도)
        let response: Response | null = null;
        
        if (confirmedEndpoint) {
          // 이미 성공한 endpoint 사용
          response = await fetch(`${BUBBLE_API_BASE_URL}/obj/${confirmedEndpoint}`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${BUBBLE_API_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(bubblePayload),
          });
        } else {
          // 첫 요청: fallback 시도
          const endpointNames = ["reserved_pose", "reserved-pose"];
          
          for (const endpointName of endpointNames) {
            const url = `${BUBBLE_API_BASE_URL}/obj/${endpointName}`;
            console.log(`${getTimestamp()}   🔍 [FALLBACK] Trying endpoint: ${endpointName}`);
            console.log(`${getTimestamp()}   🌐 [FULL URL] ${url}`);

            response = await fetch(url, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${BUBBLE_API_TOKEN}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(bubblePayload),
            });

            console.log(`${getTimestamp()}   📦 [BUBBLE API] Response status (${endpointName}):`, response.status);

            if (response.ok) {
              confirmedEndpoint = endpointName;
              confirmedFullUrl = url;
              console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
              console.log(`${getTimestamp()}   ✨✨✨ [Endpoint Found] Real name is: ${endpointName}`);
              console.log(`${getTimestamp()}   ✨ [SUCCESS] Full Path: ${url}`);
              console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
              break;
            } else if (response.status === 404) {
              console.warn(`${getTimestamp()}   ⚠️ [FALLBACK] ${endpointName} not found (404), trying next...`);
              continue;
            } else {
              // Other errors
              break;
            }
          }
        }

        if (response && response.ok) {
          const data = await response.json();
          createdIds.push(data.id);
          successCount++;
          console.log(`${getTimestamp()}   ✅ [${i + 1}/${selected_poses.length}] Created: ${data.id}`);
        } else {
          const errorText = response ? await response.text() : "No response";
          console.error(`${getTimestamp()}   ❌ [${i + 1}/${selected_poses.length}] Failed:`, errorText);
          failCount++;
        }

      } catch (error) {
        console.error(`${getTimestamp()}   ❌ [${i + 1}/${selected_poses.length}] Exception:`, error);
        failCount++;
      }
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`${getTimestamp()} ✅✅✅ [BUBBLE] reserved_pose creation completed`);
    console.log(`${getTimestamp()}   Success: ${successCount}/${selected_poses.length}`);
    console.log(`${getTimestamp()}   Failed: ${failCount}/${selected_poses.length}`);
    console.log(`${getTimestamp()}   Used endpoint: ${confirmedEndpoint || "unknown"}`);
    console.log(`${getTimestamp()}   Created IDs:`, createdIds);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // ✅ 모든 포즈가 실패한 경우 에러
    if (successCount === 0 && selected_poses.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "버블 API 슬러그 설정을 확인해주세요 (reserved_pose vs reserved-pose)",
          created_count: successCount,
          failed_count: failCount,
          tried_endpoints: ["reserved_pose", "reserved-pose"],
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      created_count: successCount,
      failed_count: failCount,
      reserved_pose_ids: createdIds,
    });

  } catch (error) {
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error(`${getTimestamp()} ❌❌❌ [BUBBLE ERROR] Failed to create reserved_pose records`);
    console.error(`${getTimestamp()} Error:`, error);
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
