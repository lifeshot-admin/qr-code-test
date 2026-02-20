import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const API_BASE_URL =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";

function sanitizeAuthHeader(rawToken: string): string {
  let pure = rawToken;
  while (/^Bearer\s+/i.test(pure)) {
    pure = pure.replace(/^Bearer\s+/i, "");
  }
  return `Bearer ${pure.trim()}`;
}

/**
 * 범용 자바 백엔드 프록시
 * 클라이언트에서 /api/backend/proxy?path=/api/v1/xxx 로 호출하면
 * 서버에서 api.lifeshot.me/api/v1/xxx 로 전달
 *
 * 지원: GET, POST, PUT, PATCH, DELETE
 */
async function handleProxy(request: NextRequest, method: string) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path");

    if (!path) {
      return NextResponse.json({ error: "path query parameter required" }, { status: 400 });
    }

    // Body를 세션 조회보다 먼저 읽음 (스트림 1회 소비 문제 방지)
    let requestBody: string | undefined;
    if (method !== "GET" && method !== "HEAD") {
      try {
        requestBody = await request.text();
        if (requestBody) {
          // JSON 유효성 검증 후 다시 직렬화하여 깨진 데이터 전달 방지
          const parsed = JSON.parse(requestBody);
          requestBody = JSON.stringify(parsed);
          console.log(`[PROXY] ${method} body (${requestBody.length} chars): ${requestBody.substring(0, 300)}`);
        } else {
          console.warn(`[PROXY] ⚠️ ${method} body is EMPTY — 백엔드에 빈 요청이 전달됩니다`);
        }
      } catch (bodyErr: any) {
        console.error(`[PROXY] ❌ Body read/parse failed: ${bodyErr.message}`);
        // JSON 파싱 실패 시 원본 텍스트라도 전달
      }
    }

    const remainingParams = new URLSearchParams(searchParams);
    remainingParams.delete("path");
    const queryString = remainingParams.toString();
    const targetUrl = `${API_BASE_URL}${path}${queryString ? `?${queryString}` : ""}`;

    console.log(`[PROXY] ${method} ${targetUrl}`);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
    };

    const clientAuth = request.headers.get("authorization");
    const session = await getServerSession(authOptions);
    const accessToken = (session as any)?.accessToken;
    if (clientAuth) {
      headers["Authorization"] = sanitizeAuthHeader(clientAuth);
    } else if (accessToken) {
      headers["Authorization"] = sanitizeAuthHeader(accessToken);
    }

    const clientLang = request.headers.get("accept-language");
    const userLan = (session as any)?.user?.lan || "ko";
    headers["Accept-Language"] = clientLang || userLan;

    const fetchOptions: RequestInit = {
      method,
      headers,
      cache: "no-store",
    };

    if (requestBody) {
      fetchOptions.body = requestBody;
    }

    const res = await fetch(targetUrl, fetchOptions);
    const responseText = await res.text();

    console.log(`[PROXY] Response: ${res.status} (${responseText.length} bytes)`);

    if (!res.ok) {
      console.error(`[PROXY] ❌ HTTP ${res.status}: ${responseText.substring(0, 500)}`);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = { rawBody: responseText.substring(0, 1000) };
    }

    return NextResponse.json(parsed, { status: res.status });
  } catch (error: any) {
    console.error("[PROXY] ❌ Exception:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handleProxy(request, "GET");
}

export async function POST(request: NextRequest) {
  return handleProxy(request, "POST");
}

export async function PATCH(request: NextRequest) {
  return handleProxy(request, "PATCH");
}

export async function PUT(request: NextRequest) {
  return handleProxy(request, "PUT");
}

export async function DELETE(request: NextRequest) {
  return handleProxy(request, "DELETE");
}
