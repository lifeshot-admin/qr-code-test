"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

/**
 * Redirect to /cheiz/reserve/spots
 * 라우팅 분리로 인해 이 페이지는 spots로 리디렉션합니다.
 */
function ReserveContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  useEffect(() => {
    const tourId = searchParams.get("tour_id");
    const code = searchParams.get("code");
    if (tourId) {
      const params = new URLSearchParams({ tour_id: tourId });
      if (code) {
        params.set("code", code);
      }
      router.replace(`/cheiz/reserve/spots?${params.toString()}`);
    } else {
      router.replace("/cheiz/reserve/spots");
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-skyblue border-solid mx-auto mb-4"></div>
        <p className="text-gray-600">리디렉션 중...</p>
      </div>
    </div>
  );
}

export default function ReservePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-skyblue border-solid"></div>
      </div>
    }>
      <ReserveContent />
    </Suspense>
  );
}
