import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 깨진 S3 URL 수선: .jpg 뒤에 붙은 중복 파일명 제거
// 예: thumbnail_123.jpg225316...jpg → thumbnail_123.jpg
function repairUrl(raw: string): string {
  console.log("[DEBUG_PROXY] 🛠️ 수선 전 URL:", raw.substring(raw.length - 80));

  // 패턴: 첫 번째 이미지 확장자 이후의 모든 잔여물 제거
  const repaired = raw.replace(/(\.(jpe?g|png|webp|gif)).*$/i, "$1");

  if (repaired !== raw) {
    console.log("[DEBUG_PROXY] ✨ 수선 후 URL:", repaired.substring(repaired.length - 60));
    console.log("[DEBUG_PROXY] 🔧 제거된 부분:", raw.substring(repaired.length));
  } else {
    console.log("[DEBUG_PROXY] ✅ URL 정상 — 수선 불필요");
  }

  return repaired;
}

// GET /api/download?url=<S3_URL> — 서버 사이드 이미지 프록시
// CORS 우회 + 깨진 URL 자동 수선
export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url");

  if (!rawUrl) {
    return NextResponse.json({ error: "url parameter required" }, { status: 400 });
  }

  console.log("[DEBUG_PROXY] 📡 프록시 요청 수신 — 원본 URL 길이:", rawUrl.length, "| 앞 120자:", rawUrl.substring(0, 120));

  try {
    const cleanUrl = repairUrl(rawUrl);

    const res = await fetch(cleanUrl, {
      headers: { "Accept": "image/*,*/*" },
    });

    console.log(`[DEBUG_PROXY] 📡 S3 응답 (수선URL): ${res.status} ${res.statusText} | Content-Type: ${res.headers.get("Content-Type")}`);

    if (!res.ok) {
      // S3 에러 내용 확인
      let errorDetail = "";
      try { errorDetail = await res.text(); } catch {}
      console.error("[DEBUG_PROXY] ❌ S3 에러 내용 (수선URL):", errorDetail.substring(0, 200));

      // 수선된 URL도 실패하면 원본 URL로 재시도
      if (cleanUrl !== rawUrl) {
        console.log("[DEBUG_PROXY] 🔄 수선 URL 실패 → 원본 URL 재시도");
        const retry = await fetch(rawUrl, { headers: { "Accept": "image/*,*/*" } });
        console.log(`[DEBUG_PROXY] 📡 S3 응답 (원본URL): ${retry.status} ${retry.statusText}`);

        if (retry.ok) {
          const blob = await retry.arrayBuffer();
          console.log("[DEBUG_PROXY] ✅ 원본 URL 성공:", (blob.byteLength / 1024).toFixed(0), "KB");
          return new NextResponse(blob, {
            status: 200,
            headers: {
              "Content-Type": retry.headers.get("Content-Type") || "image/jpeg",
              "Content-Disposition": "attachment",
              "Cache-Control": "public, max-age=86400",
            },
          });
        }

        let retryError = "";
        try { retryError = await retry.text(); } catch {}
        console.error("[DEBUG_PROXY] ❌ S3 에러 내용 (원본URL):", retryError.substring(0, 200));
      }

      console.error("[DEBUG_PROXY] ❌ 모든 시도 실패 — 최종 status:", res.status);
      return NextResponse.json({ error: `S3 ${res.status}` }, { status: res.status });
    }

    const blob = await res.arrayBuffer();
    console.log("[DEBUG_PROXY] ✅ 다운로드 성공:", (blob.byteLength / 1024).toFixed(0), "KB | Content-Type:", res.headers.get("Content-Type"));

    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "image/jpeg",
        "Content-Disposition": "attachment",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e: any) {
    console.error("[DEBUG_PROXY] ❌ 네트워크/시스템 에러:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
