import { NextResponse } from "next/server";
import { fetchReviews } from "@/lib/bubble-api";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * 리뷰 목록 조회 API
 * GET /api/bubble/reviews
 */
export async function GET() {
  try {
    const reviews = await fetchReviews();

    return NextResponse.json({
      reviews,
      count: reviews.length,
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json(
      { error: "Failed to fetch reviews", reviews: [] },
      { status: 500 }
    );
  }
}
