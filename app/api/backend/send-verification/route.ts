import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "noreply@lifeshot.me";
const FROM_NAME = process.env.SENDGRID_FROM_NAME || "CHEIZ";

// 인메모리 인증코드 저장소 (프로덕션에서는 Redis 등 사용 권장)
const verificationCodes = new Map<string, { code: string; expiresAt: number }>();

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * POST /api/backend/send-verification
 *
 * 이메일 인증번호 발송 (SendGrid)
 * Body: { email: string }
 *
 * 6자리 인증번호를 생성하여 해당 이메일로 발송
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { email } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "유효한 이메일을 입력해주세요." },
        { status: 400 },
      );
    }

    const code = generateCode();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5분 유효

    // 인증코드 저장
    verificationCodes.set(email.toLowerCase(), { code, expiresAt });

    console.log(`[VERIFY] 인증번호 생성 — email: ${email}, code: ${code}`);

    // SendGrid API 호출
    if (SENDGRID_API_KEY) {
      try {
        const sgRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SENDGRID_API_KEY}`,
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email }] }],
            from: { email: FROM_EMAIL, name: FROM_NAME },
            subject: `[CHEIZ] 이메일 인증번호: ${code}`,
            content: [
              {
                type: "text/html",
                value: `
                  <div style="font-family: 'Apple SD Gothic Neo', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
                    <div style="text-align: center; margin-bottom: 32px;">
                      <h1 style="color: #0055FF; font-size: 24px; margin: 0;">CHEIZ</h1>
                      <p style="color: #666; font-size: 14px; margin-top: 8px;">이메일 인증</p>
                    </div>
                    <div style="background: #F8F9FA; border-radius: 16px; padding: 32px; text-align: center;">
                      <p style="color: #333; font-size: 14px; margin: 0 0 16px;">아래 인증번호를 입력해주세요.</p>
                      <div style="background: #0055FF; color: white; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 16px 24px; border-radius: 12px; display: inline-block;">
                        ${code}
                      </div>
                      <p style="color: #999; font-size: 12px; margin-top: 16px;">이 인증번호는 5분간 유효합니다.</p>
                    </div>
                    <p style="color: #999; font-size: 11px; text-align: center; margin-top: 24px;">
                      본인이 요청하지 않았다면 이 이메일을 무시하세요.
                    </p>
                  </div>
                `,
              },
            ],
          }),
        });

        if (sgRes.ok || sgRes.status === 202) {
          console.log(`[VERIFY] SendGrid 발송 성공 — email: ${email}`);
        } else {
          const sgErr = await sgRes.text();
          console.error(`[VERIFY] SendGrid 발송 실패: ${sgRes.status} — ${sgErr.substring(0, 300)}`);
          // SendGrid 실패해도 코드는 저장됨 (개발/테스트 시 콘솔에서 확인 가능)
        }
      } catch (sgError: any) {
        console.error(`[VERIFY] SendGrid 예외:`, sgError.message);
      }
    } else {
      console.warn("[VERIFY] SENDGRID_API_KEY 미설정 — 콘솔에서 인증번호 확인: ", code);
    }

    return NextResponse.json({
      success: true,
      message: "인증번호가 발송되었습니다.",
    });
  } catch (e: any) {
    console.error("[VERIFY] 에러:", e.message);
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/backend/send-verification
 *
 * 인증번호 검증
 * Body: { email: string, code: string }
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { email, code } = body;

    if (!email || !code) {
      return NextResponse.json(
        { success: false, error: "이메일과 인증번호를 입력해주세요." },
        { status: 400 },
      );
    }

    const stored = verificationCodes.get(email.toLowerCase());

    if (!stored) {
      return NextResponse.json(
        { success: false, error: "인증번호를 먼저 발송해주세요." },
        { status: 400 },
      );
    }

    if (Date.now() > stored.expiresAt) {
      verificationCodes.delete(email.toLowerCase());
      return NextResponse.json(
        { success: false, error: "인증번호가 만료되었습니다. 다시 발송해주세요." },
        { status: 400 },
      );
    }

    if (stored.code !== code.trim()) {
      return NextResponse.json(
        { success: false, error: "인증번호가 일치하지 않습니다." },
        { status: 400 },
      );
    }

    // 인증 성공 — 코드 삭제
    verificationCodes.delete(email.toLowerCase());
    console.log(`[VERIFY] 인증 성공 — email: ${email}`);

    return NextResponse.json({
      success: true,
      verified: true,
      message: "이메일 인증이 완료되었습니다.",
    });
  } catch (e: any) {
    console.error("[VERIFY] 검증 에러:", e.message);
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 },
    );
  }
}
