/**
 * Bubble Backend Workflow 호출 유틸리티
 *
 * API 형식: POST https://{domain}[/version-test]/api/1.1/wf/{workflow_name}
 * 인증: Authorization: Bearer {BUBBLE_API_TOKEN}
 *
 * ⚠️ 기존 lib/bubble-api.ts (Data API CRUD)와 구분됨
 */

const BUBBLE_BASE = process.env.BUBBLE_API_BASE_URL || "https://lifeshot.me";
const BUBBLE_TOKEN = process.env.BUBBLE_API_TOKEN || "";
const USE_VERSION_TEST =
  process.env.BUBBLE_USE_VERSION_TEST === "true" ||
  process.env.BUBBLE_USE_VERSION_TEST === "1";

function getWorkflowBaseUrl(): string {
  const host = BUBBLE_BASE.replace(/\/$/, "");
  const versionPath = USE_VERSION_TEST ? "/version-test" : "";
  return `${host}${versionPath}/api/1.1/wf`;
}

/**
 * 범용 Bubble Backend Workflow 호출
 */
export async function triggerBubbleWorkflow(
  workflowName: string,
  body: Record<string, unknown> = {},
  options?: { timeout?: number },
): Promise<{ success: boolean; data?: any; error?: string }> {
  const url = `${getWorkflowBaseUrl()}/${workflowName}`;
  const timeout = options?.timeout || 30_000;

  console.log(`[BUBBLE_WF] ${workflowName} 호출 → ${url}`);

  if (!BUBBLE_TOKEN) {
    console.error("[BUBBLE_WF] BUBBLE_API_TOKEN 미설정");
    return { success: false, error: "BUBBLE_API_TOKEN not configured" };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BUBBLE_TOKEN}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(timeout),
    });

    const text = await res.text();
    console.log(`[BUBBLE_WF] ${workflowName} 응답: ${res.status}`);

    if (!res.ok) {
      console.error(`[BUBBLE_WF] ${workflowName} 실패: ${text.substring(0, 300)}`);
      return {
        success: false,
        error: `Workflow "${workflowName}" failed: HTTP ${res.status}`,
      };
    }

    let parsed: any;
    try { parsed = JSON.parse(text); } catch { parsed = text; }

    return { success: true, data: parsed };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[BUBBLE_WF] ${workflowName} 에러: ${msg}`);
    return { success: false, error: msg };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// [Step 1] AI 전용 폴더 생성 — create-folder
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type CreateAiFolderParams = {
  token: string;        // Java Backend Access Token (Bearer 제외 순수 값)
  scheduleId: number;   // 촬영 예약 고유 번호
  hostUserId: number;   // 예약자 고유 ID
  name: string;         // "[AI] " + 현재 폴더명
  personCount: number;  // 사진 속 인원수
  credit: string;       // "true" | "false" — false: 결제대기 없이 즉시 RESERVED
};

/**
 * [Step 1] AI 보정 전용 폴더 생성
 *
 * Endpoint: POST .../wf/create-folder
 * Success: { "status": "success", "response": { "folderId": 11477 } }
 */
export async function createAiFolder(
  params: CreateAiFolderParams,
): Promise<{ success: boolean; folderId?: number; error?: string }> {
  const result = await triggerBubbleWorkflow("create-folder", {
    token: params.token,
    scheduleId: params.scheduleId,
    hostUserId: params.hostUserId,
    name: params.name,
    personCount: params.personCount,
    credit: params.credit,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  const folderId =
    result.data?.response?.folderId ||
    result.data?.folderId ||
    result.data?.response?.folder_id;

  console.log(`[BUBBLE_WF] create-folder 결과 → folderId: ${folderId}`);

  if (!folderId) {
    return { success: false, error: "folderId를 받지 못했습니다." };
  }

  return { success: true, folderId: Number(folderId) };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// [Step 3] AI 보정 Job 트리거 — trigger-ai
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * [Step 3] AI 보정 Job 시작
 *
 * Endpoint: POST .../wf/trigger-ai
 * Condition: Step 2(사진 업로드)가 모두 완료된 직후 호출
 * Success: { "status": "success", "response": { "status": "Success", "jobId": 140 } }
 */
export async function triggerAiJob(
  token: string,
  folderId: number,
): Promise<{ success: boolean; jobId?: number; error?: string }> {
  const result = await triggerBubbleWorkflow("trigger-ai", {
    token,
    folderId,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  const jobId =
    result.data?.response?.jobId ||
    result.data?.jobId ||
    result.data?.response?.job_id;

  const jobStatus =
    result.data?.response?.status || result.data?.status || "unknown";

  console.log(`[BUBBLE_WF] trigger-ai 결과 → jobId: ${jobId}, status: ${jobStatus}`);

  return {
    success: true,
    jobId: jobId ? Number(jobId) : undefined,
  };
}
