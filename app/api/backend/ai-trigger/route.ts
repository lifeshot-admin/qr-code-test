import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { triggerAiJob } from "@/lib/bubble";

/**
 * POST /api/backend/ai-trigger
 *
 * [Step 3] Bubble trigger-ai 워크플로우 호출 프록시
 * Step 2(사진 업로드) 완료 직후 호출
 *
 * Body:
 *   folderId - (number) Step 1에서 생성된 AI 폴더 ID
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const rawToken = (session as any)?.accessToken || "";

    if (!rawToken) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    // Bearer 제거 → 순수 JWT만 Bubble에 전달
    let pureToken = rawToken;
    while (/^Bearer\s+/i.test(pureToken)) {
      pureToken = pureToken.replace(/^Bearer\s+/i, "");
    }
    pureToken = pureToken.trim();

    const body = await req.json();
    const folderId = Number(body.folderId);

    if (!folderId) {
      return NextResponse.json(
        { success: false, error: "folderId is required" },
        { status: 400 },
      );
    }

    console.log(`[AI_TRIGGER] Step 3 — folderId: ${folderId}`);

    const result = await triggerAiJob(pureToken, folderId);

    if (!result.success) {
      console.error("[AI_TRIGGER] 실패:", result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 502 },
      );
    }

    console.log(`[AI_TRIGGER] 성공 → jobId: ${result.jobId}`);

    return NextResponse.json({
      success: true,
      jobId: result.jobId,
    });
  } catch (e: any) {
    console.error("[AI_TRIGGER] 에러:", e.message);
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 },
    );
  }
}
