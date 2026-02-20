import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const API_BASE_URL =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/backend/cancel-folder
 *
 * Swagger 규격:
 *   PATCH /api/v1/folders/{folderId}/status?status=CANCELED
 *
 * Body (from frontend): { folderId: number }
 * Returns: { success: boolean, raw: any }
 */
export async function PATCH(request: NextRequest) {
  try {
    // 1. 세션에서 accessToken 추출
    const session = await getServerSession(authOptions);
    const accessToken = (session as any)?.accessToken;

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("[CANCEL_FOLDER] 📁 PATCH /api/backend/cancel-folder 호출");
    console.log(`[CANCEL_FOLDER]   🔑 accessToken 존재: ${!!accessToken}`);
    console.log(`[CANCEL_FOLDER]   🔑 토큰 시작: ${String(accessToken).substring(0, 15)}...`);

    if (!accessToken) {
      console.error("[CANCEL_FOLDER] ❌ accessToken 없음 → 401");
      return NextResponse.json(
        { error: "Unauthorized - no access token in session" },
        { status: 401 }
      );
    }

    // 2. 요청 바디 파싱
    const body = await request.json();
    const { folderId } = body;

    if (!folderId) {
      return NextResponse.json(
        { error: "folderId is required" },
        { status: 400 }
      );
    }

    // 이중 Bearer 방지: 토큰에 이미 "Bearer "가 있으면 그대로 사용
    const authHeader = String(accessToken).startsWith("Bearer ")
      ? accessToken
      : `Bearer ${accessToken}`;

    const userLan = (session as any)?.user?.lan || "ko";

    console.log(`[CANCEL_FOLDER]   📁 folderId: ${folderId}`);
    console.log(`[CANCEL_FOLDER]   🔑 Auth 헤더: ${String(authHeader).substring(0, 25)}...`);

    // 3. Java 백엔드에 PATCH /api/v1/folders/{folderId}/status?status=CANCELED 호출
    const backendUrl = `${API_BASE_URL}/api/v1/folders/${folderId}/status?status=CANCELED`;
    console.log(`[CANCEL_FOLDER]   📡 최종 요청 URL: ${backendUrl}`);

    const backendRes = await fetch(backendUrl, {
      method: "PATCH",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        "Accept-Language": userLan,
      },
    });

    console.log(
      `[CANCEL_FOLDER]   📥 백엔드 응답 status: ${backendRes.status}`
    );

    const responseText = await backendRes.text();
    console.log(
      `[CANCEL_FOLDER]   📥 백엔드 응답 body: ${responseText.substring(0, 500)}`
    );

    if (!backendRes.ok) {
      console.error(
        `[CANCEL_FOLDER] ❌ 백엔드 실패 (${backendRes.status}): ${responseText}`
      );
      return NextResponse.json(
        {
          error: `Backend returned ${backendRes.status}`,
          detail: responseText,
        },
        { status: backendRes.status }
      );
    }

    // 4. 응답 파싱
    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = { raw: responseText };
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`[CANCEL_FOLDER] ✅ 폴더 취소 성공: folderId=${folderId}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return NextResponse.json({
      success: true,
      raw: parsed,
    });
  } catch (error: any) {
    console.error("[CANCEL_FOLDER] ❌ cancel-folder 예외:", error);
    return NextResponse.json(
      { error: error.message || "Failed to cancel folder" },
      { status: 500 }
    );
  }
}
