"use client";

import { usePathname } from "next/navigation";
import { Providers } from "./providers";
import BottomNav from "./components/BottomNav";

export default function CheizLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // ━━━ 메뉴바 숨김 경로: 예약 플로우 + 폴더(사진확인~결제) 구매 몰입 모드 ━━━
  const isReserveFlow = pathname.startsWith("/cheiz/reserve");
  const isFolderFlow = pathname.startsWith("/cheiz/folder");
  const isRetoucherPage = pathname.startsWith("/cheiz/retoucher");
  const isImmersive = isReserveFlow || isFolderFlow || isRetoucherPage;

  return (
    <Providers>
      <div className={`min-h-screen bg-white ${isImmersive ? "" : "pb-16"}`}>
        {children}
      </div>
      {!isImmersive && <BottomNav />}
    </Providers>
  );
}
