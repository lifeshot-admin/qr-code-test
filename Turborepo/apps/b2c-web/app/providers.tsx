"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { Toaster } from "react-hot-toast";
import { useEffect, useRef } from "react";
import { GlobalModalProvider } from "@/components/GlobalModal";

/**
 * 세션 에러 감시 + 동기화 진단 컴포넌트
 *
 * - RefreshAccessTokenError 감지 시 경고만 찍고 세션 유지
 * - 마운트 시 /api/auth/session을 직접 fetch하여 useSession과 비교 진단
 */
function SessionGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const hasLoggedWarning = useRef(false);
  const hasDiagnosed = useRef(false);

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

  // 마운트 시 1회: /api/auth/session 직접 호출 vs useSession 비교
  useEffect(() => {
    if (hasDiagnosed.current) return;
    hasDiagnosed.current = true;

    fetch("/api/auth/session", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        const hasApiSession = !!(data?.user);
        console.log("[SESSION_DIAG] 🔍 /api/auth/session 직접 호출 결과:", {
          hasUser: hasApiSession,
          email: data?.user?.email || "없음",
          role: data?.user?.role || "없음",
          error: data?.error || "없음",
        });
        console.log("[SESSION_DIAG] 🔍 useSession() 상태:", {
          status,
          hasSession: !!session,
        });
        if (hasApiSession && status === "unauthenticated") {
          console.error(
            "[SESSION_DIAG] ❌ 불일치! API는 세션 있음, useSession은 unauthenticated",
            "\n→ 원인 후보: 쿠키 도메인/경로 불일치, SessionProvider 미래핑, 또는 SSR/CSR 쿠키 전달 실패"
          );
        }
      })
      .catch(err => {
        console.error("[SESSION_DIAG] ❌ /api/auth/session fetch 실패:", err);
      });
  }, [status, session]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""}>
      <SessionProvider
        refetchInterval={5 * 60}
        refetchOnWindowFocus={true}
      >
        <GlobalModalProvider>
          <SessionGuard>{children}</SessionGuard>
        </GlobalModalProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: "#F0F4FF",
              color: "#1A1A1A",
              borderRadius: "16px",
              padding: "12px 20px",
              fontSize: "14px",
              fontWeight: 600,
              boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
            },
            success: {
              iconTheme: {
                primary: "var(--cheiz-primary)",
                secondary: "#F0F4FF",
              },
            },
          }}
        />
      </SessionProvider>
    </GoogleOAuthProvider>
  );
}
