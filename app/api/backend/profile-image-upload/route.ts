import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_BASE_URL =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";

/**
 * POST /api/backend/profile-image-upload?userId=123
 * FormData(multipart) 프록시 — 프로필 이미지 업로드
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const targetUrl = `${API_BASE_URL}/api/v1/profile/${userId}/photo`;
    console.log(`[PROFILE_IMAGE_PROXY] POST ${targetUrl}`);

    const authHeader = request.headers.get("authorization") || "";

    const formData = await request.formData();

    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        Authorization: authHeader,
      },
      body: formData,
    });

    console.log(`[PROFILE_IMAGE_PROXY] Status: ${res.status}`);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[PROFILE_IMAGE_PROXY] ❌ HTTP ${res.status}: ${errText.substring(0, 500)}`);
      return NextResponse.json(
        { statusCode: res.status, message: "프로필 사진 업로드에 실패했습니다.", code: "ERROR", data: null },
        { status: res.status }
      );
    }

    const json = await res.json().catch(() => ({
      statusCode: 200,
      message: "프로필 사진 업로드 성공",
      code: "SUCCESS",
      data: null,
    }));

    return NextResponse.json(json);
  } catch (error: any) {
    console.error("[PROFILE_IMAGE_PROXY] ❌ Exception:", error.message);
    return NextResponse.json(
      { statusCode: 500, message: error.message, code: "ERROR", data: null },
      { status: 500 }
    );
  }
}
