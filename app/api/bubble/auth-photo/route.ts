import { NextRequest, NextResponse } from "next/server";
import { updateAuthPhoto } from "@/lib/bubble-api";

// Next.js App Router API 라우트 설정
export const maxDuration = 60; // 최대 60초 (타임아웃 방지)
export const runtime = "nodejs"; // Node.js 런타임 사용 (body size 제한 완화)

/**
 * POST: 기존 pose_reservation 레코드에 인증사진을 PATCH로 업데이트
 * 
 * ✅ 흐름:
 *   클라이언트 → POST /api/bubble/auth-photo (이 라우트)
 *   이 라우트 → PATCH .../obj/pose_reservation/{id} (Bubble API)
 * 
 * Body: { pose_reservation_id: string, auth_photo: string }
 *   - pose_reservation_id: Bubble ID (숫자x숫자 패턴)
 *   - auth_photo: base64 인코딩된 이미지 데이터
 * 
 * Bubble API에는 auth_photo 필드만 body로 전송 (ID는 URL 경로에 포함)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔵 [API] Request Start → POST /api/bubble/auth-photo");
  console.log(`🕐 [API] 시각: ${new Date().toLocaleString("ko-KR")}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  try {
    // ── 1단계: 요청 바디 파싱 ──
    console.log("📥 [API] 요청 바디 파싱 중...");
    const body = await request.json();
    const { pose_reservation_id, auth_photo } = body;

    const bodyKeys = Object.keys(body);
    console.log(`📋 [API] 수신된 필드: [${bodyKeys.join(", ")}]`);

    // ⚠️ 하위호환: 대문자 R 키 방어
    const rawId = pose_reservation_id || body.pose_Reservation_Id || body.pose_reservation_Id;

    // ── ID 정제: URL이 섞여있으면 순수 Bubble ID만 추출 ──
    let finalId = rawId || "";
    const paramMatch = finalId.match(/reservation_id=(\d+x\d+)/);
    if (paramMatch) finalId = paramMatch[1];
    const bareMatch = finalId.match(/(\d{13,}x\d{13,})/);
    if (bareMatch) finalId = bareMatch[1];
    finalId = finalId.replace(/^MANUAL_/, "");

    console.log(`📋 [API] 원본 ID: ${rawId}`);
    console.log(`📋 [API] 최종 pose_reservation_id: ${finalId}`);

    if (auth_photo) {
      const photoSizeMB = (auth_photo.length / 1024 / 1024).toFixed(2);
      console.log(`📷 [API] auth_photo: 있음 (${photoSizeMB}MB)`);
      console.log(`📷 [API] base64 헤더(50자): ${auth_photo.substring(0, 50)}...`);
    } else {
      console.warn("⚠️ [API] auth_photo: ❌ 데이터 없음");
    }

    // ── 2단계: 필수값 검증 ──
    if (!finalId) {
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.error("❌ [API] 필수값 누락 → pose_reservation_id가 없습니다!");
      console.error(`❌ [API] 수신된 body 키: [${bodyKeys.join(", ")}]`);
      console.error(`⏱️ [API] 처리 시간: ${Date.now() - startTime}ms`);
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
      return NextResponse.json(
        { error: "pose_reservation_id required", receivedKeys: bodyKeys },
        { status: 400 }
      );
    }

    // ID가 숫자x숫자 패턴인지 최종 확인
    if (!/^\d+x\d+$/.test(finalId)) {
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.error("❌ [API] ID 형식 이상! Bubble ID는 '숫자x숫자' 패턴이어야 합니다");
      console.error(`❌ [API] 받은 값: "${finalId}"`);
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
      return NextResponse.json(
        { error: "Invalid pose_reservation_id format. Expected: digits x digits", received: finalId },
        { status: 400 }
      );
    }

    // ── 3단계: Bubble API 호출 (PATCH pose_reservation/{id}) ──
    try {
      console.log("🚀 [API] Bubble API 호출 시작 → PATCH pose_reservation/" + finalId);
      const bubbleStartTime = Date.now();

      const result = await updateAuthPhoto({
        pose_reservation_id: finalId,
        auth_photo,
      });

      const bubbleElapsed = Date.now() - bubbleStartTime;
      console.log(`⏱️ [API] Bubble API 응답 시간: ${bubbleElapsed}ms`);

      if (!result) {
        console.error("❌ [API] Bubble API가 null을 반환함");
        return NextResponse.json(
          { error: "Bubble API returned null result" },
          { status: 502 }
        );
      }

      const lightweightResponse = {
        success: true,
        id: result._id,
        pose_reservation_id: finalId,
        message: "인증사진이 성공적으로 저장되었습니다"
      };

      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("✅ [API] 인증사진 PATCH 성공!");
      console.log(`📌 [API] pose_reservation_id: ${finalId}`);
      console.log(`⏱️ [API] 총 처리 시간: ${Date.now() - startTime}ms`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
      return NextResponse.json(lightweightResponse);

    } catch (bubbleError: any) {
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.error("❌ [API] Bubble API 에러 발생!");
      console.error(`📋 [API] 에러 메시지: ${bubbleError.message || bubbleError}`);
      console.error("📋 [API] 전체 스택 트레이스:");
      console.error(bubbleError.stack || bubbleError);
      console.error(`⏱️ [API] 총 처리 시간: ${Date.now() - startTime}ms`);
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

      const statusMatch = bubbleError.message?.match(/Error (\d{3}):/);
      const status = statusMatch ? parseInt(statusMatch[1]) : 502;

      return NextResponse.json(
        {
          error: "Bubble API error",
          message: bubbleError.message || "Unknown error",
        },
        { status }
      );
    }
  } catch (e: any) {
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("❌ [API] 최상위 서버 에러!");
    console.error(`📋 [API] 에러: ${e.message || e}`);
    console.error(e.stack || e);
    console.error(`⏱️ [API] 처리 시간: ${Date.now() - startTime}ms`);
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    return NextResponse.json(
      { error: "Server error", message: e.message || "Unknown server error" },
      { status: 500 }
    );
  }
}
