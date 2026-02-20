import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Get Spot by ID
 * GET /api/bubble/spot/[spotId]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { spotId: string } }
) {
  try {
    const spotId = parseInt(params.spotId, 10);

    if (isNaN(spotId)) {
      return NextResponse.json(
        { error: "Invalid spot ID" },
        { status: 400 }
      );
    }

    const BUBBLE_API_BASE_URL = process.env.BUBBLE_API_BASE_URL || "https://lifeshot.bubbleapps.io/version-test/api/1.1";
    const BUBBLE_API_TOKEN = process.env.BUBBLE_API_TOKEN;

    if (!BUBBLE_API_TOKEN) {
      console.error("❌ [Bubble API] Missing BUBBLE_API_TOKEN");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Fetch spot by spot_Id
    const constraints = [
      {
        key: "spot_Id",
        constraint_type: "equals",
        value: spotId,
      },
    ];

    const url = `${BUBBLE_API_BASE_URL}/obj/Spot`;
    const params_query = new URLSearchParams();
    params_query.append("constraints", JSON.stringify(constraints));

    const response = await fetch(`${url}?${params_query.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${BUBBLE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(`❌ [Bubble API] Failed to fetch spot ${spotId}:`, response.status);
      return NextResponse.json(
        { error: "Failed to fetch spot" },
        { status: response.status }
      );
    }

    const data = await response.json();
    const spots = data.response?.results || [];

    if (spots.length === 0) {
      return NextResponse.json(
        { error: "Spot not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      spot: spots[0],
    });
  } catch (error) {
    console.error("❌ [GET /api/bubble/spot/[spotId]] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
