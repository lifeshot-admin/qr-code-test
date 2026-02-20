/**
 * 유틸리티 함수 모음
 */

// ━━━ 시간대 보정 (Asia/Tokyo = Asia/Seoul = UTC+9) ━━━

/**
 * 투어 현지 시간대 (일본/한국 = UTC+9)
 * toLocaleString 계열에 반드시 이 값을 넘겨야 서버(UTC)/브라우저(다양) 환경에서 동일 결과
 */
const TOUR_TIMEZONE = "Asia/Tokyo";

/**
 * ISO 8601 문자열을 Date 객체로 변환
 * (주의: 이 Date는 UTC 기반이므로, 표시 시 반드시 timeZone 옵션 사용)
 */
export function toKST(isoOrTimeStr: string): Date {
  const date = new Date(isoOrTimeStr);
  if (!isNaN(date.getTime())) return date;

  // "HH:mm:ss" 패턴이면 오늘 날짜 + 시간 (타임존 보정은 표시 단계에서 처리)
  const timeMatch = isoOrTimeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeMatch) {
    const now = new Date();
    now.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]), parseInt(timeMatch[3] || "0"), 0);
    return now;
  }
  return date;
}

/**
 * 백엔드 시간 → "오후 01:30" 형식 (KST/JST 기준)
 * timeZone 명시로 서버/클라이언트 환경 무관하게 동일 결과
 */
export function formatKSTTime(isoOrTimeStr: string): string {
  const date = toKST(isoOrTimeStr);
  if (isNaN(date.getTime())) return isoOrTimeStr;
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: TOUR_TIMEZONE,
  });
}

/**
 * 백엔드 날짜 → "2026년 2월 15일 (토)" 형식 (KST/JST 기준)
 */
export function formatKSTDate(isoStr: string): string {
  const date = toKST(isoStr);
  if (isNaN(date.getTime())) return isoStr;
  const dateStr = date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: TOUR_TIMEZONE,
  });
  const dayName = date.toLocaleDateString("ko-KR", {
    weekday: "short",
    timeZone: TOUR_TIMEZONE,
  });
  return `${dateStr} (${dayName})`;
}

/**
 * ISO 시간 → "09:20" 형식 (24시간, KST/JST 기준)
 * 투어 상세 페이지의 스케줄 시간에 사용
 */
export function formatKST24Time(isoStr: string): string {
  const date = new Date(isoStr);
  if (isNaN(date.getTime())) {
    const match = isoStr.match(/T(\d{2}:\d{2})/);
    return match ? match[1] : isoStr;
  }
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TOUR_TIMEZONE,
  });
}

/**
 * ISO 날짜 → { m: 월, d: 일, day: 요일 } (KST/JST 기준)
 * 투어 상세 페이지의 스케줄 날짜 버튼에 사용
 */
export function formatKSTDateParts(isoStr: string): { m: number; d: number; day: string } {
  const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"] as const;
  const date = new Date(isoStr);
  if (isNaN(date.getTime())) {
    return { m: 0, d: 0, day: "" };
  }
  // timeZone을 적용하여 정확한 월/일/요일 추출
  const parts = new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    timeZone: TOUR_TIMEZONE,
  }).formatToParts(date);

  let m = 0, d = 0, dayStr = "";
  for (const p of parts) {
    if (p.type === "month") m = parseInt(p.value);
    if (p.type === "day") d = parseInt(p.value);
    if (p.type === "weekday") dayStr = p.value.replace(".", "");
  }
  return { m, d, day: dayStr };
}

// ━━━ 크레딧 용어 매핑 (가치 중심 명칭) ━━━

export const CREDIT_LABELS = {
  photo: {
    name: "사진 다운로드권",
    description: "사진 1장 무료 다운로드",
    detailDescription: "사진 1장 무료 다운로드",
    short: "다운로드권",
  },
  ai: {
    name: "AI 자동 리터칭권",
    description: "투어 모든 사진 AI 리터칭",
    detailDescription: "약 3만 인스타 사진 작가의 색감을 학습한 AI가 투어 모든 사진을 자동 리터칭",
    short: "AI 리터칭권",
  },
  retouch: {
    name: "작가 정밀 리터칭 보정권",
    description: "작가 직접 손터칭 1장",
    detailDescription: "작가가 1장을 직접 손터칭하여 피부부터 인물보정을 직접 하나하나 정밀 보정",
    short: "작가 보정권",
  },
} as const;

/**
 * 크레딧 충전 내역을 가치 중심 용어로 변환
 */
export function formatCreditSummary(credits: {
  photoCredits?: number;
  aiCredits?: number;
  retouchCredits?: number;
}): string {
  const parts: string[] = [];
  if (credits.photoCredits && credits.photoCredits > 0)
    parts.push(`${CREDIT_LABELS.photo.name} ${credits.photoCredits}장`);
  if (credits.aiCredits && credits.aiCredits > 0)
    parts.push(`${CREDIT_LABELS.ai.name} ${credits.aiCredits}회`);
  if (credits.retouchCredits && credits.retouchCredits > 0)
    parts.push(`${CREDIT_LABELS.retouch.name} ${credits.retouchCredits}회`);
  return parts.join(", ");
}
