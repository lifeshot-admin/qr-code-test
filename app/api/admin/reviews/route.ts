import { NextResponse } from "next/server";
import { fetchReviewsAdmin, updateReview, deleteReview } from "@/lib/bubble-api";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const sort = searchParams.get("sort") || "Modified Date";
    const descending = searchParams.get("descending") !== "false";

    const { results, count } = await fetchReviewsAdmin({ limit, offset, sort, descending });
    return NextResponse.json({ data: results, count });
  } catch (error) {
    console.error("[API /admin/reviews GET]", error);
    return NextResponse.json({ error: "리뷰 목록 조회 실패" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) {
      return NextResponse.json({ error: "id 필수" }, { status: 400 });
    }
    const ok = await updateReview(id, data);
    if (!ok) {
      return NextResponse.json({ error: "리뷰 수정 실패" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API /admin/reviews PATCH]", error);
    return NextResponse.json({ error: "리뷰 수정 실패" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id 필수" }, { status: 400 });
    }
    const ok = await deleteReview(id);
    if (!ok) {
      return NextResponse.json({ error: "리뷰 삭제 실패" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API /admin/reviews DELETE]", error);
    return NextResponse.json({ error: "리뷰 삭제 실패" }, { status: 500 });
  }
}
