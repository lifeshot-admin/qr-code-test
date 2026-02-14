"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, Suspense } from "react";

/**
 * /photographer/scan?reservation_id=xxx
 * 
 * QR 코드에서 이 URL로 진입합니다.
 * reservation_id를 받아서 /photographer?page=auth&reservation=xxx 로 리다이렉트하여
 * 바로 인증사진 촬영 단계로 진입합니다.
 */
function ScanRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const reservationId = searchParams.get("reservation_id");

    if (reservationId) {
      // QR 스캔 성공 → 바로 인증사진 촬영(auth) 단계로 이동
      router.replace(`/photographer?page=auth&reservation=${encodeURIComponent(reservationId)}`);
    } else {
      // reservation_id 없으면 스캔 화면으로
      router.replace("/photographer?page=scan");
    }
  }, [searchParams, router]);

  return (
    <div className="h-screen flex items-center justify-center bg-black">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-skyblue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white text-sm">QR 코드 처리 중...</p>
      </div>
    </div>
  );
}

export default function ScanPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-black">
          <div className="w-12 h-12 border-4 border-skyblue border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ScanRedirect />
    </Suspense>
  );
}
