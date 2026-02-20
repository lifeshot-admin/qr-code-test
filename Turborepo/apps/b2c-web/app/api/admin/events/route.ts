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
    const payload = {
      title: body.title || "",
      subtitle: body.subtitle || "",
      badge_text: body.badge_text || "",
      benefit_desc: body.benefit_desc || "",
      conditions: body.conditions || "",
      cta_text: body.cta_text || "",
      description: body.description || "",
      image_url: body.image_url || "",
      reward_amount: Number(body.reward_amount) || 0,
      reward_type: body.reward_type || "PHOTO",
      sort_order: Number(body.sort_order) || 0,
      target_url: body.target_url || "",
      thumbnail_url: body.thumbnail_url || "",
      promotion: body.promotion || "no",
      expire_date: body.expire_date || "",
    };

    console.log("[API /admin/events POST] Bubble payload:", JSON.stringify(payload));

    const result = await createEvent(payload);
    if (!result) {
      return NextResponse.json({ error: "이벤트 생성 실패 — Bubble API 응답 없음" }, { status: 500 });
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
    const { id, ...rawData } = body;
    if (!id) {
      return NextResponse.json({ error: "id 필수" }, { status: 400 });
    }

    if (rawData.sort_order !== undefined) {
      rawData.sort_order = Number(rawData.sort_order) || 0;
    }
    if (rawData.reward_amount !== undefined) {
      rawData.reward_amount = Number(rawData.reward_amount) || 0;
    }

    const ok = await updateEvent(id, rawData);
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
