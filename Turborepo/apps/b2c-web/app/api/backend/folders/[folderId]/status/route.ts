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
 * PATCH /api/backend/folders/[folderId]/status?status=CANCELED
 * Java PATCH /api/v1/folders/{folderId}/status
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ folderId: string }> }) {
  try {
    const { folderId } = await params;
    const statusParam = req.nextUrl.searchParams.get("status") || "CANCELED";

    const session = await getServerSession(authOptions);
    const accessToken = (session as any)?.accessToken;
    const userLan = (session as any)?.user?.lan || "ko";

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authHeader = sanitizeAuthHeader(accessToken);
    const backendUrl = `${API_BASE_URL}/api/v1/folders/${folderId}/status?status=${encodeURIComponent(statusParam)}`;

    console.log(`[FOLDER_STATUS] PATCH ${backendUrl}`);

    const res = await fetch(backendUrl, {
      method: "PATCH",
      headers: {
        Authorization: authHeader,
        "Accept-Language": userLan,
        "Content-Type": "application/json",
      },
    });

    const text = await res.text();
    console.log(`[FOLDER_STATUS] 응답: ${res.status} ${text.substring(0, 300)}`);

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
    console.error("[FOLDER_STATUS] 예외:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
