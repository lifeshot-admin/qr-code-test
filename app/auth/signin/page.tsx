"use client";

import { signIn, getSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { checkEmail } from "@/lib/api-client";
import { GoogleLogin, CredentialResponse } from "@react-oauth/google";

// ─── useSearchParams를 Suspense 내부에서 사용하기 위한 래퍼 ───
function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [phase, setPhase] = useState<"email" | "password">("email");
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
        const session = await getSession();
        if ((session as any)?.accessToken) {
          sessionStorage.setItem("auth_token", (session as any).accessToken);
        }
        window.location.href = callbackUrl;
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
        const session = await getSession();
        if ((session as any)?.accessToken) {
          sessionStorage.setItem("auth_token", (session as any).accessToken);
        }
        window.location.href = callbackUrl;
      }
    } catch {
      setError("로그인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setPhase("email");
    setPassword("");
    setError("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-skyblue to-blue-600 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 md:p-12"
      >
        {/* 로고 & 환영 */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-skyblue mb-2">Cheiz</h1>
          <p className="text-gray-400 text-sm">오늘 우리, 어떤 포즈로 찍어볼까?</p>
        </motion.div>

        {/* ─── Phase: 이메일 입력 또는 비밀번호 입력 ─── */}
        <AnimatePresence mode="wait">
          {phase === "email" ? (
            <motion.div
              key="email-phase"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-3"
            >
              <input
                type="email"
                placeholder="이메일"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleEmailNext(); }}
                disabled={loading}
                className="w-full px-4 py-3.5 bg-transparent border border-gray-200 rounded-2xl focus:outline-none focus:border-skyblue text-black text-sm transition-all placeholder:text-gray-300 disabled:opacity-50"
              />

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-500 text-xs text-center bg-red-50 py-2 rounded-xl"
                >
                  {error}
                </motion.p>
              )}

              <button
                onClick={handleEmailNext}
                disabled={loading || !email}
                className="w-full bg-gray-800 text-white font-semibold py-3.5 rounded-2xl hover:bg-gray-700 transition-all transform hover:scale-[1.02] disabled:opacity-50 text-sm"
              >
                {loading ? "확인 중..." : "다음"}
              </button>
            </motion.div>
          ) : (
            <motion.form
              key="password-phase"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              onSubmit={handleLogin}
              className="space-y-3"
            >
              <div className="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-2xl">
                <span className="text-sm text-gray-700 font-medium truncate">{email}</span>
                <button
                  type="button"
                  onClick={handleBackToEmail}
                  className="text-xs text-skyblue hover:underline whitespace-nowrap ml-2"
                >
                  변경
                </button>
              </div>

              <input
                type="password"
                placeholder="비밀번호"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                autoFocus
                disabled={loading}
                className="w-full px-4 py-3.5 bg-transparent border border-gray-200 rounded-2xl focus:outline-none focus:border-skyblue text-black text-sm transition-all placeholder:text-gray-300 disabled:opacity-50"
              />

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-500 text-xs text-center bg-red-50 py-2 rounded-xl"
                >
                  {error}
                </motion.p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gray-800 text-white font-semibold py-3.5 rounded-2xl hover:bg-gray-700 transition-all transform hover:scale-[1.02] disabled:opacity-50 text-sm"
              >
                {loading ? "로그인 중..." : "로그인"}
              </button>

              <div className="flex items-center justify-center gap-3 pt-1">
                <Link
                  href="/auth/reset-password"
                  className="text-xs text-gray-400 hover:text-skyblue transition-colors"
                >
                  비밀번호를 잊으셨나요?
                </Link>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* ─── 구분선: "또는" ─── */}
        <div className="flex items-center gap-4 my-7">
          <div className="flex-1 h-px bg-gray-200"></div>
          <span className="text-gray-400 text-xs font-medium">또는</span>
          <div className="flex-1 h-px bg-gray-200"></div>
        </div>

        {/* ─── 소셜 로그인 ─── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          {/* 툴팁 */}
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.4 }}
            className="flex justify-center mb-3"
          >
            <div className="relative">
              <div className="bg-gray-800 text-white text-[11px] px-4 py-1.5 rounded-full font-medium shadow-lg">
                회원가입 없이 3초만에 로그인
              </div>
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-800 rotate-45 rounded-sm"></div>
            </div>
          </motion.div>

          {/* 카카오 로그인 */}
          <motion.button
            onClick={() => signIn("kakao", { callbackUrl })}
            disabled={googleLoading}
            className="w-full bg-[#FEE500] text-[#3C1E1E] font-bold py-4 rounded-2xl shadow-lg flex items-center justify-center gap-3 relative overflow-hidden disabled:opacity-50"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            animate={{
              boxShadow: [
                "0 4px 15px rgba(254, 229, 0, 0.3)",
                "0 8px 30px rgba(254, 229, 0, 0.5)",
                "0 4px 15px rgba(254, 229, 0, 0.3)",
              ],
            }}
            transition={{
              boxShadow: { repeat: Infinity, duration: 2, ease: "easeInOut" },
            }}
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="#3C1E1E">
              <path d="M12 3C6.477 3 2 6.477 2 10.5c0 2.442 1.443 4.615 3.693 6.115l-.964 3.502c-.066.243.169.446.395.346l4.202-1.856C10.153 18.857 11.057 19 12 19c5.523 0 10-3.477 10-7.5S17.523 3 12 3z" />
            </svg>
            <span className="text-[15px]">3초만에 로그인하기</span>
            <span className="absolute top-2 right-2 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3C1E1E]/20"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#3C1E1E]/10"></span>
            </span>
          </motion.button>

          <p className="text-center text-[11px] text-gray-400 mt-3">
            카카오 계정으로 간편하게 로그인하세요.
            <br />
            처음 방문하시는 경우 자동으로 회원가입됩니다.
          </p>

          {/* ─── 구글 로그인 ─── */}
          <div className="w-full mt-3 flex flex-col items-center">
            {googleLoading ? (
              <div className="w-full bg-white text-gray-500 font-bold py-4 rounded-2xl shadow-lg flex items-center justify-center gap-3 border border-gray-200">
                <svg className="animate-spin w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                </svg>
                <span className="text-[15px]">로그인 중...</span>
              </div>
            ) : (
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setGoogleError("구글 로그인에 실패했습니다. 다시 시도해주세요.")}
                width="400"
                theme="outline"
                size="large"
                shape="pill"
                text="continue_with"
              />
            )}
          </div>

          {googleError && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-500 text-xs text-center bg-red-50 py-2 rounded-xl mt-2"
            >
              {googleError}
            </motion.p>
          )}

          <p className="text-center text-[11px] text-gray-400 mt-2">
            구글 계정으로 간편하게 로그인하세요.
            <br />
            처음 방문하시는 경우 자동으로 회원가입됩니다.
          </p>
        </motion.div>

        {/* 홈으로 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="text-center mt-6"
        >
          <Link
            href="/"
            className="text-gray-400 hover:text-skyblue transition-colors text-xs"
          >
            홈으로 돌아가기
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}

// ─── Suspense 래퍼 (useSearchParams 필수) ───
export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-skyblue to-blue-600 flex items-center justify-center">
        <div className="text-white text-lg">로딩 중...</div>
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
}
