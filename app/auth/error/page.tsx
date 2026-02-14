"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Suspense } from "react";

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const errorMessages: Record<string, string> = {
    Configuration: "서버 설정에 문제가 있습니다.",
    AccessDenied: "접근이 거부되었습니다.",
    Verification: "인증 링크가 만료되었습니다.",
    OAuthSignin: "OAuth 로그인에 실패했습니다.",
    OAuthCallback: "OAuth 콜백 처리 중 오류가 발생했습니다.",
    OAuthCreateAccount: "계정 생성에 실패했습니다.",
    EmailCreateAccount: "이메일 계정 생성에 실패했습니다.",
    Callback: "콜백 처리 중 오류가 발생했습니다.",
    OAuthAccountNotLinked: "이미 다른 방법으로 가입된 이메일입니다.",
    EmailSignin: "이메일 전송에 실패했습니다.",
    CredentialsSignin: "로그인 정보가 올바르지 않습니다.",
    SessionRequired: "로그인이 필요합니다.",
    default: "인증 중 오류가 발생했습니다.",
  };

  const message = error ? errorMessages[error] || errorMessages.default : errorMessages.default;

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-md w-full text-center"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-6xl mb-6"
        >
          ⚠️
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-3xl font-bold text-gray-800 mb-4"
        >
          로그인 오류
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-lg text-gray-600 mb-8"
        >
          {message}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="space-y-4"
        >
          <Link
            href="/cheiz"
            className="block w-full bg-skyblue text-white font-bold py-4 px-8 rounded-3xl hover:bg-opacity-90 transition-all transform hover:scale-105 shadow-lg"
          >
            홈으로 돌아가기
          </Link>
          <Link
            href="/api/auth/signin"
            className="block w-full bg-white text-skyblue border-2 border-skyblue font-bold py-4 px-8 rounded-3xl hover:bg-skyblue hover:text-white transition-all"
          >
            다시 로그인하기
          </Link>
        </motion.div>

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="text-sm text-gray-400 mt-8"
          >
            Error Code: {error}
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-skyblue border-solid"></div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  );
}
