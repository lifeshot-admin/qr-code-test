import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Cheiz - 포즈 예약 서비스",
  description: "당신의 특별한 순간을 포즈로 남기세요",
  appleWebApp: { capable: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased bg-black text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
