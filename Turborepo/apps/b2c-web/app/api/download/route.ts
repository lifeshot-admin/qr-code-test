import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export const dynamic = "force-dynamic";

// S3 Presigned URL의 서명(쿼리 파라미터)을 보존하면서 경로 부분만 수선
function repairUrl(raw: string): string {
  const qIdx = raw.indexOf("?");
  const basePath = qIdx >= 0 ? raw.substring(0, qIdx) : raw;
  const queryString = qIdx >= 0 ? raw.substring(qIdx) : "";

  console.log("[DEBUG_PROXY] 🛠️ 수선 전 경로 끝:", basePath.substring(basePath.length - 80));
  if (queryString) {
    console.log("[DEBUG_PROXY] 🔑 쿼리 파라미터 존재 (서명):", queryString.substring(0, 80) + "...");
  }

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

// EXIF DateTime 포맷: "YYYY:MM:DD HH:MM:SS"
function exifDateNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}:${pad(d.getMonth() + 1)}:${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// sharp로 EXIF 완전 교체: 기존 메타데이터 전부 삭제 → 현재 날짜만 주입
// IFD0: 메인 이미지 태그 (DateTime)
// IFD2: EXIF sub-IFD (DateTimeOriginal, DateTimeDigitized)
async function processImage(buffer: ArrayBuffer): Promise<Buffer> {
  const now = exifDateNow();
  console.log("[DEBUG_PROXY] 🧹 EXIF 세탁 시작 — 주입할 날짜:", now);

  try {
    const input = Buffer.from(buffer);

    // withExif: 기존 EXIF를 완전히 덮어쓰고 우리가 지정한 필드만 남김
    const processed = await sharp(input)
      .withExif({
        IFD0: {
          DateTime: now,
        },
        IFD2: {
          DateTimeOriginal: now,
          DateTimeDigitized: now,
        },
      })
      .jpeg({ quality: 95 })
      .toBuffer();

    console.log("[DEBUG_PROXY] ✅ EXIF 세탁 완료 — 원본:", (input.length / 1024).toFixed(0), "KB → 처리:", (processed.length / 1024).toFixed(0), "KB");
    return processed;
  } catch (e: any) {
    console.warn("[DEBUG_PROXY] ⚠️ sharp 처리 실패 (원본 반환):", e.message);
    return Buffer.from(buffer);
  }
}

function buildResponseHeaders(): Record<string, string> {
  return {
    "Content-Type": "image/jpeg",
    "Content-Disposition": "attachment",
    "Last-Modified": new Date().toUTCString(),
    "Cache-Control": "no-cache",
  };
}

// S3에서 이미지 fetch → sharp로 EXIF 세탁 → 브라우저로 전달
async function fetchAndProcess(url: string, label: string): Promise<NextResponse | null> {
  try {
    const res = await fetch(url, { headers: { "Accept": "image/*,*/*" } });
    console.log(`[DEBUG_PROXY] 📡 S3 응답 (${label}): ${res.status} ${res.statusText} | Content-Type: ${res.headers.get("Content-Type")}`);

    if (!res.ok) {
      let errText = "";
      try { errText = await res.text(); } catch {}
      console.error(`[DEBUG_PROXY] ❌ S3 에러 (${label}):`, res.status, errText.substring(0, 200));
      return null;
    }

    const raw = await res.arrayBuffer();
    console.log(`[DEBUG_PROXY] ✅ 다운로드 성공 (${label}):`, (raw.byteLength / 1024).toFixed(0), "KB");

    const contentType = res.headers.get("Content-Type") || "";
    const isImage = contentType.includes("image") || url.match(/\.(jpe?g|png|webp|gif)/i);

    // 이미지일 때만 sharp로 EXIF 세탁, 아니면 원본 그대로 전달
    if (isImage) {
      const processed = await processImage(raw);
      return new NextResponse(processed, { status: 200, headers: buildResponseHeaders() });
    }

    return new NextResponse(raw, { status: 200, headers: buildResponseHeaders() });
  } catch {
    return null;
  }
}

// GET /api/download?url=<S3_URL>
// CORS 우회 + 깨진 URL 수선 + S3 서명 보존 + EXIF 세탁 + 메타데이터 현재시각
export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url");

  if (!rawUrl) {
    return NextResponse.json({ error: "url parameter required" }, { status: 400 });
  }

  console.log("[DEBUG_PROXY] 📡 프록시 요청 수신 — URL 길이:", rawUrl.length, "| 앞 120자:", rawUrl.substring(0, 120));

  try {
    const cleanUrl = repairUrl(rawUrl);

    // 1차: 수선된 URL + 서명 보존
    const r1 = await fetchAndProcess(cleanUrl, "수선URL");
    if (r1) return r1;

    // 2차: 원본 URL 그대로
    if (cleanUrl !== rawUrl) {
      console.log("[DEBUG_PROXY] 🔄 수선 URL 실패 → 원본 URL 재시도");
      const r2 = await fetchAndProcess(rawUrl, "원본URL");
      if (r2) return r2;
    }

    // 3차: 쿼리 파라미터 없이 순수 경로만
    const qIdx = rawUrl.indexOf("?");
    if (qIdx >= 0) {
      const pathOnly = rawUrl.substring(0, qIdx).replace(/(\.(jpe?g|png|webp|gif)).*$/i, "$1");
      console.log("[DEBUG_PROXY] 🔄 서명 제거 후 순수 경로 재시도");
      const r3 = await fetchAndProcess(pathOnly, "순수경로");
      if (r3) return r3;
    }

    console.error("[DEBUG_PROXY] ❌ 모든 시도(3단계) 실패");
    return NextResponse.json({ error: "All download attempts failed" }, { status: 502 });
  } catch (e: any) {
    console.error("[DEBUG_PROXY] ❌ 네트워크/시스템 에러:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
