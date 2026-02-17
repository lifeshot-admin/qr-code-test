import { NextResponse } from "next/server";
import { fetchEvents, createEvent, updateEvent, deleteEvent } from "@/lib/bubble-api";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const events = await fetchEvents();
    return NextResponse.json({ data: events });
  } catch (error) {
    console.error("[API /admin/events GET]", error);
    return NextResponse.json({ error: "이벤트 목록 조회 실패" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await createEvent(body);
    if (!result) {
      return NextResponse.json({ error: "이벤트 생성 실패" }, { status: 500 });
    }
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("[API /admin/events POST]", error);
    return NextResponse.json({ error: "이벤트 생성 실패" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) {
      return NextResponse.json({ error: "id 필수" }, { status: 400 });
    }
    const ok = await updateEvent(id, data);
    if (!ok) {
      return NextResponse.json({ error: "이벤트 수정 실패" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API /admin/events PATCH]", error);
    return NextResponse.json({ error: "이벤트 수정 실패" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id 필수" }, { status: 400 });
    }
    const ok = await deleteEvent(id);
    if (!ok) {
      return NextResponse.json({ error: "이벤트 삭제 실패" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API /admin/events DELETE]", error);
    return NextResponse.json({ error: "이벤트 삭제 실패" }, { status: 500 });
  }
}
