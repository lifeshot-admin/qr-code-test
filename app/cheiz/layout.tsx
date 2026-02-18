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

  // ━━━ 메뉴바 숨김 경로: 예약 플로우 + 폴더 + 리터처 + 이벤트 상세 + 앨범 상세 ━━━
  const isReserveFlow = pathname.startsWith("/cheiz/reserve");
  const isFolderFlow = pathname.startsWith("/cheiz/folder");
  const isRetoucherPage = pathname.startsWith("/cheiz/retoucher");
  const isEventDetail = /^\/cheiz\/events\/.+/.test(pathname);
  const isAlbumDetail = /^\/cheiz\/albums\/.+/.test(pathname);
  const isImmersive = isReserveFlow || isFolderFlow || isRetoucherPage || isEventDetail || isAlbumDetail;

  return (
    <Providers>
      <div className={`min-h-screen bg-white ${isImmersive ? "" : "pb-16"}`}>
        {children}
      </div>
      {!isImmersive && <BottomNav />}
    </Providers>
  );
}
