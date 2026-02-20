import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const API_BASE_URL =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";

export const dynamic = "force-dynamic";

/**
 * Bearer 세척 유틸 (route 내부용)
 */
function sanitizeAuthHeader(rawToken: string): string {
  let pure = rawToken;
  while (/^Bearer\s+/i.test(pure)) {
    pure = pure.replace(/^Bearer\s+/i, "");
  }
  pure = pure.trim();
  return `Bearer ${pure}`;
}

/**
 * 서버 사이드 토큰 갱신 시도
 * getServerSession은 만료된 토큰을 그대로 반환할 수 있으므로,
 * 401 발생 시 직접 refresh 엔드포인트를 호출하여 새 토큰 확보
 */
async function tryRefreshToken(session: any): Promise<string | null> {
  const rawRefresh = session?.refreshToken || (session as any)?.user?.refreshToken;
  if (!rawRefresh) {
    console.log("[FOLDER_REFRESH] ❌ refreshToken 없음 → 갱신 불가");
    return null;
  }

  let cleanRefresh = String(rawRefresh);
  while (/^Bearer\s+/i.test(cleanRefresh)) {
    cleanRefresh = cleanRefresh.replace(/^Bearer\s+/i, "");
  }
  cleanRefresh = cleanRefresh.trim();

  console.log("[FOLDER_REFRESH] 🔄 토큰 갱신 시도...");
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/token/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept-Language": "ko" },
      body: JSON.stringify({ refreshToken: cleanRefresh }),
    });

    if (!res.ok) {
      console.error(`[FOLDER_REFRESH] ❌ 갱신 실패: ${res.status}`);
      return null;
    }

    const authHeader = res.headers.get("authorization") || res.headers.get("Authorization");
    if (authHeader) {
      let newToken = authHeader;
      while (/^Bearer\s+/i.test(newToken)) {
        newToken = newToken.replace(/^Bearer\s+/i, "");
      }
      console.log(`[FOLDER_REFRESH] ✅ 새 토큰 확보 (헤더): ${newToken.substring(0, 20)}...`);
      return newToken;
    }

    const data = await res.json();
    const bodyToken = data.data?.accessToken || data.accessToken || data.data?.access_token || data.access_token;
    if (bodyToken) {
      let clean = String(bodyToken);
      while (/^Bearer\s+/i.test(clean)) {
        clean = clean.replace(/^Bearer\s+/i, "");
      }
      console.log(`[FOLDER_REFRESH] ✅ 새 토큰 확보 (body): ${clean.substring(0, 20)}...`);
      return clean;
    }

    console.error("[FOLDER_REFRESH] ❌ 응답에서 새 토큰을 찾지 못함");
    return null;
  } catch (e) {
    console.error("[FOLDER_REFRESH] ❌ 예외:", e);
    return null;
  }
}

