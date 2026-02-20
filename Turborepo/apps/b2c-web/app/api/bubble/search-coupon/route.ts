import { NextRequest, NextResponse } from "next/server";
import { searchCoupon } from "@/lib/bubble-api";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * 쿠폰 조회 API (개편)
 * 
 * 필수 파라미터:
 * - tour_date: 투어 날짜 (YYYY-MM-DD)
 * - phone_4_digits: 전화번호 뒷 4자리
 * 
 * 조회 로직:
 * 1. phone 뒷 4자리 + tour_date 범위 매칭으로 EXCEL 테이블 검색
 * 2. 매칭된 레코드에서 code 값을 자동 추출하여 반환
 * 3. code 입력 불필요 (자동 조회)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tourDate = searchParams.get("tour_date");
    const phone4Digits = searchParams.get("phone_4_digits");

    if (!tourDate || !phone4Digits) {
      return NextResponse.json(
        { error: "Missing required parameters: tour_date, phone_4_digits" },
        { status: 400 }
      );
    }

    // phone 4자리 유효성 검증
    if (phone4Digits.length !== 4 || !/^\d{4}$/.test(phone4Digits)) {
      return NextResponse.json(
        { error: "phone_4_digits must be exactly 4 digits" },
        { status: 400 }
      );
    }

    // 날짜 형식 검증 (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tourDate)) {
      return NextResponse.json(
        { error: "tour_date must be in YYYY-MM-DD format" },
        { status: 400 }
      );
    }

    const coupon = await searchCoupon(tourDate, phone4Digits);
    
    if (!coupon) {
      return NextResponse.json(
        { 
          found: false, 
          message: "일치하는 예약 정보가 없습니다. 전화번호와 날짜를 다시 확인해 주세요." 
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      found: true,
      data: {
        coupon_name: coupon.coupon_name,
        tour_date: coupon.tour_date,
        code: coupon.code,
        tour_Id: coupon.tour_Id,
      },
    });
  } catch (error) {
    console.error("Error searching coupon:", error);
    return NextResponse.json(
      { error: "Failed to search coupon" },
      { status: 500 }
    );
  }
}
