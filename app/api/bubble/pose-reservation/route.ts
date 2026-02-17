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
 * 🏰 버블 왕국 - STEP 1: Master Record 생성
 * 
 * POST /api/bubble/pose-reservation
 * 
 * 버블 DB의 pose_reservation 테이블에 새로운 예약 레코드를 생성합니다.
 * 자바 백엔드에서 받은 folder_Id를 출입증으로 사용합니다.
 * 
 * ✨ Fallback Logic: pose_reservation 실패 시 pose-reservation 자동 재시도
 * 
 * Payload:
 * {
 *   folder_Id: number,    // 자바 백엔드 출입증 번호
 *   tour_Id: number,      // 투어 ID
 *   user_Id: string,      // 사용자 ID
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   reservation_id: string,  // 버블에서 생성된 Unique ID
 *   data: { ... }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { folder_Id, tour_Id, user_Id } = body;

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`${getTimestamp()} 🏰 [BUBBLE KINGDOM] STEP 1: Creating pose_reservation`);
    console.log(`${getTimestamp()} 📁 Folder ID (출입증):`, folder_Id);
    console.log(`${getTimestamp()} 🎫 Tour ID:`, tour_Id);
    console.log(`${getTimestamp()} 👤 User ID:`, user_Id);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Validation
    if (!folder_Id || !tour_Id || !user_Id) {
      console.error(`${getTimestamp()} ❌ [BUBBLE] Missing required fields`);
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: folder_Id, tour_Id, user_Id",
        },
        { status: 400 }
      );
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

    // ✅ [데이터] 버블 DB 규격에 맞춘 페이로드 생성
    // 🚨 [중요] created_at 제거! (버블 내부 Created Date가 자동 처리)
    // ✅ 허용된 필드: folder_Id, tour_Id, user_Id, status, qrcode_url
    // 
    // 📌 [운영 로직] Status 흐름 (향후 포토그래퍼 앱 연동):
    //   1. pending (초기) - 예약 생성 시
    //   2. scanned (스캔 완료) - 포토그래퍼가 QR 스캔 시
    //   3. completed (완료) - 촬영 및 인증샷 전송 완료 시
    const bubblePayload = {
      folder_Id: Number(folder_Id),  // ✅ Number 타입 강제
      tour_Id: Number(tour_Id),      // ✅ Number 타입 강제
      user_Id: Number(user_Id),      // ✅ Number 타입 강제
      status: "pending",             // ✅ 초기 상태값 설정
      // qrcode_url: "",             // 선택적 필드 (QR 생성 후 업데이트)
    };

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`${getTimestamp()} 📄 [최종 서류] 버블로 보내는 Payload:`);
    console.log(`${getTimestamp()}   folder_Id: ${bubblePayload.folder_Id} (${typeof bubblePayload.folder_Id})`);
    console.log(`${getTimestamp()}   tour_Id: ${bubblePayload.tour_Id} (${typeof bubblePayload.tour_Id})`);
    console.log(`${getTimestamp()}   user_Id: ${bubblePayload.user_Id} (${typeof bubblePayload.user_Id})`);
    console.log(`${getTimestamp()}   status: "${bubblePayload.status}" (${typeof bubblePayload.status})`);
    console.log(`${getTimestamp()}   ⚠️ created_at 필드: 제거됨 ✅ (버블 자동 처리)`);
    console.log(`${getTimestamp()}   ⚠️ qrcode_url 필드: 생략 (선택적)`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // ✨ [핵심] Slug Fallback 로직
    const endpointNames = ["pose_reservation", "pose-reservation"];
    let response: Response | null = null;
    let successfulEndpoint: string = "";
    let successfulFullUrl: string = "";
    let lastError: string = "";

    for (const endpointName of endpointNames) {
      const url = `${BUBBLE_API_BASE_URL}/obj/${endpointName}`;
      console.log(`${getTimestamp()} 🔍 [FALLBACK] Trying endpoint: ${endpointName}`);
      console.log(`${getTimestamp()} 🌐 [FULL URL] ${url}`);

      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${BUBBLE_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(bubblePayload),
        });

        console.log(`${getTimestamp()} 📦 [BUBBLE API] Response status (${endpointName}):`, response.status);

        if (response.ok) {
          successfulEndpoint = endpointName;
          successfulFullUrl = url;
          console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
          console.log(`${getTimestamp()} ✨✨✨ [Endpoint Found] Real name is: ${endpointName}`);
          console.log(`${getTimestamp()} ✨ [SUCCESS] Full Path: ${url}`);
          console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
          break;
        } else if (response.status === 404) {
          const errorText = await response.text();
          lastError = errorText;
          console.warn(`${getTimestamp()} ⚠️ [FALLBACK] ${endpointName} not found (404), trying next...`);
          continue;
        } else {
          // Other errors (not 404)
          const errorText = await response.text();
          lastError = errorText;
          console.error(`${getTimestamp()} ❌ [BUBBLE API] Error with ${endpointName}:`, errorText);
          throw new Error(`Bubble API error: ${response.status} ${errorText}`);
        }
      } catch (fetchError) {
        console.error(`${getTimestamp()} ❌ [FALLBACK] Fetch error with ${endpointName}:`, fetchError);
        lastError = fetchError instanceof Error ? fetchError.message : "Unknown fetch error";
        continue;
      }
    }

    // 모든 fallback 실패
    if (!response || !response.ok) {
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.error(`${getTimestamp()} ❌❌❌ [FALLBACK FAILED] All endpoints failed!`);
      console.error(`${getTimestamp()} 🔍 Tried: ${endpointNames.join(", ")}`);
      console.error(`${getTimestamp()} 📝 Last error:`, lastError);
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      
      return NextResponse.json(
        {
          success: false,
          error: "버블 API 슬러그 설정을 확인해주세요 (pose_reservation vs pose-reservation)",
          details: lastError,
          tried_endpoints: endpointNames,
        },
        { status: 404 }
      );
    }

    const data = await response.json();
    
    // Bubble POST 응답: { id: "...", status: "..." } 또는 { _id: "..." }
    const reservationId = data.id || data._id || data.response?.id || "";
    
    // 6자리 백업 코드 추출
    const idNumbers = (reservationId || "").replace(/\D/g, "");
    const backupCode = idNumbers.slice(-6);
    
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`${getTimestamp()} ✅✅✅ [BUBBLE] pose_reservation created successfully!`);
    console.log(`${getTimestamp()} 🆔 Bubble Unique ID:`, reservationId);
    console.log(`${getTimestamp()} 🔢 6자리 백업 코드:`, backupCode);
    console.log(`${getTimestamp()} 🎯 Used endpoint:`, successfulEndpoint);
    console.log(`${getTimestamp()} 📦 Full response keys:`, Object.keys(data));
    console.log(`${getTimestamp()} 📦 data.id:`, data.id, "| data._id:", data._id);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    if (!reservationId) {
      console.error(`${getTimestamp()} ❌ [CRITICAL] Bubble 응답에 ID가 없음! 전체 응답:`, JSON.stringify(data).substring(0, 500));
    }

    return NextResponse.json({
      success: true,
      reservation_id: reservationId,
      backup_code: backupCode,
      data: data,
    });

  } catch (error) {
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error(`${getTimestamp()} ❌❌❌ [BUBBLE ERROR] Failed to create pose_reservation`);
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
