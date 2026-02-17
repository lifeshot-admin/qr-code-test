import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_TOKEN = process.env.BUBBLE_API_TOKEN || "";
const API_BASE_URL = process.env.BUBBLE_API_BASE_URL || "";
const USE_VERSION_TEST =
  process.env.BUBBLE_USE_VERSION_TEST === "true" ||
  process.env.BUBBLE_USE_VERSION_TEST === "1";

function getBaseUrl(): string {
  if (API_BASE_URL) {
    const host = API_BASE_URL.replace(/\/$/, "");
    const versionPath = USE_VERSION_TEST ? "/version-test" : "";
    return `${host}${versionPath}/api/1.1/obj`;
  }
  return "";
}

/**
 * GET /api/bubble/match-reservation-code?code=123456
 *
 * 6자리 숫자 코드로 pose_reservation을 검색한다.
 * 
 * ✅ 검색 방식: Bubble constraints를 사용하여 Id 필드가 코드와 일치하는 레코드를 조회.
 *    → 전체 목록 fetch 후 클라이언트 매칭하는 것보다 효율적.
 * 
 * Fallback: Id 필드 검색이 실패하면, 기존 방식(_id 마지막 6자리)으로 재시도.
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
    // ── 방법 1: Id 필드로 직접 검색 (constraints) ──
    const constraints = JSON.stringify([
      { key: "Id", constraint_type: "equals", value: code },
    ]);
    const searchUrl = `${baseUrl}/pose_reservation?constraints=${encodeURIComponent(constraints)}`;

    console.log(`[MATCH_CODE] Id 필드 검색: code="${code}"`);

    const res = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${API_TOKEN}` },
      signal: AbortSignal.timeout(15_000),
    });

    if (res.ok) {
      const data = await res.json();
      const results = data.response?.results || [];

      if (results.length > 0) {
        const matched = results[0];
        console.log(`[MATCH_CODE] ✅ Id 필드 매칭 성공! _id=${matched._id}, Id=${matched.Id}, status=${matched.status}`);
        return NextResponse.json({
          success: true,
          reservationId: matched._id,
          reservationCode: matched.Id,
          folderId: matched.folder_Id,
          status: matched.status,
          nickname: matched.user_nickname || "",
        });
      }

      console.log(`[MATCH_CODE] Id 필드 매칭 실패 — Fallback으로 전환`);
    } else {
      console.warn(`[MATCH_CODE] Id 필드 검색 HTTP ${res.status} — Fallback으로 전환`);
    }

    // ── 방법 2: Fallback — _id 마지막 6자리로 매칭 ──
    const fallbackUrl = `${baseUrl}/pose_reservation?sort_field=Created Date&descending=true&limit=100`;
    console.log(`[MATCH_CODE] Fallback: 최근 100건에서 코드 "${code}" 검색`);

    const fallbackRes = await fetch(fallbackUrl, {
      headers: { Authorization: `Bearer ${API_TOKEN}` },
      signal: AbortSignal.timeout(15_000),
    });

    if (!fallbackRes.ok) {
      const errText = await fallbackRes.text();
      console.error(`[MATCH_CODE] Fallback 조회 실패: ${fallbackRes.status}`);
      return NextResponse.json(
        { success: false, message: "예약 조회 실패" },
        { status: fallbackRes.status },
      );
    }

    const fallbackData = await fallbackRes.json();
    const allResults = fallbackData.response?.results || [];

    // _id 숫자 부분 마지막 6자리 매칭
    const matched = allResults.find((r: any) => {
      const idNumbers = (r._id || "").replace(/\D/g, "");
      return idNumbers.slice(-6) === code;
    });

    if (matched) {
      console.log(`[MATCH_CODE] ✅ Fallback 매칭 성공! _id=${matched._id}, status=${matched.status}`);
      return NextResponse.json({
        success: true,
        reservationId: matched._id,
        reservationCode: matched.Id || code,
        folderId: matched.folder_Id,
        status: matched.status,
        nickname: matched.user_nickname || "",
      });
    }

    console.log(`[MATCH_CODE] ❌ 매칭 실패 — code="${code}" | 검색 대상 ${allResults.length}개 중 일치 없음`);
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
