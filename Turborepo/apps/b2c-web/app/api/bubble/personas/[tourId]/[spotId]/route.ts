import { NextRequest, NextResponse } from "next/server";
import { getPersonasByTourAndSpot } from "@/lib/bubble-api";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * tourId와 spotId로 사용 가능한 persona 중복 제거 목록 조회
 * GET /api/bubble/personas/[tourId]/[spotId]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { tourId: string; spotId: string } }
) {
  try {
    // 🚨 [CRITICAL CHECK] API 라우트로 들어온 tourId 확인
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🚨 [CRITICAL CHECK] /api/bubble/personas/[tourId]/[spotId] 호출:");
    console.log("  📥 받은 tourId (string):", params.tourId);
    console.log("  📥 받은 spotId (string):", params.spotId);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    const tourId = parseInt(params.tourId, 10);
    const spotId = parseInt(params.spotId, 10);
    
    console.log("  ✅ parseInt 후 tourId (number):", tourId);
    console.log("  ✅ parseInt 후 spotId (number):", spotId);
    console.log("  ⚠️ tourId가 11093이면 잘못됨! 27처럼 작은 숫자여야 함!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    if (isNaN(tourId) || isNaN(spotId)) {
      return NextResponse.json(
        { error: "Invalid tour ID or spot ID" },
        { status: 400 }
      );
    }

    console.log(`📋 [Personas API] Fetching personas for tour ${tourId}, spot ${spotId}`);
    
    const personas = await getPersonasByTourAndSpot(tourId, spotId);

    console.log(`✅ [Personas API] Found ${personas.length} unique personas:`, personas);

    return NextResponse.json({ 
      personas: ["전체", ...personas] // ✅ "전체" 옵션 추가
    });
  } catch (error) {
    console.error("Error fetching personas:", error);
    return NextResponse.json(
      { error: "Failed to fetch personas" },
      { status: 500 }
    );
  }
}
