/**
 * Locale Layout — 다국어 라우트 래퍼
 *
 * app/[locale]/tours/[id] 등의 경로에서 사용
 * Root layout(app/layout.tsx)의 Providers(SessionProvider 등)를 그대로 상속
 */
export default function LocaleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
