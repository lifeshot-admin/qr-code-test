import { NextRequest, NextResponse } from "next/server";
import { getPoseReservation, updateReservationStatus } from "@/lib/bubble-api";

// Next.js API 라우트 설정
export const maxDuration = 60;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = (await params).id;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const row = await getPoseReservation(id);
  if (!row) {
    return NextResponse.json(null, { status: 404 });
  }
  return NextResponse.json(row);
}

/**
 * PATCH: 예약 상태 업데이트
 * Body: { status: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = (await params).id;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  try {
    const body = await request.json();
    const { status } = body;
    if (!status) {
      return NextResponse.json({ error: "status required" }, { status: 400 });
    }
    const result = await updateReservationStatus(id, status);
    if (!result) {
      return NextResponse.json(
        { error: "Bubble API update failed" },
        { status: 502 }
      );
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error("PATCH reservation status", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
