import { NextResponse } from "next/server";
import { getSpotPoses } from "@/lib/bubble-api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const poses = await getSpotPoses();
    return NextResponse.json(poses);
  } catch (error) {
    console.error("Error fetching Spot_pose list:", error);
    return NextResponse.json(
      { error: "Failed to fetch poses" },
      { status: 500 }
    );
  }
}
