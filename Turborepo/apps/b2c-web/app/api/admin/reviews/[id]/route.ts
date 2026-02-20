import { NextRequest, NextResponse } from "next/server";
import {
  fetchReviewById,
  fetchReviewImagesByReviewId,
  updateReview,
} from "@/lib/bubble-api";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "noreply@lifeshot.me";
const FROM_NAME = process.env.SENDGRID_FROM_NAME || "CHEIZ";

/**
 * GET /api/admin/reviews/[id]
 * 단일 리뷰 + 연결된 review_image 목록 조회
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [review, images] = await Promise.all([
      fetchReviewById(id),
      fetchReviewImagesByReviewId(id),
    ]);

    if (!review) {
      return NextResponse.json({ error: "리뷰를 찾을 수 없습니다" }, { status: 404 });
    }

    return NextResponse.json({ review, images });
  } catch (error) {
    console.error("[API /admin/reviews/[id] GET]", error);
    return NextResponse.json({ error: "리뷰 조회 실패" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/reviews/[id]
 * 리뷰 승인 + 보정본 URL 저장 + 이메일 알림 발송
 *
 * Body: {
 *   status?: string,
 *   color_grade_status?: string,
 *   corrected_images?: string[],
 *   user_email?: string,
 *   user_nickname?: string,
 * }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      status,
      color_grade_status,
      corrected_images,
      user_email,
      user_nickname,
      ...rest
    } = body;

    const updateData: Record<string, any> = { ...rest };
    if (status) updateData.status = status;
    if (color_grade_status) updateData.color_grade_status = color_grade_status;
    if (corrected_images) updateData.corrected_images = corrected_images;

    const ok = await updateReview(id, updateData);
    if (!ok) {
      return NextResponse.json({ error: "리뷰 업데이트 실패" }, { status: 500 });
    }

    if (
      status === "completed" &&
      color_grade_status === "completed" &&
      user_email &&
      SENDGRID_API_KEY
    ) {
      try {
        const nickname = user_nickname || "고객";
        const sgRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SENDGRID_API_KEY}`,
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: user_email }] }],
            from: { email: FROM_EMAIL, name: FROM_NAME },
            subject: "[CHEIZ] 색감 보정이 완료되었습니다 🎨",
            content: [
              {
                type: "text/html",
                value: `
                  <div style="font-family: 'Apple SD Gothic Neo', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
                    <div style="text-align: center; margin-bottom: 32px;">
                      <h1 style="color: #9333ea; font-size: 24px; margin: 0;">CHEIZ</h1>
                      <p style="color: #666; font-size: 14px; margin-top: 8px;">색감 보정 완료 안내</p>
                    </div>
                    <div style="background: #F8F9FA; border-radius: 16px; padding: 32px;">
                      <p style="color: #333; font-size: 16px; font-weight: bold; margin: 0 0 12px;">${nickname}님, 안녕하세요!</p>
                      <p style="color: #555; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
                        요청하신 리뷰 사진의 색감 보정이 완료되었습니다.<br/>
                        앨범 페이지의 <strong>리뷰 보너스 🎁</strong> 탭에서 확인하실 수 있습니다.
                      </p>
                      <div style="text-align: center;">
                        <a href="https://cheiz.me/cheiz/albums"
                           style="display: inline-block; background: #9333ea; color: white; font-size: 14px; font-weight: bold; padding: 12px 32px; border-radius: 12px; text-decoration: none;">
                          앨범에서 확인하기
                        </a>
                      </div>
                    </div>
                    <p style="color: #999; font-size: 11px; text-align: center; margin-top: 24px;">
                      CHEIZ와 함께 해주셔서 감사합니다.
                    </p>
                  </div>
                `,
              },
            ],
          }),
        });

        if (sgRes.ok || sgRes.status === 202) {
          console.log(`[ADMIN_REVIEW] 보정 완료 이메일 발송 성공 — ${user_email}`);
        } else {
          const sgErr = await sgRes.text();
          console.error(`[ADMIN_REVIEW] SendGrid 발송 실패: ${sgRes.status} — ${sgErr.substring(0, 300)}`);
        }
      } catch (sgError: any) {
        console.error("[ADMIN_REVIEW] SendGrid 예외:", sgError.message);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API /admin/reviews/[id] PATCH]", error);
    return NextResponse.json({ error: "리뷰 승인 실패" }, { status: 500 });
  }
}
