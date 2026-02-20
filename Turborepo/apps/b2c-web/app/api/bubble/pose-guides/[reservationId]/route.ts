import { NextRequest, NextResponse } from "next/server";
import { getPoseGuidesForReservation } from "@/lib/bubble-api";

// Next.js API 라우트 설정
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ reservationId: string }> }
) {
  const reservationId = (await params).reservationId;
  if (!reservationId) {
    return NextResponse.json({ error: "reservationId required" }, { status: 400 });
  }
  const list = await getPoseGuidesForReservation(reservationId);
  return NextResponse.json(list);
}
