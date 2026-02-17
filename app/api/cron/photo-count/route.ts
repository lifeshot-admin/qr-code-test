import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/photo-count?date=2026-02-14
 *
 * 사진 장수 집계 → Bubble tour_photo_count에 POST
 *
 * 로직:
 * 1. Java API: GET /api/v1/folders → 해당 날짜 폴더 목록
 * 2. status=COMPLETED 필터링
 * 3. 각 폴더: GET /api/v1/folders/{id}/photos?photoType=RAW → totalElements 집계
 * 4. scheduleId별 합산
 * 5. Bubble: POST /tour_photo_count → 신규 레코드 생성
 */

// ─── 환경변수 ───
const JAVA_API = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";
const BUBBLE_BASE = (process.env.BUBBLE_API_BASE_URL || "https://lifeshot.me").replace(/\/$/, "");
const BUBBLE_TOKEN = process.env.BUBBLE_API_TOKEN || "";
const USE_VERSION_TEST =
  process.env.BUBBLE_USE_VERSION_TEST === "true" || process.env.BUBBLE_USE_VERSION_TEST === "1";
const MASTER_TOKEN = process.env.ADMIN_MASTER_TOKEN || "";

function bubbleObjUrl(): string {
  const vp = USE_VERSION_TEST ? "/version-test" : "";
  return `${BUBBLE_BASE}${vp}/api/1.1/obj`;
}