/**
 * POST /api/backend/create-folder
 *
 * Swagger 규격:
 *   POST /api/v1/folders?scheduleId={}&name={}&hostUserId={}&personCount={}
 *   Content-Type: multipart/form-data
 *   Body: photos (빈 값도 가능)
 *
 * ⚠️ 핵심 포인트:
 *   1. 모든 파라미터는 Query String으로 전달 (Body 아님!)
 *   2. Content-Type은 multipart/form-data (fetch가 자동 boundary 생성)
 *   3. 변수명은 scheduleId (tourId 아님!)
 *
 * Body (from frontend): { scheduleId, name, hostUserId, personCount }
 * Returns: { success: boolean, folderId: number, raw: any }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 세션에서 accessToken 추출
    const session = await getServerSession(authOptions);
    const accessToken = (session as any)?.accessToken;

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("[FOLDER_FLOW] 📁 POST /api/backend/create-folder 호출");
    console.log(`[FOLDER_FLOW]   🔑 accessToken 존재: ${!!accessToken}`);
    console.log(
      `[FOLDER_FLOW]   🔑 accessToken 앞 15자: ${
        accessToken ? accessToken.substring(0, 15) + "..." : "N/A"
      }`
    );

    if (!accessToken) {
      console.error("[FOLDER_FLOW] ❌ accessToken 없음 → 401");
      return NextResponse.json(
        { error: "Unauthorized - no access token in session" },
        { status: 401 }
      );
    }

    // 2. 요청 바디 파싱
    const body = await request.json();
    const { scheduleId, name, hostUserId, personCount } = body;

    console.log(`[FOLDER_FLOW]   📅 scheduleId: ${scheduleId}`);
    console.log(`[FOLDER_FLOW]   📛 name: ${name}`);
    console.log(`[FOLDER_FLOW]   👤 hostUserId: ${hostUserId}`);
    console.log(`[FOLDER_FLOW]   👥 personCount: ${personCount}`);

    // 3. Java 백엔드에 POST /api/v1/folders 호출
    //    ⚠️ Swagger 규격: 파라미터는 Query String, Body는 multipart/form-data
    const queryParams = new URLSearchParams();
    if (scheduleId) queryParams.append("scheduleId", String(scheduleId));
    if (name) queryParams.append("name", String(name));
    if (hostUserId) queryParams.append("hostUserId", String(hostUserId));
    if (personCount) queryParams.append("personCount", String(personCount));

    const backendUrl = `${API_BASE_URL}/api/v1/folders?${queryParams.toString()}`;
    console.log(`[FOLDER_FLOW]   📡 최종 요청 URL: ${backendUrl}`);

    // multipart/form-data Body 구성 (photos 필드는 빈값으로)
    const formData = new FormData();
    formData.append("photos", "");

    console.log(`[FOLDER_FLOW]   📤 Content-Type: multipart/form-data (자동 boundary)`);

    // ✅ Bearer 세척: 이중 Bearer 방지 + 양끝 공백 제거
    const finalHeader = sanitizeAuthHeader(accessToken);

    // 백엔드 호출 함수 (재시도 가능하도록 분리)
    async function callBackend(authHeader: string) {
      const fd = new FormData();
      fd.append("photos", "");
      return fetch(backendUrl, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Accept-Language": "ko",
        },
        body: fd,
      });
    }

    // 1차 시도
    let backendRes = await callBackend(finalHeader);

    console.log(
      `[FOLDER_FLOW]   📥 백엔드 응답 status: ${backendRes.status}`
    );

    // 401 발생 시 → 토큰 갱신 후 재시도
    if (backendRes.status === 401) {
      console.warn("[FOLDER_FLOW] ⚠️ 401 INVALID_ACCESS_TOKEN → 토큰 갱신 후 재시도");
      const newPureToken = await tryRefreshToken(session);
      if (newPureToken) {
        const retryHeader = `Bearer ${newPureToken.trim()}`;
        console.log(`[FOLDER_FLOW]   🔄 갱신된 토큰으로 재시도: |${retryHeader.substring(0, 30)}...|`);
        backendRes = await callBackend(retryHeader);
        console.log(`[FOLDER_FLOW]   📥 재시도 응답 status: ${backendRes.status}`);
      } else {
        console.error("[FOLDER_FLOW] ❌ 토큰 갱신 실패 → 재로그인 필요");
        return NextResponse.json(
          {
            error: "인증이 만료되었습니다. 다시 로그인해주세요.",
            code: "AUTH_EXPIRED",
            detail: "토큰 갱신 실패 - refreshToken 없음 또는 만료됨",
          },
          { status: 401 }
        );
      }
    }

    const responseText = await backendRes.text();
    console.log(
      `[FOLDER_FLOW]   📥 백엔드 응답 body (raw): ${responseText.substring(
        0,
        500
      )}`
    );

    if (!backendRes.ok) {
      console.error(
        `[FOLDER_FLOW] ❌ 백엔드 실패 (${backendRes.status}): ${responseText}`
      );

      // 401이 재시도 후에도 발생한 경우 명확한 안내
      if (backendRes.status === 401) {
        return NextResponse.json(
          {
            error: "인증이 만료되었습니다. 다시 로그인해주세요.",
            code: "AUTH_EXPIRED",
            detail: responseText,
          },
          { status: 401 }
        );
      }

      return NextResponse.json(
        {
          error: `Backend returned ${backendRes.status}`,
          detail: responseText,
        },
        { status: backendRes.status }
      );
    }

    // 4. 응답에서 folder_Id 추출
    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = { raw: responseText };
    }

    // 다양한 응답 구조 처리
    const newFolderId =
      parsed.data?.id ||
      parsed.data?.folderId ||
      parsed.data?.folder_Id ||
      parsed.data?.folderId ||
      parsed.id ||
      parsed.folderId ||
      parsed.folder_Id ||
      null;

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`[FOLDER_FLOW] ✅ 새 folderId 추출 결과: ${newFolderId}`);
    console.log(
      `[FOLDER_FLOW]   📦 전체 응답: ${JSON.stringify(parsed).substring(
        0,
        300
      )}`
    );
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return NextResponse.json({
      success: true,
      folderId: newFolderId,
      raw: parsed,
    });
  } catch (error: any) {
    console.error("[FOLDER_FLOW] ❌ create-folder 예외:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create folder" },
      { status: 500 }
    );
  }
}
