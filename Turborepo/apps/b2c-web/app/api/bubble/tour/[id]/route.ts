import { NextRequest, NextResponse } from "next/server";
import { getTourByTourId } from "@/lib/bubble-api";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * tour_Id(자바 백엔드 ID) 기반으로 투어 조회
 * GET /api/bubble/tour/[id]
 * 
 * ✅ 변경: Bubble _id 직접 조회 → constraints 기반 tour_Id 검색
 * constraints=[{"key":"tour_Id","constraint_type":"equals","value": id}]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tourId = parseInt(params.id, 10);

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎯 [API Route] /api/bubble/tour/[id] 호출");
    console.log(`  📥 params.id (raw): "${params.id}"`);
    console.log(`  📥 parsed tourId: ${tourId} (${typeof tourId})`);
    console.log("  ✅ constraints 기반 tour_Id 검색 방식 사용");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    if (isNaN(tourId)) {
      return NextResponse.json(
        { error: "Invalid tour ID" },
        { status: 400 }
      );
    }

    const tour = await getTourByTourId(tourId);

    if (!tour) {
      return NextResponse.json(
        { error: "Tour not found" },
        { status: 404 }
      );
    }

    // ✅ [RAW LOG] 클라이언트에 반환하는 tour_Id 원본 값 확인
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📤 [API Route] 클라이언트 응답:");
    console.log(`  📌 tour.tour_Id (RAW): ${tour.tour_Id} (${typeof tour.tour_Id})`);
    console.log(`  📌 tour.tour_name: ${tour.tour_name}`);
    console.log(`  📌 tour._id: ${tour._id}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return NextResponse.json({ tour });
  } catch (error) {
    console.error("Error fetching tour:", error);
    return NextResponse.json(
      { error: "Failed to fetch tour" },
      { status: 500 }
    );
  }
}
