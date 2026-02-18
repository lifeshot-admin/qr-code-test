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
  pure = pure.trim();
  return `Bearer ${pure}`;
}

/**
 * PATCH /api/backend/user/profile-image
 * 프로필 이미지 변경
 * Body: multipart/form-data (profileImage 필드)
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const accessToken = (session as any)?.accessToken;
    const userId = (session as any)?.user?.id;

    if (!accessToken || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authHeader = sanitizeAuthHeader(accessToken);
    const incomingFormData = await request.formData();

    console.log("[USER_API] PATCH /api/backend/user/profile-image");
    console.log(`[USER_API]   userId: ${userId}`);

    // ✅ FormData 필드명 정합성: 프론트에서 "file"로 올 수도 있고 "profileImage"로 올 수도 있음
    // 백엔드 명세에 따라 올바른 필드명으로 재조립
    const backendFormData = new FormData();
    const file = incomingFormData.get("file") || incomingFormData.get("profileImage");
    if (file) {
      backendFormData.append("file", file);
      console.log(`[USER_API]   파일 감지: ${(file as File).name || "blob"}`);
    } else {
      console.warn("[USER_API]   ⚠️ FormData에서 파일을 찾을 수 없음!");
    }

    const backendRes = await fetch(
      `${API_BASE_URL}/api/v1/user/profile-image`,
      {
        method: "PATCH",
        headers: {
          Authorization: authHeader,
          "Accept-Language": "ko",
        },
        body: backendFormData,
      }
    );

    const text = await backendRes.text();
    console.log(`[USER_API]   이미지 업로드 응답: ${backendRes.status} ${text.substring(0, 300)}`);

    if (!backendRes.ok) {
      return NextResponse.json(
        { error: "이미지 업로드 실패", detail: text },
        { status: backendRes.status }
      );
    }

    let parsed: any;
    try { parsed = JSON.parse(text); } catch { parsed = {}; }

    return NextResponse.json({
      success: true,
      imageUrl: parsed.data?.profileImageUrl || parsed.profileImageUrl || parsed.data?.imageUrl || null,
    });
  } catch (error: any) {
    console.error("[USER_API] 이미지 업로드 예외:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
