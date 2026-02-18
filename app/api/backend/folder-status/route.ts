import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const API_BASE_URL =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";

export const dynamic = "force-dynamic";

function sanitizeAuthHeader(rawToken: string): string {
  let pure = rawToken;
  while (/^Bearer\s+/i.test(pure)) {
    pure = pure.replace(/^Bearer\s+/i, "");
  }
  return `Bearer ${pure.trim()}`;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    let pure = token;
    while (/^Bearer\s+/i.test(pure)) pure = pure.replace(/^Bearer\s+/i, "");
    const parts = pure.trim().split(".");
    if (parts.length < 2) return null;
    const payload = Buffer.from(parts[1], "base64").toString("utf-8");
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/**
 * PATCH /api/backend/folder-status
 *
 * 자바 백엔드 PATCH /api/v1/folders/{folderId}/status?status=XXX 프록시
 * ⚠️ Swagger 명세: status는 Query Parameter (Body가 아님)
 *
 * Body (프론트엔드 → 이 프록시):
 *   { folderId: number, status: "RESERVED" | "PENDING" | "COMPLETED" }
 *
 * 변환 후 자바 서버 호출:
 *   PATCH /api/v1/folders/{folderId}/status?status=RESERVED
 *   (Body 없이 Query Parameter로 전달)
 *
 * 필요 권한: SUPER_ADMIN, ADMIN, MANAGER, SNAP
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const accessToken = (session as any)?.accessToken;
    const userLan = (session as any)?.user?.lan || "ko";
    const userRole = (session as any)?.user?.role || "UNKNOWN";
    const userEmail = (session as any)?.user?.email || "UNKNOWN";

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { folderId, status: targetStatus } = body;

    if (!folderId || !targetStatus) {
      return NextResponse.json(
        { success: false, error: "folderId and status are required" },
        { status: 400 },
      );
    }

    const authHeader = sanitizeAuthHeader(accessToken);

    // JWT 페이로드에서 권한 정보 추출 (백로그용)
    const jwtPayload = decodeJwtPayload(accessToken);
    const jwtRole = jwtPayload?.role || jwtPayload?.authorities || jwtPayload?.auth || "NOT_FOUND_IN_JWT";
    const jwtSub = jwtPayload?.sub || jwtPayload?.userId || "UNKNOWN";

    // ⚠️ 핵심: Query Parameter 방식으로 URL 구성 (Swagger 명세 준수)
    const url = new URL(`${API_BASE_URL}/api/v1/folders/${folderId}/status`);
    url.searchParams.append("status", targetStatus);


    let res = await fetch(url.toString(), {
      method: "PATCH",
      headers: {
        Authorization: authHeader,
        "Accept-Language": userLan,
      },
      cache: "no-store",
    });

    // 401 발생 시 → 토큰 갱신 후 재시도
    if (res.status === 401) {
      console.warn("[FOLDER_STATUS] ⚠️ 401 → 토큰 갱신 시도...");
      const rawRefresh = (session as any)?.refreshToken;
      if (rawRefresh) {
        let cleanRefresh = String(rawRefresh);
        while (/^Bearer\s+/i.test(cleanRefresh)) cleanRefresh = cleanRefresh.replace(/^Bearer\s+/i, "");
        cleanRefresh = cleanRefresh.trim();
        try {
          const refreshRes = await fetch(`${API_BASE_URL}/api/v1/auth/token/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept-Language": "ko" },
            body: JSON.stringify({ refreshToken: cleanRefresh }),
          });
          if (refreshRes.ok) {
            const newAuthH = refreshRes.headers.get("authorization") || refreshRes.headers.get("Authorization");
            let newPure: string | null = null;
            if (newAuthH) { newPure = newAuthH; while (/^Bearer\s+/i.test(newPure!)) newPure = newPure!.replace(/^Bearer\s+/i, ""); newPure = newPure!.trim(); }
            if (!newPure) {
              const rd = await refreshRes.json();
              const bt = rd.data?.accessToken || rd.accessToken || rd.data?.access_token;
              if (bt) { newPure = String(bt); while (/^Bearer\s+/i.test(newPure!)) newPure = newPure!.replace(/^Bearer\s+/i, ""); newPure = newPure!.trim(); }
            }
            if (newPure) {
              console.log("[FOLDER_STATUS] 🔄 갱신 성공 → 재시도");
              res = await fetch(url.toString(), {
                method: "PATCH",
                headers: { Authorization: `Bearer ${newPure}`, "Accept-Language": userLan },
                cache: "no-store",
              });
            }
          }
        } catch (e) {
          console.error("[FOLDER_STATUS] 토큰 갱신 실패:", e);
        }
      }
    }

    const text = await res.text();

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { rawBody: text.substring(0, 500) };
    }

    const serverMessage = parsed?.message || parsed?.error || text.substring(0, 200);

    if (!res.ok) {
      // 상세 판정 로그
      let verdict = "UNKNOWN";
      if (res.status === 400) verdict = "규격 오류 (파라미터 누락 또는 값 오류)";
      else if (res.status === 401) verdict = "인증 실패 (토큰 만료 또는 무효)";
      else if (res.status === 403) verdict = "권한 부족 (DENIED) — SUPER_ADMIN/ADMIN/MANAGER/SNAP 필요";
      else if (res.status === 404) verdict = "폴더를 찾을 수 없음";
      else if (res.status >= 500) verdict = "서버 내부 오류";

      console.error(`[FOLDER_STATUS_FAIL] ========================================`);
      console.error(`[FOLDER_STATUS_FAIL]   HTTP Status: ${res.status}`);
      console.error(`[FOLDER_STATUS_FAIL]   서버 메시지: ${serverMessage}`);
      console.error(`[FOLDER_STATUS_FAIL]   판정: ${verdict}`);
      console.error(`[FOLDER_STATUS_FAIL]   folderId: ${folderId}`);
      console.error(`[FOLDER_STATUS_FAIL]   targetStatus: ${targetStatus}`);
      console.error(`[FOLDER_STATUS_FAIL]   JWT Role: ${JSON.stringify(jwtRole)}`);
      console.error(`[FOLDER_STATUS_FAIL]   응답 전문: ${text.substring(0, 500)}`);
      console.error(`[FOLDER_STATUS_FAIL] ========================================`);

      return NextResponse.json(
        {
          success: false,
          error: `Status change failed: HTTP ${res.status}`,
          httpStatus: res.status,
          serverMessage,
          verdict,
          detail: text.substring(0, 500),
          jwtRole: String(jwtRole),
        },
        { status: res.status },
      );
    }

    console.log(`[FOLDER_STATUS] ✅ 성공: folderId=${folderId} → ${targetStatus}`);
    console.log(`[FOLDER_STATUS]   응답: ${text.substring(0, 300)}`);

    return NextResponse.json({
      success: true,
      folderId,
      status: targetStatus,
      data: parsed.data || parsed,
    });
  } catch (e: any) {
    console.error("[FOLDER_STATUS] 예외:", e.message);
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 },
    );
  }
}