export async function GET(req: NextRequest) {
  // ─── 인증 (선택) ───
  const cronSecret = process.env.CRON_SECRET || "";
  if (cronSecret) {
    const auth = req.headers.get("authorization") || "";
    const secretParam = req.nextUrl.searchParams.get("secret") || "";
    if (auth !== `Bearer ${cronSecret}` && secretParam !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // ─── 대상 날짜 ───
  const dateParam = req.nextUrl.searchParams.get("date");
  const targetDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : (() => { const d = new Date(); d.setDate(d.getDate() - 2); return d.toISOString().split("T")[0]; })();

  // tour_Id 매핑 (쿼리 파라미터로 전달 가능, 기본 29)
  const tourIdParam = req.nextUrl.searchParams.get("tourId") || "29";

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("[PhotoCount] 📊 집계 시작");
  console.log(`[PhotoCount] 📅 대상 날짜: ${targetDate}`);
  console.log(`[PhotoCount] 🎯 tour_Id: ${tourIdParam}`);
  console.log(`[PhotoCount] 🔗 Java API: ${JAVA_API}`);
  console.log(`[PhotoCount] 🔗 Bubble: ${bubbleObjUrl()}`);
  console.log(`[PhotoCount] 🔑 MASTER_TOKEN: ${MASTER_TOKEN ? "설정됨" : "미설정"}`);
  console.log(`[PhotoCount] 🔑 BUBBLE_TOKEN: ${BUBBLE_TOKEN ? BUBBLE_TOKEN.substring(0, 6) + "..." : "미설정"}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const javaHeaders: Record<string, string> = {
    "Accept-Language": "ko",
    ...(MASTER_TOKEN ? { Authorization: `Bearer ${MASTER_TOKEN}` } : {}),
  };

  try {
    // ════════════════════════════════════════════
    // Step 1: 전체 폴더 목록 조회
    // ════════════════════════════════════════════
    const foldersUrl = `${JAVA_API}/api/v1/folders?size=200`;
    console.log(`[PhotoCount] Step 1️⃣ 폴더 목록 조회 → ${foldersUrl}`);

    const foldersRes = await fetch(foldersUrl, { headers: javaHeaders, cache: "no-store" });
    const foldersText = await foldersRes.text();

    console.log(`[PhotoCount] Step 1️⃣ status: ${foldersRes.status}`);
    console.log(`[PhotoCount] Step 1️⃣ body 미리보기: ${foldersText.substring(0, 500)}`);

    if (!foldersRes.ok) {
      console.error(`[PhotoCount] ❌ 폴더 목록 조회 실패: ${foldersRes.status}`);
      return NextResponse.json({
        success: false,
        step: "1_folders",
        error: `폴더 조회 실패: ${foldersRes.status}`,
        body: foldersText.substring(0, 300),
      }, { status: 502 });
    }

    let foldersData: any;
    try {
      foldersData = JSON.parse(foldersText);
    } catch {
      return NextResponse.json({ success: false, error: "폴더 응답 JSON 파싱 실패" }, { status: 502 });
    }

    const allFolders = foldersData.data?.content || foldersData.content || foldersData.data || [];
    console.log(`[PhotoCount] Step 1️⃣ 전체 폴더 수: ${allFolders.length}`);

    // ════════════════════════════════════════════
    // Step 2: COMPLETED 폴더만 필터링
    // ════════════════════════════════════════════
    const completedFolders = allFolders.filter((f: any) => {
      const status = (f.status || "").toUpperCase();
      return status === "COMPLETED";
    });

    console.log(`[PhotoCount] Step 2️⃣ COMPLETED 폴더 수: ${completedFolders.length} / ${allFolders.length}`);

    // 각 폴더 상세 로그
    for (const f of allFolders) {
      const mark = (f.status || "").toUpperCase() === "COMPLETED" ? "✅" : "⬜";
      console.log(`[PhotoCount]   ${mark} folder[${f.id}] "${f.name || ""}" status=${f.status} scheduleId=${f.scheduleId || "?"}`);
    }

    if (completedFolders.length === 0) {
      console.log("[PhotoCount] 📭 COMPLETED 폴더가 없음 — 종료");
      return NextResponse.json({
        success: true,
        message: "No COMPLETED folders found",
        date: targetDate,
        totalFolders: allFolders.length,
        completedFolders: 0,
      });
    }

    // ════════════════════════════════════════════
    // Step 3: 각 폴더의 RAW 사진 수 조회
    // ════════════════════════════════════════════
    console.log("[PhotoCount] Step 3️⃣ 폴더별 RAW 사진 수 조회 시작");

    // scheduleId → { count, folderIds }
    const scheduleMap = new Map<string, { count: number; tourId: string; folderIds: number[] }>();

    for (const folder of completedFolders) {
      const folderId = folder.id || folder.folderId;
      const scheduleId = String(folder.scheduleId || "unknown");

      if (!folderId) {
        console.warn(`[PhotoCount]   ⚠️ 폴더 ID 없음, 건너뜀`);
        continue;
      }

      const photosUrl = `${JAVA_API}/api/v1/folders/${folderId}/photos?photoType=RAW&size=1`;
      console.log(`[PhotoCount]   📷 folder[${folderId}] 사진 조회 → ${photosUrl}`);

      try {
        const photosRes = await fetch(photosUrl, { headers: javaHeaders, cache: "no-store" });
        const photosText = await photosRes.text();

        console.log(`[PhotoCount]     status: ${photosRes.status}`);

        if (!photosRes.ok) {
          console.warn(`[PhotoCount]     ❌ 사진 조회 실패 folder[${folderId}]: ${photosRes.status}`);
          console.warn(`[PhotoCount]     body: ${photosText.substring(0, 200)}`);
          continue;
        }

        let photosData: any;
        try {
          photosData = JSON.parse(photosText);
        } catch {
          console.warn(`[PhotoCount]     ❌ JSON 파싱 실패 folder[${folderId}]`);
          continue;
        }

        // totalElements 우선, 없으면 content 배열 길이 사용
        const photoCount =
          photosData.data?.totalElements ??
          photosData.totalElements ??
          (photosData.data?.content || photosData.content || []).length ??
          0;

        console.log(`[PhotoCount]     ✅ folder[${folderId}] scheduleId=${scheduleId} → ${photoCount}장`);

        // scheduleId별 합산
        if (!scheduleMap.has(scheduleId)) {
          scheduleMap.set(scheduleId, { count: 0, tourId: tourIdParam, folderIds: [] });
        }
        const entry = scheduleMap.get(scheduleId)!;
        entry.count += Number(photoCount) || 0;
        entry.folderIds.push(folderId);
      } catch (e: any) {
        console.error(`[PhotoCount]     ❌ 네트워크 에러 folder[${folderId}]:`, e.message);
      }
    }

    // ════════════════════════════════════════════
    // Step 4: 집계 결과 요약
    // ════════════════════════════════════════════
    console.log("[PhotoCount] Step 4️⃣ 집계 결과:");
    const aggregated: Array<{ scheduleId: string; tourId: string; count: number; folderIds: number[] }> = [];

    for (const [schedId, data] of scheduleMap.entries()) {
      console.log(`[PhotoCount]   📊 Schedule ${schedId} → ${data.count}장 (폴더: ${data.folderIds.join(", ")})`);
      aggregated.push({ scheduleId: schedId, tourId: data.tourId, count: data.count, folderIds: data.folderIds });
    }

    if (aggregated.length === 0) {
      console.log("[PhotoCount] 📭 집계 결과 없음 — 종료");
      return NextResponse.json({
        success: true,
        message: "No photo data to aggregate",
        date: targetDate,
      });
    }

    // ════════════════════════════════════════════
    // Step 5: Bubble DB에 POST (신규 생성)
    // ════════════════════════════════════════════
    console.log("[PhotoCount] Step 5️⃣ Bubble tour_photo_count에 POST 시작");
    const bubbleUrl = `${bubbleObjUrl()}/tour_photo_count`;
    console.log(`[PhotoCount]   Bubble URL: ${bubbleUrl}`);

    let postedCount = 0;
    const postResults: Array<{ scheduleId: string; count: number; bubbleStatus: number; bubbleBody: string }> = [];

    for (const item of aggregated) {
      if (item.count <= 0) {
        console.log(`[PhotoCount]   ⏭️ Schedule ${item.scheduleId} → 0장, 건너뜀`);
        continue;
      }

      const payload = {
        schedule_Id: item.scheduleId,
        count: item.count,
        tour_Id: item.tourId,
      };

      console.log(`[PhotoCount]   📤 POST payload:`, JSON.stringify(payload));

      try {
        const postRes = await fetch(bubbleUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${BUBBLE_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const postBody = await postRes.text();
        console.log(`[PhotoCount]   📥 Bubble 응답 status: ${postRes.status}`);
        console.log(`[PhotoCount]   📥 Bubble 응답 body: ${postBody.substring(0, 300)}`);

        postResults.push({
          scheduleId: item.scheduleId,
          count: item.count,
          bubbleStatus: postRes.status,
          bubbleBody: postBody.substring(0, 200),
        });

        if (postRes.ok) {
          postedCount++;
          console.log(`[PhotoCount]   ✅ Schedule ${item.scheduleId} → ${item.count}장 저장 성공!`);
        } else {
          console.error(`[PhotoCount]   ❌ Schedule ${item.scheduleId} 저장 실패: ${postRes.status}`);
        }
      } catch (e: any) {
        console.error(`[PhotoCount]   ❌ Bubble POST 에러 (Schedule ${item.scheduleId}):`, e.message);
        postResults.push({
          scheduleId: item.scheduleId,
          count: item.count,
          bubbleStatus: 0,
          bubbleBody: e.message,
        });
      }
    }

    // ════════════════════════════════════════════
    // 최종 보고
    // ════════════════════════════════════════════
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`[PhotoCount] ✅ 집계 완료`);
    console.log(`[PhotoCount]   날짜: ${targetDate}`);
    console.log(`[PhotoCount]   전체 폴더: ${allFolders.length}`);
    console.log(`[PhotoCount]   COMPLETED: ${completedFolders.length}`);
    console.log(`[PhotoCount]   스케줄별 집계: ${aggregated.length}개`);
    console.log(`[PhotoCount]   Bubble POST 성공: ${postedCount}개`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return NextResponse.json({
      success: true,
      date: targetDate,
      tourId: tourIdParam,
      totalFolders: allFolders.length,
      completedFolders: completedFolders.length,
      schedulesAggregated: aggregated.length,
      bubblePosted: postedCount,
      details: aggregated.map(a => ({
        scheduleId: a.scheduleId,
        count: a.count,
        folderIds: a.folderIds,
      })),
      bubbleResults: postResults,
    });
  } catch (e: any) {
    console.error("[PhotoCount] 💥 치명적 에러:", e.message, e.stack);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
