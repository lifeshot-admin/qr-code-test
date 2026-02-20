"use client";

import { signIn, getSession, useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { checkEmail } from "@/lib/api-client";
import { GoogleLogin, CredentialResponse } from "@react-oauth/google";
import { ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import Button from "@/components/ui/Button";

// ─── useSearchParams를 Suspense 내부에서 사용하기 위한 래퍼 ───
function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const { data: session, status: sessionStatus } = useSession();

  // ✅ 이미 로그인된 유저는 즉시 callbackUrl로 보내기 (카카오 등 외부 리다이렉트 후 복귀)
  useEffect(() => {
    if (sessionStatus === "authenticated" && session) {
      toast.success("로그인이 성공적으로 되었습니다! 🎉");
      router.replace(callbackUrl);
    }
  }, [sessionStatus, session, router, callbackUrl]);

  const [phase, setPhase] = useState<"social" | "email" | "password">("social");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState("");

  // ─── 구글 로그인 성공 핸들러 ───
  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      setGoogleError("구글에서 인증 토큰을 받지 못했습니다.");
      return;
    }

    setGoogleLoading(true);
    setGoogleError("");

    try {
      const result = await signIn("google-direct", {
        idToken: credentialResponse.credential,
        redirect: false,
      });

      if (result?.error) {
        setGoogleError("구글 로그인에 실패했습니다. 다시 시도해주세요.");
      } else if (result?.ok) {
        const freshSession = await getSession();
        if ((freshSession as any)?.accessToken) {
          sessionStorage.setItem("auth_token", (freshSession as any).accessToken);
        }
        toast.success("로그인이 성공적으로 되었습니다! 🎉");
        router.replace(callbackUrl);
      }
    } catch {
      setGoogleError("구글 로그인 중 오류가 발생했습니다.");
    } finally {
      setGoogleLoading(false);
    }
  };

  // ─── 이메일 가입여부 확인 ───
  const handleEmailNext = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setError("유효한 이메일 주소를 입력해주세요.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await checkEmail(email);

      if (response.available) {
        router.push(`/auth/signup?email=${encodeURIComponent(email)}`);
      } else {
        setPhase("password");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const statusMatch = msg.match(/(\d{3})/);
      const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : 0;

      if (statusCode === 404 || msg.includes("404") || msg.includes("not found") || msg.includes("Not Found") || msg.includes("찾을 수 없")) {
        router.push(`/auth/signup?email=${encodeURIComponent(email)}`);
        return;
      }
      if (statusCode === 409 || msg.includes("409") || msg.includes("이미") || msg.includes("exist") || msg.includes("중복")) {
        setPhase("password");
        return;
      }
      if (statusCode >= 500) {
        setError("서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      } else {
        router.push(`/auth/signup?email=${encodeURIComponent(email)}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── 비밀번호 로그인 ───
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("로그인에 실패했습니다. 비밀번호를 확인해주세요.");
      } else {
        const freshSession = await getSession();
        if ((freshSession as any)?.accessToken) {
          sessionStorage.setItem("auth_token", (freshSession as any).accessToken);
        }
        toast.success("로그인이 성공적으로 되었습니다! 🎉");
        router.replace(callbackUrl);
      }
    } catch {
      setError("로그인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setPhase("social");
    setPassword("");
    setError("");
  };

  return (
    <div className="relative min-h-screen max-w-sm mx-auto overflow-hidden">
      {/* ═══ Full-screen 배경 이미지 ═══ */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/login-bg.jpg')" }}
      />
      <div className="absolute inset-0 bg-black/20" />

      {/* ═══ 우상단 닫기 ═══ */}
      <Link href="/" className="absolute top-4 right-4 z-20 text-white/80 hover:text-white">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </Link>

      {/* ═══ 하단 Frosted Glass 카드 ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="absolute bottom-0 inset-x-0 z-10 bg-white/80 backdrop-blur-md rounded-t-3xl px-6 pt-8 pb-10"
      >
        {/* 로고 */}
        <h1 className="text-center text-2xl font-bold text-cheiz-primary mb-6">
          Cheiz
        </h1>

        <AnimatePresence mode="wait">
          {phase === "social" && (
            <motion.div
              key="social-phase"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {/* 카카오 로그인 */}
              <button
                onClick={() => signIn("kakao", { callbackUrl })}
                disabled={googleLoading}
                className="w-full bg-[#FEE500] text-[#3C1E1E] font-semibold py-4 rounded-full flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="#3C1E1E">
                  <path d="M12 3C6.477 3 2 6.477 2 10.5c0 2.442 1.443 4.615 3.693 6.115l-.964 3.502c-.066.243.169.446.395.346l4.202-1.856C10.153 18.857 11.057 19 12 19c5.523 0 10-3.477 10-7.5S17.523 3 12 3z" />
                </svg>
                카카오로 시작하기
              </button>

              {/* 구글 로그인 */}
              {googleLoading ? (
                <div className="w-full border border-cheiz-border bg-white text-cheiz-text font-medium py-4 rounded-full flex items-center justify-center gap-2.5">
                  <span className="w-4 h-4 border-2 border-cheiz-sub border-t-transparent rounded-full animate-spin" />
                  로그인 중...
                </div>
              ) : (
                <button
                  onClick={() => {
                    const gBtn = document.querySelector('[data-type="standard"]') as HTMLElement;
                    if (gBtn) gBtn.click();
                  }}
                  className="w-full border border-cheiz-border bg-white text-cheiz-text font-medium py-4 rounded-full flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 001 12c0 1.94.46 3.77 1.18 5.39l3.66-2.84z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  구글로 시작하기
                </button>
              )}

              {/* 숨겨진 GoogleLogin 원본 */}
              <div className="hidden">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setGoogleError("구글 로그인에 실패했습니다.")}
                  width="400"
                  theme="outline"
                  size="large"
                  shape="pill"
                  text="continue_with"
                />
              </div>

              {googleError && (
                <p className="text-red-500 text-xs text-center bg-red-50 py-2 rounded-xl">
                  {googleError}
                </p>
              )}

              {/* 이메일 로그인 (텍스트 버튼) */}
              <Button variant="text" onClick={() => setPhase("email")} className="w-full text-center pt-2">
                이메일로 시작하기
              </Button>
            </motion.div>
          )}

          {phase === "email" && (
            <motion.div
              key="email-phase"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-3"
            >
              <input
                type="email"
                placeholder="이메일"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleEmailNext(); }}
                disabled={loading}
                className="w-full px-4 py-3.5 bg-white border border-cheiz-border rounded-xl focus:outline-none focus:border-cheiz-primary focus:ring-1 focus:ring-cheiz-primary/20 text-cheiz-text text-sm transition-all placeholder:text-cheiz-sub disabled:opacity-50"
              />
              {error && <p className="text-red-500 text-xs text-center">{error}</p>}
              <Button onClick={handleEmailNext} disabled={loading || !email} loading={loading}>
                다음
              </Button>
              <Button variant="text" onClick={() => setPhase("social")} className="w-full text-center pt-1">
                뒤로
              </Button>
            </motion.div>
          )}

          {phase === "password" && (
            <motion.div
              key="password-phase"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <form onSubmit={handleLogin} className="space-y-3">
                <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-cheiz-border">
                  <span className="text-sm text-cheiz-text font-medium truncate">{email}</span>
                  <button type="button" onClick={handleBackToEmail} className="text-xs text-cheiz-primary whitespace-nowrap ml-2">변경</button>
                </div>
                <input
                  type="password"
                  placeholder="비밀번호"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  autoFocus
                  disabled={loading}
                  className="w-full px-4 py-3.5 bg-white border border-cheiz-border rounded-xl focus:outline-none focus:border-cheiz-primary focus:ring-1 focus:ring-cheiz-primary/20 text-cheiz-text text-sm transition-all placeholder:text-cheiz-sub disabled:opacity-50"
                />
                {error && <p className="text-red-500 text-xs text-center">{error}</p>}
                <Button type="submit" disabled={loading} loading={loading}>
                  로그인
                </Button>
                <Link href="/auth/reset-password" className="block text-center text-cheiz-sub text-xs pt-1">비밀번호를 잊으셨나요?</Link>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ─── Suspense 래퍼 (useSearchParams 필수) ───
export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-cheiz-primary border-solid"></div>
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
}
