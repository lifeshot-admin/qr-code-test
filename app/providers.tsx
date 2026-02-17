"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { useEffect, useRef } from "react";

/**
 * 세션 에러 감시 컴포넌트 (완화 버전)
 * 
 * ✅ 이전: RefreshAccessTokenError 감지 즉시 signOut → 로그인 루프 유발
 * ✅ 이후: 경고 로그만 찍고 세션 유지 → 실제 API 401 실패 시에만 로그아웃
 * 
 * signOut 조건:
 *   1. 세션에 RefreshAccessTokenError 에러가 있고
 *   2. 사용자가 실제 API를 호출했는데 401이 떨어지고
 *   3. 리프레시 재시도마저 실패했을 때
 *   → api-client.ts 에서 signOut 호출 (여기서는 안 함)
 */
function SessionGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const hasLoggedWarning = useRef(false);

  useEffect(() => {
    if ((session as any)?.error === "RefreshAccessTokenError") {
      if (!hasLoggedWarning.current) {
        hasLoggedWarning.current = true;
        console.warn("[SESSION_GUARD] 세션 에러 감지 — 로그아웃하지 않고 유지");
      }
    } else {
      hasLoggedWarning.current = false;
    }
  }, [session]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""}>
      <SessionProvider>
        <SessionGuard>{children}</SessionGuard>
      </SessionProvider>
    </GoogleOAuthProvider>
  );
}
