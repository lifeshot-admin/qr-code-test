import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 깨진 S3 URL 수선: .jpg 뒤에 붙은 중복 파일명 제거
// 예: thumbnail_123.jpg225316...jpg → thumbnail_123.jpg
function repairUrl(raw: string): string {
  // 패턴 1: .jpg 또는 .jpeg 또는 .png 뒤에 숫자/문자가 더 붙어있는 경우
  const repaired = raw.replace(/(\.(jpe?g|png|webp|gif))[\w%._-]+\.(jpe?g|png|webp|gif)$/i, "$1");

  if (repaired !== raw) {
    console.log("[DL_PROXY] 🔧 URL 수선:", raw.substring(raw.length - 60), "→", repaired.substring(repaired.length - 40));
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

  try {
    const cleanUrl = repairUrl(rawUrl);
    console.log("[DL_PROXY] 📡 다운로드 요청:", cleanUrl.substring(0, 120) + "...");

    const res = await fetch(cleanUrl, {
      headers: { "Accept": "image/*,*/*" },
    });

    if (!res.ok) {
      // 수선된 URL도 실패하면 원본 URL로 재시도
      if (cleanUrl !== rawUrl) {
        console.log("[DL_PROXY] 🔄 수선 URL 실패 → 원본 URL 재시도");
        const retry = await fetch(rawUrl, { headers: { "Accept": "image/*,*/*" } });
        if (retry.ok) {
          const blob = await retry.arrayBuffer();
          return new NextResponse(blob, {
            status: 200,
            headers: {
              "Content-Type": retry.headers.get("Content-Type") || "image/jpeg",
              "Content-Disposition": "attachment",
              "Cache-Control": "public, max-age=86400",
            },
          });
        }
      }

      console.error("[DL_PROXY] ❌ S3 응답 실패:", res.status, cleanUrl.substring(0, 80));
      return NextResponse.json({ error: `S3 ${res.status}` }, { status: res.status });
    }

    const blob = await res.arrayBuffer();
    console.log("[DL_PROXY] ✅ 다운로드 성공:", (blob.byteLength / 1024).toFixed(0), "KB");

    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "image/jpeg",
        "Content-Disposition": "attachment",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e: any) {
    console.error("[DL_PROXY] ❌ 에러:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
