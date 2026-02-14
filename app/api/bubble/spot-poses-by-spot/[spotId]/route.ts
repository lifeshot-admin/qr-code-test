import { NextRequest, NextResponse } from "next/server";
import { getSpotPosesBySpotId, getSpotPosesByFilters } from "@/lib/bubble-api";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * spotId로 Spot_pose 조회 (선택적으로 tourId, persona 필터 추가)
 * GET /api/bubble/spot-poses-by-spot/[spotId]?tourId=123&persona=커플
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { spotId: string } }
) {
  try {
    // 🚨 [CRITICAL CHECK] API 라우트로 들어온 파라미터 확인
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🚨 [CRITICAL CHECK] /api/bubble/spot-poses-by-spot/[spotId] 호출:");
    console.log("  📥 받은 spotId (string):", params.spotId);
    
    const spotId = parseInt(params.spotId, 10);
    const searchParams = request.nextUrl.searchParams;
    const persona = searchParams.get("persona") || undefined;
    const tourIdParam = searchParams.get("tourId");
    
    console.log("  ✅ parseInt 후 spotId (number):", spotId);
    console.log("  📥 받은 tourId query (string):", tourIdParam || "없음");
    console.log("  📥 받은 persona query:", persona || "전체");
    
    if (isNaN(spotId)) {
      return NextResponse.json(
        { error: "Invalid spot ID" },
        { status: 400 }
      );
    }

    let poses;
    
    // ✅ tourId 파라미터가 있으면 복합 필터 사용
    if (tourIdParam) {
      const tourId = parseInt(tourIdParam, 10);
      console.log("  ✅ parseInt 후 tourId (number):", tourId);
      console.log("  ⚠️ tourId가 11093이면 잘못됨! 30처럼 작은 숫자여야 함!");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      
      if (!isNaN(tourId)) {
        console.log(`📋 [Spot Poses] Fetching with filters: tourId=${tourId}, spotId=${spotId}, persona=${persona || '전체'}`);
        poses = await getSpotPosesByFilters(tourId, spotId, persona);
      } else {
        poses = await getSpotPosesBySpotId(spotId, persona);
      }
    } else {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      // ✅ tourId 없으면 기존 로직 (spotId + persona만)
      console.log(`📋 [Spot Poses] Fetching with spotId=${spotId}, persona=${persona || '전체'}`);
      poses = await getSpotPosesBySpotId(spotId, persona);
    }

    console.log(`✅ [Spot Poses] Found ${poses.length} poses`);

    return NextResponse.json({ poses });
  } catch (error) {
    console.error("Error fetching spot poses:", error);
    return NextResponse.json(
      { error: "Failed to fetch spot poses" },
      { status: 500 }
    );
  }
}
