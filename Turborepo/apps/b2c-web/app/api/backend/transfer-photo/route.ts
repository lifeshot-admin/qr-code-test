import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const API_BASE =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";

/**
 * POST /api/backend/transfer-photo
 *
 * 사진 1장을 소스 URL에서 다운로드 → 대상 AI 폴더에 업로드
 * 프론트엔드에서 순차적으로 1장씩 호출하여 메모리 과부하 방지
 *
 * Body:
 *   sourceOriginalUrl  - 원본 사진 URL
 *   targetFolderId     - 업로드 대상 AI 폴더 ID
 *   photoId            - 원본 사진 ID (참조용)
 *
 * 썸네일은 자바 서버가 자동 생성 — 전송 불필요
 * FormData key = "photos" (자바 명세: MultipartFile[] photos)
 */
export async function POST(req: NextRequest) {
  try {
    // ━━━ 인증: 세션 OR Bearer 토큰 (버블 워크플로우 호출 대비) ━━━
    let token = "";
    let userLan = "ko";
    const externalAuth = req.headers.get("authorization");

    if (externalAuth) {
      let pure = externalAuth;
      while (/^Bearer\s+/i.test(pure)) pure = pure.replace(/^Bearer\s+/i, "");
      token = pure.trim();
    } else {
      const session = await getServerSession(authOptions);
      token = (session as any)?.accessToken || "";
      userLan = (session as any)?.user?.lan || "ko";
    }

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    // 순수 토큰에서 Bearer 중복 방지
    let pureToken = token;
    while (/^Bearer\s+/i.test(pureToken)) pureToken = pureToken.replace(/^Bearer\s+/i, "");
    pureToken = pureToken.trim();

    console.log(`[TRANSFER] 토큰 상태 — 길이: ${pureToken.length}, 접두사: ${pureToken.substring(0, 10)}...`);
    console.log(`[TRANSFER] Accept-Language: ${userLan}`);

    const body = await req.json();
    const { sourceOriginalUrl, targetFolderId, photoId } = body;

    if (!sourceOriginalUrl || !targetFolderId) {
      return NextResponse.json(
        {
          success: false,
          error: "sourceOriginalUrl and targetFolderId are required",
        },
        { status: 400 },
      );
    }

    console.log(
      `[TRANSFER] 사진 전송 시작 — photoId: ${photoId}, target: ${targetFolderId}, srcUrl: ${sourceOriginalUrl.substring(0, 80)}...`,
    );

    // ━━━ Step 1: 원본 사진 다운로드 (타임아웃 60초) ━━━
    const originalBlob = await downloadAsBlob(sourceOriginalUrl, 60_000);
    if (!originalBlob) {
      return NextResponse.json(
        { success: false, error: `원본 사진 다운로드 실패 (URL: ${sourceOriginalUrl.substring(0, 100)})` },
        { status: 502 },
      );
    }
    if (originalBlob.size < 100) {
      console.warn(`[TRANSFER] 원본 크기가 비정상적으로 작음: ${originalBlob.size}bytes — 빈 파일일 수 있음`);
    }
    console.log(
      `[TRANSFER] 원본 OK — ${(originalBlob.size / 1024).toFixed(1)}KB, type: ${originalBlob.type}`,
    );

    // 썸네일은 자바 서버가 자동 생성 — 다운로드/전송 불필요

    // ━━━ Step 2: 백엔드 폴더에 업로드 (file 키 하나만) ━━━
    const bearerToken = `Bearer ${pureToken}`;


    let uploadResult = await uploadToFolder(
      bearerToken,
      targetFolderId,
      originalBlob,
      photoId,
      userLan,
    );

    // 401 발생 시 → 토큰 갱신 후 재시도
    if (!uploadResult.success && uploadResult.error?.includes("401")) {
      console.warn("[TRANSFER] ⚠️ 401 감지 → 토큰 갱신 시도...");
      const session = externalAuth ? null : await getServerSession(authOptions);
      const rawRefresh = (session as any)?.refreshToken;
      if (rawRefresh) {
        let cleanRefresh = String(rawRefresh);
        while (/^Bearer\s+/i.test(cleanRefresh)) cleanRefresh = cleanRefresh.replace(/^Bearer\s+/i, "");
        cleanRefresh = cleanRefresh.trim();
        try {
          const refreshRes = await fetch(`${API_BASE}/api/v1/auth/token/refresh`, {
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
              const bt = rd.data?.accessToken || rd.accessToken;
              if (bt) { newPure = String(bt); while (/^Bearer\s+/i.test(newPure!)) newPure = newPure!.replace(/^Bearer\s+/i, ""); newPure = newPure!.trim(); }
            }
            if (newPure) {
              console.log("[TRANSFER] 🔄 갱신 성공 → 재시도");
              uploadResult = await uploadToFolder(`Bearer ${newPure}`, targetFolderId, originalBlob, photoId, userLan);
            }
          }
        } catch (e) {
          console.error("[TRANSFER] 토큰 갱신 실패:", e);
        }
      }
    }

    if (!uploadResult.success) {
      return NextResponse.json(
        { success: false, error: uploadResult.error },
        { status: 502 },
      );
    }

    console.log(`[TRANSFER] 전송 완료 — photoId: ${photoId}`);

    return NextResponse.json({
      success: true,
      photoId,
      uploadedId: uploadResult.uploadedId,
    });
  } catch (e: any) {
    console.error("[TRANSFER] 에러:", e.message);
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 },
    );
  }
}

