import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// S3 Presigned URL의 서명(쿼리 파라미터)을 보존하면서 경로 부분만 수선
// 예: ...thumbnail_123.jpg225316...jpg?X-Amz-Algorithm=... → ...thumbnail_123.jpg?X-Amz-Algorithm=...
function repairUrl(raw: string): string {
  // ? 기준으로 경로와 쿼리 스트링 분리 — 서명 보존 핵심
  const qIdx = raw.indexOf("?");
  const basePath = qIdx >= 0 ? raw.substring(0, qIdx) : raw;
  const queryString = qIdx >= 0 ? raw.substring(qIdx) : "";

  console.log("[DEBUG_PROXY] 🛠️ 수선 전 경로 끝:", basePath.substring(basePath.length - 80));
  if (queryString) {
    console.log("[DEBUG_PROXY] 🔑 쿼리 파라미터 존재 (서명):", queryString.substring(0, 80) + "...");
  }

  // 경로에서만 첫 번째 이미지 확장자 이후의 잔여물 제거
  const cleanPath = basePath.replace(/(\.(jpe?g|png|webp|gif)).*$/i, "$1");
  const finalUrl = cleanPath + queryString;

  if (cleanPath !== basePath) {
    console.log("[DEBUG_PROXY] ✨ 수선 후 경로 끝:", cleanPath.substring(cleanPath.length - 60));
    console.log("[DEBUG_PROXY] 🔧 제거된 부분:", basePath.substring(cleanPath.length));
  } else {
    console.log("[DEBUG_PROXY] ✅ 경로 정상 — 수선 불필요");
  }

  return finalUrl;
}

function buildResponseHeaders(contentType: string): Record<string, string> {
  return {
    "Content-Type": contentType || "image/jpeg",
    "Content-Disposition": "attachment",
    "Last-Modified": new Date().toUTCString(),
    "Cache-Control": "no-cache",
  };
}

// GET /api/download?url=<S3_URL> — 서버 사이드 이미지 프록시
// CORS 우회 + 깨진 URL 자동 수선 + S3 서명 보존 + 메타데이터 현재시각
export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url");

  if (!rawUrl) {
    return NextResponse.json({ error: "url parameter required" }, { status: 400 });
  }

  console.log("[DEBUG_PROXY] 📡 프록시 요청 수신 — URL 길이:", rawUrl.length, "| 앞 120자:", rawUrl.substring(0, 120));

  try {
    const cleanUrl = repairUrl(rawUrl);

    // 1차 시도: 수선된 URL + 서명 보존
    const res = await fetch(cleanUrl, {
      headers: { "Accept": "image/*,*/*" },
    });

    console.log(`[DEBUG_PROXY] 📡 S3 응답 (수선URL): ${res.status} ${res.statusText} | Content-Type: ${res.headers.get("Content-Type")}`);

    if (res.ok) {
      const blob = await res.arrayBuffer();
      console.log("[DEBUG_PROXY] ✅ 다운로드 성공 (수선URL):", (blob.byteLength / 1024).toFixed(0), "KB");
      return new NextResponse(blob, {
        status: 200,
        headers: buildResponseHeaders(res.headers.get("Content-Type") || "image/jpeg"),
      });
    }

    // S3 에러 내용 확인
    let errorDetail = "";
    try { errorDetail = await res.text(); } catch {}
    console.error("[DEBUG_PROXY] ❌ S3 에러 (수선URL):", res.status, errorDetail.substring(0, 200));

    // 2차 시도: 수선 전 원본 URL 그대로 (수선이 실제로 적용된 경우만)
    if (cleanUrl !== rawUrl) {
      console.log("[DEBUG_PROXY] 🔄 수선 URL 실패 → 원본 URL 재시도");
      const retry = await fetch(rawUrl, { headers: { "Accept": "image/*,*/*" } });
      console.log(`[DEBUG_PROXY] 📡 S3 응답 (원본URL): ${retry.status} ${retry.statusText}`);

      if (retry.ok) {
        const blob = await retry.arrayBuffer();
        console.log("[DEBUG_PROXY] ✅ 원본 URL 성공:", (blob.byteLength / 1024).toFixed(0), "KB");
        return new NextResponse(blob, {
          status: 200,
          headers: buildResponseHeaders(retry.headers.get("Content-Type") || "image/jpeg"),
        });
      }

      let retryError = "";
      try { retryError = await retry.text(); } catch {}
      console.error("[DEBUG_PROXY] ❌ S3 에러 (원본URL):", retry.status, retryError.substring(0, 200));
    }

    // 3차 시도: 쿼리 파라미터 없이 순수 경로만 (공개 버킷 가능성)
    const qIdx = rawUrl.indexOf("?");
    if (qIdx >= 0) {
      const pathOnly = rawUrl.substring(0, qIdx).replace(/(\.(jpe?g|png|webp|gif)).*$/i, "$1");
      console.log("[DEBUG_PROXY] 🔄 서명 제거 후 순수 경로 재시도:", pathOnly.substring(pathOnly.length - 60));
      const bare = await fetch(pathOnly, { headers: { "Accept": "image/*,*/*" } });
      console.log(`[DEBUG_PROXY] 📡 S3 응답 (순수경로): ${bare.status} ${bare.statusText}`);

      if (bare.ok) {
        const blob = await bare.arrayBuffer();
        console.log("[DEBUG_PROXY] ✅ 순수 경로 성공:", (blob.byteLength / 1024).toFixed(0), "KB");
        return new NextResponse(blob, {
          status: 200,
          headers: buildResponseHeaders(bare.headers.get("Content-Type") || "image/jpeg"),
        });
      }
    }

    console.error("[DEBUG_PROXY] ❌ 모든 시도(3단계) 실패 — 최종 status:", res.status);
    return NextResponse.json({ error: `S3 ${res.status}` }, { status: res.status });
  } catch (e: any) {
    console.error("[DEBUG_PROXY] ❌ 네트워크/시스템 에러:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
