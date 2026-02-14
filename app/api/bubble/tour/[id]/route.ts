import { NextRequest, NextResponse } from "next/server";
import { getTourById } from "@/lib/bubble-api";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tourId = parseInt(params.id, 10);
    
    if (isNaN(tourId)) {
      return NextResponse.json(
        { error: "Invalid tour ID" },
        { status: 400 }
      );
    }

    const tour = await getTourById(tourId);

    if (!tour) {
      return NextResponse.json(
        { error: "Tour not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ tour });
  } catch (error) {
    console.error("Error fetching tour:", error);
    return NextResponse.json(
      { error: "Failed to fetch tour" },
      { status: 500 }
    );
  }
}
