import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const tourId = searchParams.get("tourId");

  if (!userId || !tourId) {
    return NextResponse.json({ exists: false, error: "userId, tourId 필수" }, { status: 400 });
  }

  const baseUrl = process.env.BUBBLE_API_BASE_URL;
  const token = process.env.BUBBLE_API_TOKEN;

  if (!baseUrl || !token) {
    return NextResponse.json({ exists: false, error: "환경변수 미설정" }, { status: 500 });
  }

  try {
    const constraints = JSON.stringify([
      { key: "user_Id", constraint_type: "equals", value: Number(userId) },
      { key: "tour_Id", constraint_type: "equals", value: Number(tourId) },
      { key: "status", constraint_type: "is not", value: "cancelled" },
    ]);

    const url = `${baseUrl}/obj/pose_reservation?constraints=${encodeURIComponent(constraints)}&limit=1`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.error("[check-duplicate] Bubble API error:", res.status);
      return NextResponse.json({ exists: false });
    }

    const data = await res.json();
    const results = data?.response?.results || [];

    return NextResponse.json({
      exists: results.length > 0,
      reservationCode: results.length > 0 ? (results[0].Id || "") : "",
    });
  } catch (err) {
    console.error("[check-duplicate] Error:", err);
    return NextResponse.json({ exists: false });
  }
}
