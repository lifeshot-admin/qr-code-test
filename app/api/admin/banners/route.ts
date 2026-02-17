import { NextResponse } from "next/server";
import { fetchBanners, createBanner, updateBanner, deleteBanner } from "@/lib/bubble-api";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const banners = await fetchBanners();
    return NextResponse.json({ data: banners });
  } catch (error) {
    console.error("[API /admin/banners GET]", error);
    return NextResponse.json({ error: "배너 목록 조회 실패" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await createBanner(body);
    if (!result) {
      return NextResponse.json({ error: "배너 생성 실패" }, { status: 500 });
    }
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("[API /admin/banners POST]", error);
    return NextResponse.json({ error: "배너 생성 실패" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) {
      return NextResponse.json({ error: "id 필수" }, { status: 400 });
    }
    const ok = await updateBanner(id, data);
    if (!ok) {
      return NextResponse.json({ error: "배너 수정 실패" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API /admin/banners PATCH]", error);
    return NextResponse.json({ error: "배너 수정 실패" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id 필수" }, { status: 400 });
    }
    const ok = await deleteBanner(id);
    if (!ok) {
      return NextResponse.json({ error: "배너 삭제 실패" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API /admin/banners DELETE]", error);
    return NextResponse.json({ error: "배너 삭제 실패" }, { status: 500 });
  }
}
