import Link from "next/link";
import { Providers } from "./providers";

export default function CheizLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/cheiz" className="text-2xl font-bold text-skyblue hover:opacity-80 transition-opacity">
            Cheiz
          </Link>
          <div className="flex gap-6 items-center">
            <Link
              href="/cheiz"
              className="text-gray-700 hover:text-skyblue font-medium transition-colors"
            >
              홈
            </Link>
            <Link
              href="/cheiz/my-tours"
              className="text-gray-700 hover:text-skyblue font-medium transition-colors"
            >
              마이페이지
            </Link>
          </div>
        </div>
      </nav>
      {children}
    </Providers>
  );
}
