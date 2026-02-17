/**
 * 글로벌 언어 결정 함수
 *
 * 우선순위:
 *   1. 로그인 시 → User 엔티티의 lan 필드 (session.user.lan)
 *   2. URL의 [locale] 경로값 (예: /ko, /ja, /en)
 *   3. 브라우저 Accept-Language (navigator.language)
 *   4. 기본값: "ko"
 *
 * 사용법:
 *   const lang = getAppLanguage({ userLan: session?.user?.lan, urlLocale: locale });
 *   await fetchTours(lang);
 */

const SUPPORTED_LOCALES = ["ko", "ja", "en", "zh"] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * 언어 코드 정규화
 * "ja-JP" → "ja", "ko-KR" → "ko", "unknown" → "ko"
 */
function normalizeLocale(raw: string): SupportedLocale {
  const code = raw.toLowerCase().split("-")[0].split("_")[0];
  if ((SUPPORTED_LOCALES as readonly string[]).includes(code)) {
    return code as SupportedLocale;
  }
  return "ko"; // 지원하지 않는 언어는 한국어로 기본 처리
}

/**
 * 앱 전역 언어 결정 함수
 *
 * @param options.userLan  - 세션 유저의 lan 필드 (로그인 시)
 * @param options.urlLocale - URL 경로의 locale 값 (/ko, /ja 등)
 * @returns 결정된 언어 코드 ("ko" | "ja" | "en" | "zh")
 */
export function getAppLanguage(options: {
  userLan?: string | null;
  urlLocale?: string | null;
}): SupportedLocale {
  // 1순위: 유저 세션에 저장된 언어 설정 (User 엔티티 lan 필드)
  if (options.userLan) {
    const lang = normalizeLocale(options.userLan);
    console.log(`🌐 [Locale] 유저 언어 사용: ${options.userLan} → ${lang}`);
    return lang;
  }

  // 2순위: URL 경로의 locale
  if (options.urlLocale) {
    const lang = normalizeLocale(options.urlLocale);
    console.log(`🌐 [Locale] URL locale 사용: ${options.urlLocale} → ${lang}`);
    return lang;
  }

  // 3순위: 브라우저 언어 (클라이언트 전용)
  if (typeof window !== "undefined" && navigator.language) {
    const lang = normalizeLocale(navigator.language);
    console.log(`🌐 [Locale] 브라우저 언어 사용: ${navigator.language} → ${lang}`);
    return lang;
  }

  // 4순위: 기본값
  console.log(`🌐 [Locale] 기본값 사용: ko`);
  return "ko";
}
