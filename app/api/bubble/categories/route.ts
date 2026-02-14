import { NextResponse } from "next/server";
import { getPoseCategories } from "@/lib/bubble-api";

// Next.js API 라우트 설정
export const maxDuration = 60;

/**
 * GET: 포즈 카테고리 목록 조회
 */
export async function GET() {
  try {
    const categories = await getPoseCategories();
    return NextResponse.json(categories);
  } catch (e: any) {
    console.error("❌ [API Route] Categories error:", e.message || e);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}
