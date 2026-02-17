import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const APP_NAME = process.env.NEXT_PUBLIC_BUBBLE_APP_NAME || "";
const API_TOKEN = process.env.BUBBLE_API_TOKEN || "";
const API_BASE_URL = process.env.BUBBLE_API_BASE_URL || "";
const USE_VERSION_TEST =
  process.env.BUBBLE_USE_VERSION_TEST === "true" ||
  process.env.BUBBLE_USE_VERSION_TEST === "1";

function getBaseUrl(): string {
  if (API_BASE_URL) {
    const versionPath = USE_VERSION_TEST ? "/version-test" : "";
    return `${API_BASE_URL}${versionPath}/api/1.1/obj`;
  }
  if (APP_NAME) {
    const versionPath = USE_VERSION_TEST ? "/version-test" : "";
    return `https://${APP_NAME}.bubbleapps.io${versionPath}/api/1.1/obj`;
  }
  return "";
}

/**
 * GET /api/bubble/match-reservation-code?code=123456
 *
 * 6자리 숫자 코드로 pose_reservation을 검색하여
 * 매칭되는 예약의 ID를 반환한다.
 *
 * Bubble의 pose_reservation 테이블에서 _id의 마지막 6자리(숫자)로 매칭.
 * 실제로는 전체 목록을 가져와 endsWith 매칭을 수행한다.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code || code.length < 6) {
    return NextResponse.json(
      { success: false, message: "6자리 코드를 입력해주세요." },
      { status: 400 },
    );
  }

  const baseUrl = getBaseUrl();
  if (!baseUrl || !API_TOKEN) {
    console.error("[MATCH_CODE] Bubble API 설정 없음");
    return NextResponse.json(
      { success: false, message: "서버 설정 오류" },
      { status: 500 },
    );
  }

  try {
    // pose_reservation 목록을 조회하여 코드 매칭
    // status가 pending/scanned인 것만 (활성 예약)
    const url = `${baseUrl}/pose_reservation?sort_field=Created Date&descending=true&limit=100`;
    console.log(`[MATCH_CODE] 검색 중... code=${code}, url=${url}`);

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[MATCH_CODE] Bubble API 오류: ${res.status} — ${errText.substring(0, 200)}`);
      return NextResponse.json(
        { success: false, message: "예약 조회 실패" },
        { status: res.status },
      );
    }

    const data = await res.json();
    const results = data.response?.results || [];

    console.log(`[MATCH_CODE] ${results.length}개 예약에서 코드 "${code}" 검색 중...`);

    // 진단: 각 예약의 _id와 6자리 코드를 출력
    if (results.length > 0) {
      console.log("[MATCH_CODE] === 예약 목록 (최대 10개) ===");
      results.slice(0, 10).forEach((r: any, i: number) => {
        const idNumbers = (r._id || "").replace(/\D/g, "");
        const sixDigit = idNumbers.slice(-6);
        console.log(`  [${i}] _id: ${r._id} → 숫자: ${idNumbers} → 6자리: ${sixDigit} | folder_Id: ${r.folder_Id} | status: ${r.status}`);
      });
      console.log("[MATCH_CODE] ===========================");
    }

    // _id의 숫자 부분 마지막 6자리로 매칭
    const matched = results.find((r: any) => {
      const idNumbers = (r._id || "").replace(/\D/g, "");
      return idNumbers.slice(-6) === code;
    });

    if (matched) {
      console.log(`[MATCH_CODE] ✅ 매칭 성공! reservationId=${matched._id}, folder_Id=${matched.folder_Id}, status=${matched.status}`);
      return NextResponse.json({
        success: true,
        reservationId: matched._id,
        folderId: matched.folder_Id,
        status: matched.status,
      });
    }

    console.log(`[MATCH_CODE] ❌ 매칭 실패 — code="${code}" | 검색 대상 ${results.length}개 중 일치 없음`);
    return NextResponse.json({
      success: false,
      message: "해당 코드와 일치하는 예약을 찾을 수 없습니다.\n코드를 다시 확인해주세요.",
    });
  } catch (e: any) {
    console.error("[MATCH_CODE] 에러:", e.message);
    return NextResponse.json(
      { success: false, message: "코드 확인 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
