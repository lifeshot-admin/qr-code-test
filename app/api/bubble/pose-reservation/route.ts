import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const isDev = process.env.NODE_ENV === "development";

const getTimestamp = (): string => {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  return `[${hours}:${minutes}:${seconds}]`;
};

/**
 * 6자리 랜덤 숫자 코드 생성 (100000 ~ 999999)
 * 고객이 기억하기 쉽도록 숫자만으로 구성
 */
function generateReservationCode(): string {
  const code = Math.floor(100000 + Math.random() * 900000);
  return String(code);
}

/**
 * POST /api/bubble/pose-reservation
 * 
 * Bubble DB의 pose_reservation 테이블에 새로운 예약 레코드를 생성합니다.
 * 
 * ✅ Bubble 허용 필드: folder_Id, tour_Id, user_Id, status, user_nickname, Id
 * ✅ Id 필드: 6자리 랜덤 예약 코드 (고객 식별용)
 * ⚠️ 슬러그는 반드시 pose_reservation (언더바)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { folder_Id, tour_Id, user_Id, user_nickname, persona } = body;

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`${getTimestamp()} 🏰 [BUBBLE] STEP 1: Creating pose_reservation`);
    console.log(`${getTimestamp()} 📁 folder_Id: ${folder_Id} | 🎫 tour_Id: ${tour_Id} | 👤 user_Id: ${user_Id}`);
    if (user_nickname) console.log(`${getTimestamp()} 👤 user_nickname: ${user_nickname}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Validation
    if (!folder_Id || !tour_Id || !user_Id) {
      console.error(`${getTimestamp()} ❌ [BUBBLE] Missing required fields`);
      return NextResponse.json(
        { success: false, error: "Missing required fields: folder_Id, tour_Id, user_Id" },
        { status: 400 }
      );
    }

    // ── URL 생성 ──
    let BUBBLE_API_BASE_URL = process.env.BUBBLE_API_BASE_URL || "https://lifeshot.me/version-test/api/1.1";
    
    if (!BUBBLE_API_BASE_URL.includes("/version-test/")) {
      const baseUrl = BUBBLE_API_BASE_URL.replace(/\/$/, "");
      BUBBLE_API_BASE_URL = `${baseUrl}/version-test/api/1.1`;
    }
    if (!BUBBLE_API_BASE_URL.includes("/api/1.1")) {
      BUBBLE_API_BASE_URL = `${BUBBLE_API_BASE_URL}/api/1.1`;
    }
    
    const BUBBLE_API_TOKEN = process.env.BUBBLE_API_TOKEN;
    if (!BUBBLE_API_TOKEN) {
      console.error(`${getTimestamp()} ❌ [BUBBLE] Missing BUBBLE_API_TOKEN`);
      return NextResponse.json(
        { success: false, error: "Server configuration error" },
        { status: 500 }
      );
    }

    // ── 6자리 예약 코드 생성 ──
    const reservationCode = generateReservationCode();
    console.log(`${getTimestamp()} 🔢 생성된 예약 코드: ${reservationCode}`);

    // ── Bubble Payload 구성 ──
    // ✅ 허용 필드만 전송 (Bubble에 없는 필드를 보내면 400 Unrecognized field 에러)
    const bubblePayload: Record<string, any> = {
      folder_Id: Number(folder_Id),
      tour_Id: Number(tour_Id),
      user_Id: Number(user_Id),
      status: "pending",
      Id: reservationCode,
    };

    if (user_nickname) {
      bubblePayload.user_nickname = String(user_nickname);
    }

    // persona: JSON 문자열로 저장 (예: {"count":2,"category":"couple"})
    if (persona) {
      bubblePayload.persona = typeof persona === "string" ? persona : JSON.stringify(persona);
    }

    // ── 슬러그 고정: pose_reservation (언더바) ──
    const SLUG = "pose_reservation";
    const url = `${BUBBLE_API_BASE_URL}/obj/${SLUG}`;

    // 개발 모드에서만 상세 로그
    if (isDev) {
      console.log(`${getTimestamp()} 🔍 [DEV] Full URL: ${url}`);
      console.log(`${getTimestamp()} 🔍 [DEV] Method: POST`);
      console.log(`${getTimestamp()} 🔍 [DEV] Payload keys: [${Object.keys(bubblePayload).join(", ")}]`);
      console.log(`${getTimestamp()} 🔍 [DEV] Payload:`, JSON.stringify(bubblePayload));
    }

    // ── Bubble API 호출 (POST) ──
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${BUBBLE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bubblePayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.error(`${getTimestamp()} ❌ [BUBBLE] POST 실패! HTTP ${response.status}`);
      console.error(`${getTimestamp()} 📋 URL: ${url}`);
      console.error(`${getTimestamp()} 📋 에러 응답: ${errorText}`);
      console.error(`${getTimestamp()} 📋 전송한 Payload: ${JSON.stringify(bubblePayload)}`);
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      
      return NextResponse.json(
        {
          success: false,
          error: `Bubble API error: ${response.status}`,
          details: errorText,
          url_used: url,
          payload_keys: Object.keys(bubblePayload),
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const reservationId = data.id || data._id || data.response?.id || "";

    console.log(`${getTimestamp()} ✅ [BUBBLE] pose_reservation 생성 성공! ID: ${reservationId} | 예약코드: ${reservationCode}`);

    return NextResponse.json({
      success: true,
      reservation_id: reservationId,
      reservation_code: reservationCode,
      data: data,
    });

  } catch (error) {
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error(`${getTimestamp()} ❌ [BUBBLE] pose_reservation 생성 예외 발생`);
    console.error(`${getTimestamp()} Error:`, error);
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
