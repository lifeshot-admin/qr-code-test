"use client";

import { signIn, getSession, useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

const ADMIN_ROLES = ["Admin", "SuperAdmin", "ROLE_ADMIN"];

function AdminLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/admin";
  const { data: session, status: sessionStatus } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (sessionStatus === "authenticated" && session?.user?.role) {
      if (ADMIN_ROLES.includes(session.user.role)) {
        router.replace(callbackUrl);
      } else {
        setError("관리자 권한이 없는 계정입니다.");
      }
    }
  }, [sessionStatus, session, router, callbackUrl]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("로그인에 실패했습니다. 이메일 또는 비밀번호를 확인해주세요.");
        setLoading(false);
        return;
      }

      const freshSession = await getSession();
      const userRole = (freshSession as any)?.user?.role || "";

      if (!ADMIN_ROLES.includes(userRole)) {
        setError("관리자 권한이 없는 계정입니다. 일반 사용자는 메인 로그인을 이용해주세요.");
        setLoading(false);
        return;
      }

      if ((freshSession as any)?.accessToken) {
        sessionStorage.setItem("auth_token", (freshSession as any).accessToken);
      }
      router.replace(callbackUrl);
    } catch {
      setError("로그인 중 오류가 발생했습니다.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="max-w-md w-full"
      >
        {/* 헤더 */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="text-center mb-10"
        >
          <div className="w-16 h-16 bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">CHEIZ Admin</h1>
          <p className="text-gray-400 text-sm">관리자 전용 로그인</p>
        </motion.div>

        {/* 로그인 폼 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <form onSubmit={handleLogin} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="admin@cheiz.com"
                disabled={loading}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 placeholder:text-gray-500 disabled:opacity-50 transition-all"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder="••••••••"
                disabled={loading}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 placeholder:text-gray-500 disabled:opacity-50 transition-all"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/20 rounded-xl py-2.5 px-4"
              >
                <p className="text-red-400 text-xs text-center">{error}</p>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full bg-white text-gray-900 font-semibold py-3.5 rounded-xl hover:bg-gray-100 transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  인증 중...
                </>
              ) : (
                "관리자 로그인"
              )}
            </button>
          </form>

          <div className="text-center mt-6">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-300 transition-colors text-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              메인으로 돌아가기
            </Link>
          </div>

          <p className="text-center text-[10px] text-gray-600 mt-4">
            이 페이지는 관리자 전용입니다.<br />
            일반 사용자는 메인 로그인 페이지를 이용해주세요.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-white border-solid"></div>
      </div>
    }>
      <AdminLoginContent />
    </Suspense>
  );
}
