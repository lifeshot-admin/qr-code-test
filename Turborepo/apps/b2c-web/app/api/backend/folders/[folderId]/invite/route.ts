import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const API_BASE_URL =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";

export const dynamic = "force-dynamic";

function sanitizeAuthHeader(rawToken: string): string {
  let pure = rawToken;
  while (/^Bearer\s+/i.test(pure)) pure = pure.replace(/^Bearer\s+/i, "");
  return `Bearer ${pure.trim()}`;
}

/**
 * POST /api/backend/folders/[folderId]/invite
 * Java POST /api/v1/folders/{folderId}/invite 프록시
 * body: { userIdList: number[], message: string }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ folderId: string }> }) {
  try {
    const { folderId } = await params;
    const session = await getServerSession(authOptions);
    const accessToken = (session as any)?.accessToken;

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const authHeader = sanitizeAuthHeader(accessToken);
    const backendUrl = `${API_BASE_URL}/api/v1/folders/${folderId}/invite`;

    console.log(`[INVITE] POST ${backendUrl}`, JSON.stringify(body).substring(0, 300));

    const res = await fetch(backendUrl, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    console.log(`[INVITE] 응답: ${res.status} ${text.substring(0, 300)}`);

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: text, httpStatus: res.status },
        { status: res.status },
      );
    }

    let parsed: any;
    try { parsed = JSON.parse(text); } catch { parsed = {}; }

    return NextResponse.json({ success: true, data: parsed.data || parsed });
  } catch (e: any) {
    console.error("[INVITE] 예외:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
