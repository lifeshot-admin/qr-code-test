/**
 * 리뷰 UI 전용 다국어 문자열
 *
 * getAppLanguage()의 반환값("ko"|"en"|"ja"|"zh")을 키로 사용.
 * 새 키를 추가할 때는 반드시 4개 언어 모두 채울 것.
 */

type Lang = "ko" | "en" | "ja" | "zh";

const dict: Record<string, Record<Lang, string>> = {
  colorGradePending1: {
    ko: "지금 치이즈가 가장 맛있는 색으로 익어가고 있어요...🧀",
    en: "CHEIZ is ripening your photos to the most delicious colors...🧀",
    ja: "今チーズが一番おいしい色に仕上がっています...🧀",
    zh: "CHEIZ正在将您的照片调整到最美味的颜色...🧀",
  },
  colorGradePending2: {
    ko: "여행의 조각들을 예쁘게 빚어내고 있습니다. 잠시만 기다려주세요! ✨",
    en: "Crafting the beautiful pieces of your journey. Please wait! ✨",
    ja: "旅の思い出を美しく仕上げています。少々お待ちください！ ✨",
    zh: "正在精心打磨您旅途的美好碎片，请稍等！ ✨",
  },
  colorGradePending3: {
    ko: "자꾸만 꺼내보고 싶은 선물을 준비 중이에요 🎁",
    en: "Preparing a gift you'll want to revisit again and again 🎁",
    ja: "何度も見返したくなるプレゼントを準備中です 🎁",
    zh: "正在准备一份让您爱不释手的礼物 🎁",
  },
  colorGradeCompleted: {
    ko: "여행의 색을 찾았습니다",
    en: "We found the colors of your journey",
    ja: "旅の色を見つけました",
    zh: "找到了您旅途的颜色",
  },
  ripeningCaption: {
    ko: "여행의 추억이 가장 맛있는 색으로 익어가고 있어요...🧀",
    en: "Your travel memories are ripening to the most delicious colors...🧀",
    ja: "旅の思い出が一番おいしい色に熟成中です...🧀",
    zh: "旅行的回忆正在酝酿成最美味的颜色...🧀",
  },
  correctedBadge: {
    ko: "전문가 보정이 완료된 사진입니다 ✨",
    en: "Professionally color-graded photo ✨",
    ja: "専門家による補正が完了した写真です ✨",
    zh: "专业校色完成的照片 ✨",
  },
  personaFamily: {
    ko: "가족",
    en: "Family",
    ja: "家族",
    zh: "家庭",
  },
  personaCouple: {
    ko: "커플",
    en: "Couple",
    ja: "カップル",
    zh: "情侣",
  },
  personaSolo: {
    ko: "1인",
    en: "Solo",
    ja: "一人",
    zh: "一人",
  },
  personaFriends: {
    ko: "친구",
    en: "Friends",
    ja: "友達",
    zh: "朋友",
  },
  guestSuffix: {
    ko: "인",
    en: "",
    ja: "人",
    zh: "人",
  },
};

export function t(key: string, lang: string = "ko"): string {
  const normalizedLang = (lang || "ko") as Lang;
  return dict[key]?.[normalizedLang] ?? dict[key]?.ko ?? key;
}

const PENDING_KEYS = [
  "colorGradePending1",
  "colorGradePending2",
  "colorGradePending3",
] as const;

export function getRandomPendingMessage(lang: string = "ko"): string {
  const idx = Math.floor(Math.random() * PENDING_KEYS.length);
  return t(PENDING_KEYS[idx], lang);
}

const PERSONA_EMOJI: Record<string, string> = {
  family: "👨‍👩‍👧‍👦",
  couple: "👩‍❤️‍👨",
  solo: "🙋‍♂️",
  friends: "👯‍♀️",
};

const PERSONA_KEY: Record<string, string> = {
  family: "personaFamily",
  couple: "personaCouple",
  solo: "personaSolo",
  friends: "personaFriends",
  "가족": "personaFamily",
  "커플": "personaCouple",
  "1인": "personaSolo",
  "친구": "personaFriends",
};

export function formatPersona(
  persona?: string | null,
  guestCount?: number | null,
  lang: string = "ko"
): string {
  if (!persona) return "";
  const key = persona.toLowerCase();
  const emoji = PERSONA_EMOJI[key] || PERSONA_EMOJI[persona] || "👤";
  const label = t(PERSONA_KEY[key] || PERSONA_KEY[persona] || "personaSolo", lang);
  const suffix = t("guestSuffix", lang);

  if (guestCount && guestCount > 0) {
    return `${emoji} ${label} · ${guestCount}${suffix}`;
  }
  return `${emoji} ${label}`;
}