// ━━━ 사진 다운로드 (커스텀 타임아웃) ━━━
async function downloadAsBlob(url: string, timeoutMs = 30_000): Promise<Blob | null> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      console.error(`[TRANSFER] 다운로드 실패: HTTP ${res.status} — URL: ${url.substring(0, 100)}`);
      return null;
    }
    return await res.blob();
  } catch (e: any) {
    console.error(`[TRANSFER] 다운로드 에러: ${e.message} — URL: ${url.substring(0, 100)}`);
    return null;
  }
}

// ━━━ 백엔드 폴더에 업로드 (FormData: photos 키) ━━━
async function uploadToFolder(
  bearerToken: string,
  folderId: number,
  originalBlob: Blob,
  photoId?: number,
  userLan = "ko",
): Promise<{ success: boolean; uploadedId?: number; error?: string }> {
  try {
    const formData = new FormData();

    // ⚠️ Multipart key = "photos" (자바 백엔드 명세: array of MultipartFile)
    // 단일 전송이지만 서버가 배열로 인식하므로 key를 "photos"로 설정
    const fileName = `photo_${photoId || "unknown"}.jpg`;
    const mimeType = originalBlob.type || "image/jpeg";
    const file = new File([originalBlob], fileName, { type: mimeType });
    formData.append("photos", file);

    const uploadUrl = `${API_BASE}/api/v1/folders/${folderId}/photos`;
    console.log(`[TRANSFER] 업로드 → ${uploadUrl}`);
    console.log(`[TRANSFER]   FormData: key="photos" (array 규격)`);
    console.log(`[TRANSFER]   fileName="${fileName}", mime="${mimeType}", size=${originalBlob.size}bytes`);
    console.log(`[TRANSFER]   targetFolderId: ${folderId}`);
    console.log(`[TRANSFER]   Content-Type: 자동 생성 (boundary 포함) — 수동 설정 금지`);

    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        // ❌ Content-Type 절대 수동 설정 금지! (boundary 파손 원인)
        Authorization: bearerToken,
        Accept: "application/json",
        "Accept-Language": userLan,
      },
      body: formData,
      signal: AbortSignal.timeout(60_000),
    });

    const text = await res.text();
    console.log(`[TRANSFER] 업로드 응답: ${res.status} — body: ${text.substring(0, 300)}`);

    if (!res.ok) {
      console.error(`[TRANSFER] 업로드 실패 상세 — status: ${res.status}, folderId: ${folderId}, photoId: ${photoId}`);
      return {
        success: false,
        error: `Upload failed: HTTP ${res.status} — ${text.substring(0, 200)}`,
      };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {};
    }

    return {
      success: true,
      uploadedId:
        parsed.data?.id || parsed.id || parsed.data?.photoId || undefined,
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
