import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cheiz - 일본 포토 투어 예약",
  description: "일본에서의 특별한 순간을 포착하는 포토 투어 예약 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body className="antialiased bg-white">
        {children}
      </body>
    </html>
  );
}
