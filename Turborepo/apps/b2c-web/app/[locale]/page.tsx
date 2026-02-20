"use client";

/**
 * Locale 메인 페이지 → /cheiz로 리다이렉트
 *
 * 서비스 메인은 /cheiz로 통일되었습니다.
 * /ko, /en 등으로 접근 시 /cheiz로 자동 이동합니다.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LocaleHomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/cheiz");
  }, [router]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-cheiz-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400">이동 중...</p>
      </div>
    </div>
  );
}
