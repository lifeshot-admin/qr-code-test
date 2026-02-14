"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("🚨 [APP ERROR]", error.message);
    console.error("🚨 [APP ERROR] Stack:", error.stack);
  }, [error]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-6">⚠️</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-4">오류가 발생했습니다</h1>
        <p className="text-gray-600 mb-2">{error.message}</p>
        {error.digest && (
          <p className="text-xs text-gray-400 mb-6">Error ID: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="bg-skyblue text-white font-bold py-3 px-8 rounded-2xl hover:bg-opacity-90 transition-all"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}
