import { NextRequest, NextResponse } from "next/server";
import { getSpotsByTourId } from "@/lib/bubble-api";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * tourId로 SPOT 목록 조회
 * GET /api/bubble/spots/[tourId]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { tourId: string } }
) {
  try {
    // 🚨 [CRITICAL CHECK] API 라우트로 들어온 tourId 확인
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🚨 [CRITICAL CHECK] /api/bubble/spots/[tourId] 호출:");
    console.log("  📥 받은 tourId (string):", params.tourId);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    const tourId = parseInt(params.tourId, 10);
    
    console.log("  ✅ parseInt 후 tourId (number):", tourId);
    console.log("  ✅ tourId type:", typeof tourId);
    console.log("  ⚠️ 이 값이 11093이면 잘못됨! 30처럼 작은 숫자여야 함!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    if (isNaN(tourId)) {
      return NextResponse.json(
        { error: "Invalid tour ID" },
        { status: 400 }
      );
    }

    const spots = await getSpotsByTourId(tourId);

    console.log(`✅ [API Route] /api/bubble/spots/${tourId} 결과:`, spots.length, "개");

    return NextResponse.json({ spots });
  } catch (error) {
    console.error("Error fetching spots:", error);
    return NextResponse.json(
      { error: "Failed to fetch spots" },
      { status: 500 }
    );
  }
}
