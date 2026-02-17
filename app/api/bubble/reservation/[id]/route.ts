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

  // 닉네임 매핑 로깅 (포토그래퍼 QR 확인 모달에서 사용)
  if (process.env.NODE_ENV === "development") {
    console.log(`[Reservation/${id}] 조회 성공:`, {
      user_nickname: row.user_nickname || "(없음)",
      status: row.status || "(없음)",
      user_Id: row.user_Id,
      keys: Object.keys(row),
    });
  }

  // 응답: Bubble 원본 데이터 + 닉네임 편의 매핑
  // (tour_name 등은 Bubble 테이블에 없으므로 row에서 직접 꺼냄 — 없으면 빈 문자열)
  const rawData = row as Record<string, any>;
  return NextResponse.json({
    data: {
      ...row,
      nickname: row.user_nickname || rawData.nickname || "고객님",
      tour_name: rawData.tour_name || "",
      tour_thumbnail: rawData.tour_thumbnail || "",
      schedule_time: rawData.schedule_time || "",
    },
  });
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
