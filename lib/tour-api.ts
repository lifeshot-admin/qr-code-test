/**
 * Tour & Schedule API Client (Public/Guest Endpoints)
 *
 * 브라우저: /api/backend/tours 프록시 경유 (CORS 우회)
 * 서버: api.lifeshot.me 직접 호출
 */

const DIRECT_API_BASE =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://api.lifeshot.me";

const isServer = typeof window === "undefined";

// ==================== TYPES ====================

export type TourImage = {
  id: number;
  imageUrl: string;
  imageType: "EXAMPLE" | "ENTRANCE" | "PHOTOGRAPHER_LOCATION" | string;
};

export type CompanyInfo = {
  id: number;
  name: string;
  profileImageUrl?: string;
};

export type TourDetail = {
  id: number;
  name: string;
  description: string;
  location: string;
  locationDetail?: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  googleMapUrl?: string;
  address?: string;
  thumbnailImageUrl?: string;
  isClosed: boolean;
  images: TourImage[];
  companyLocalizedResponse?: CompanyInfo;
  price?: number;
  pricePerPhoto?: number;
  currency?: string;
  participantCount?: number;
  folderCount?: number;
  totalFolders?: number;
  latitude?: number;
  longitude?: number;
  entranceDescription?: string;
  photographerDescription?: string;
  exampleDescription?: string;
  [key: string]: unknown; // 백엔드 추가 필드 유연 대응
};

export type ScheduleItem = {
  id: number;
  startTime: string; // ISO 8601: "2026-03-15T10:00:00"
  endTime: string; // ISO 8601: "2026-03-15T12:00:00"
  isActive: boolean;
  inactiveReason?: string;
  remainingCapacity?: number;
  maxCapacity?: number;
};

type ApiResponse<T> = {
  statusCode: number;
  message: string;
  code: string;
  data: T;
};

// ==================== API FUNCTIONS ====================

/**
 * 투어 목록 조회 (Public — 인증 불필요)
 * GET /api/v1/tours/search
 *
 * ⚠️ /api/v1/tours (끝에 /search 없음)는 401 권한 에러 발생
 * ⚠️ 반드시 /api/v1/tours/search 사용할 것
 *
 * 반환: 현재 활성화된 투어 목록
 */
export async function fetchTours(locale: string = "ko"): Promise<TourDetail[]> {
  const serverParams = new URLSearchParams({ page: "1", size: "10", sortBy: "createdAt", sortDir: "desc" });
  const clientParams = new URLSearchParams({ lang: locale, page: "1", size: "10", sortBy: "createdAt", sortDir: "desc" });

  const url = isServer
    ? `${DIRECT_API_BASE}/api/v1/tours/search?${serverParams.toString()}`
    : `/api/backend/tours?${clientParams.toString()}`;

  try {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔍 [fetchTours] ${isServer ? "SERVER" : "CLIENT"} → GET ${url}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "Accept-Language": locale,
      },
      cache: "no-store",
    });

    console.log(`📡 [fetchTours] HTTP Status: ${res.status}`);

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "(읽기 실패)");
      console.error(`❌ [fetchTours] HTTP ${res.status} — 데이터 수신 실패`);
      console.error(`❌ [fetchTours] URL: ${url}`);
      console.error(`❌ [fetchTours] 서버 응답: ${errorBody.substring(0, 500)}`);
      return [];
    }

    const rawText = await res.text();
    console.log(`📦 [fetchTours] Raw body length: ${rawText.length}`);
    console.log(`📦 [fetchTours] Raw body preview (500자): ${rawText.substring(0, 500)}`);

    let json: any;
    try {
      json = JSON.parse(rawText);
    } catch (parseErr) {
      console.error(`❌ [fetchTours] JSON 파싱 실패! Raw preview:`, rawText.substring(0, 200));
      return [];
    }

    console.log(`📦 [fetchTours] 응답 구조:`, {
      topKeys: Object.keys(json),
      topContentIsArray: Array.isArray(json.content),
      topContentLength: Array.isArray(json.content) ? json.content.length : "N/A",
      hasData: !!json.data,
      dataType: json.data === null ? "null" : typeof json.data,
      dataContentIsArray: Array.isArray(json.data?.content),
      dataIsArray: Array.isArray(json.data),
      topLevelIsArray: Array.isArray(json),
      statusCode: json.statusCode,
      code: json.code,
    });

    // ═══ 투어 배열 추출 (모든 가능한 응답 구조 대응) ═══
    let tours: TourDetail[] = [];
    let extractedFrom = "";

    // 1순위: json.content (백엔드 페이지네이션 직접 반환)
    if (Array.isArray(json.content)) {
      tours = json.content;
      extractedFrom = "json.content";
    }
    // 2순위: json.data.content (Swagger envelope + 페이지네이션)
    else if (Array.isArray(json.data?.content)) {
      tours = json.data.content;
      extractedFrom = "json.data.content";
    }
    // 3순위: json.data 자체가 배열
    else if (Array.isArray(json.data)) {
      tours = json.data;
      extractedFrom = "json.data";
    }
    // 4순위: json 자체가 배열
    else if (Array.isArray(json)) {
      tours = json;
      extractedFrom = "json (root array)";
    }
    // 5순위: json.data가 단일 객체이면서 내부에 content가 있는 경우
    else if (json.data && typeof json.data === "object") {
      const inner = json.data;
      if (Array.isArray(inner.content)) {
        tours = inner.content;
        extractedFrom = "json.data.content (deep)";
      } else {
        const arrField = Object.values(inner).find((v) => Array.isArray(v));
        if (arrField) {
          tours = arrField as TourDetail[];
          extractedFrom = "json.data.[first array field]";
        }
      }
    }

    if (tours.length > 0) {
      console.log(`✅ [fetchTours] "${extractedFrom}" 에서 ${tours.length}개 추출`);
      const sample = tours[0];
      console.log(`📋 [fetchTours] 첫 투어:`, {
        id: sample.id,
        name: sample.name,
        location: sample.location,
        thumb: sample.thumbnailImageUrl?.substring(0, 60),
      });
    } else if (extractedFrom) {
      console.warn(`⚠️ [fetchTours] "${extractedFrom}" 에서 추출했지만 0개`);
    } else {
      console.error(`❌ [fetchTours] 데이터 추출 실패! 응답 키:`, Object.keys(json));
      console.error(`❌ [fetchTours] 전체 응답 (200자):`, JSON.stringify(json).substring(0, 200));
    }

    console.log(`🔥 [fetchTours] 최종 투어 개수: ${tours.length}개`);
    return tours;
  } catch (error) {
    console.error(`❌ [fetchTours] Network error:`, error);
    return [];
  }
}

/**
 * 투어 상세 조회 (Public — 인증 불필요)
 * GET /api/v1/tours/search/{tourId}
 *
 * ⚠️ /api/v1/tours/{id} (search 없음)는 401 에러 발생
 * ⚠️ 반드시 /api/v1/tours/search/{id} 사용할 것
 * ⚠️ tourId는 Number 타입으로 전달 (Java 백엔드 Tour ID는 숫자)
 */
export async function fetchTourDetail(
  tourId: string | number,
  locale: string = "ko"
): Promise<TourDetail | null> {
  // ✅ ID를 숫자로 변환 (Java 백엔드 Tour.id는 number)
  const numericId = Number(tourId);
  if (isNaN(numericId)) {
    console.error(`❌ [fetchTourDetail] 유효하지 않은 tourId: "${tourId}" → Number 변환 실패`);
    return null;
  }

  const url = isServer
    ? `${DIRECT_API_BASE}/api/v1/tours/search/${numericId}`
    : `/api/backend/tours/${numericId}?lang=${locale}`;

  try {
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "Accept-Language": locale,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "(읽기 실패)");
      console.error(`❌ [fetchTourDetail] HTTP ${res.status} — tourId: ${numericId}`);
      console.error(`❌ [fetchTourDetail] URL: ${url}`);
      console.error(`❌ [fetchTourDetail] 서버 응답: ${errorBody.substring(0, 500)}`);
      return null;
    }

    const rawText = await res.text();
    console.log(`📦 [fetchTourDetail] Raw body length: ${rawText.length}`);
    console.log(`📦 [fetchTourDetail] Raw preview (500자): ${rawText.substring(0, 500)}`);

    let json: any;
    try {
      json = JSON.parse(rawText);
    } catch {
      console.error(`❌ [fetchTourDetail] JSON 파싱 실패!`);
      return null;
    }

    console.log(`📦 [fetchTourDetail] 응답 키:`, Object.keys(json));

    // ═══ 단일 투어 객체 추출 (모든 가능한 응답 구조 대응) ═══
    let tour: TourDetail | null = null;
    let extractedFrom = "";

    // 1순위: json 자체가 투어 객체 (id + name 존재)
    if (json.id && json.name) {
      tour = json as TourDetail;
      extractedFrom = "json (root object)";
    }
    // 2순위: json.data가 투어 객체
    else if (json.data && typeof json.data === "object" && !Array.isArray(json.data) && json.data.id) {
      tour = json.data;
      extractedFrom = "json.data";
    }
    // 3순위: json.content가 배열이고 첫 번째 항목이 투어
    else if (Array.isArray(json.content) && json.content.length > 0 && json.content[0].id) {
      tour = json.content[0];
      extractedFrom = "json.content[0]";
    }
    // 4순위: json.data.content가 배열이고 첫 번째 항목이 투어
    else if (Array.isArray(json.data?.content) && json.data.content.length > 0) {
      tour = json.data.content[0];
      extractedFrom = "json.data.content[0]";
    }
    // 5순위: json.data가 단일 객체 (id 없이도)
    else if (json.data && typeof json.data === "object" && !Array.isArray(json.data)) {
      tour = json.data;
      extractedFrom = "json.data (no id check)";
    }

    if (tour) {
      console.log(`✅ [fetchTourDetail] "${extractedFrom}" 에서 추출 — id: ${tour.id}, name: ${tour.name}`);
    } else {
      console.error(`❌ [fetchTourDetail] 데이터 추출 실패! 응답 키:`, Object.keys(json));
      console.error(`❌ [fetchTourDetail] 전체 응답 (300자):`, JSON.stringify(json).substring(0, 300));
    }

    return tour;
  } catch (error) {
    console.error(`❌ [fetchTourDetail] Network error:`, error);
    return null;
  }
}

/**
 * 투어 스케줄 목록 조회 (Public — 인증 불필요)
 * GET /api/v1/schedules/search?tourId={tourId}&viewLanguage={locale}
 *
 * ⚠️ 기존 /api/v1/tours/search/{id}/schedules 는 데이터 미반환 또는 권한 차단
 * ⚠️ 반드시 전용 스케줄 검색 엔드포인트 /api/v1/schedules/search 사용할 것
 *
 * 반환: 해당 투어의 활성 스케줄 목록
 * 각 스케줄은 특정 날짜+시간 슬롯을 나타냄
 */
export async function fetchSchedules(
  tourId: string | number,
  locale: string = "ko"
): Promise<ScheduleItem[]> {
  const numericId = Number(tourId);
  if (isNaN(numericId)) {
    console.error(`❌ [fetchSchedules] 유효하지 않은 tourId: "${tourId}"`);
    return [];
  }

  const url = isServer
    ? `${DIRECT_API_BASE}/api/v1/schedules/search?tourId=${numericId}`
    : `/api/backend/schedules-search?tourId=${numericId}&lang=${locale}`;

  try {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔍 [fetchSchedules] GET ${url} | Accept-Language: ${locale}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "Accept-Language": locale,
      },
      cache: "no-store",
    });

    console.log(`📡 [fetchSchedules] HTTP Status: ${res.status}`);

    if (!res.ok) {
      const errorText = await res.text().catch(() => "(읽기 실패)");
      console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.error(`❌ [fetchSchedules] HTTP ${res.status} 에러!`);
      console.error(`❌ [fetchSchedules] URL: ${url}`);
      console.error(`❌ [fetchSchedules] 서버 응답 원문: ${errorText.substring(0, 300)}`);
      console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      return [];
    }

    const rawText = await res.text();
    console.log(`📦 [fetchSchedules] Raw body length: ${rawText.length}`);
    console.log(`📦 [fetchSchedules] Raw preview (300자): ${rawText.substring(0, 300)}`);

    let json: any;
    try {
      json = JSON.parse(rawText);
    } catch {
      console.error(`❌ [fetchSchedules] JSON 파싱 실패!`);
      return [];
    }

    console.log(`📦 [fetchSchedules] 응답 키:`, Object.keys(json));

    // ═══ 스케줄 배열 추출 (content 최우선) ═══
    let schedules: ScheduleItem[] = [];
    let extractedFrom = "";

    if (Array.isArray(json.content)) {
      schedules = json.content;
      extractedFrom = "json.content";
    } else if (Array.isArray(json.data?.content)) {
      schedules = json.data.content;
      extractedFrom = "json.data.content";
    } else if (Array.isArray(json.data)) {
      schedules = json.data;
      extractedFrom = "json.data";
    } else if (Array.isArray(json)) {
      schedules = json;
      extractedFrom = "json (root array)";
    } else {
      console.error(`❌ [fetchSchedules] 데이터 추출 실패! 응답 키:`, Object.keys(json));
      console.error(`❌ [fetchSchedules] 전체 응답 (200자):`, JSON.stringify(json).substring(0, 200));
    }

    if (extractedFrom) {
      console.log(`✅ [fetchSchedules] "${extractedFrom}" 에서 ${schedules.length}개 추출`);
    }
    console.log(`📅 [fetchSchedules] 최종 스케줄 개수: ${schedules.length}개`);
    return schedules;
  } catch (error) {
    console.error(`❌ [fetchSchedules] Network error:`, error);
    return [];
  }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * 스케줄을 날짜별로 그룹화
 * key: "2026-03-15" → value: [ScheduleItem, ScheduleItem, ...]
 */
export function groupSchedulesByDate(
  schedules: ScheduleItem[]
): Record<string, ScheduleItem[]> {
  const groups: Record<string, ScheduleItem[]> = {};

  for (const schedule of schedules) {
    const date = schedule.startTime.split("T")[0]; // "2026-03-15"
    if (!groups[date]) groups[date] = [];
    groups[date].push(schedule);
  }

  // Sort time slots within each date
  for (const date in groups) {
    groups[date].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  return groups;
}

/**
 * ISO 시간 문자열에서 HH:mm 추출 (Asia/Tokyo 기준)
 * "2026-03-15T09:20:00+09:00" → "09:20"
 */
export function formatTimeFromISO(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      const match = isoString.match(/T(\d{2}:\d{2})/);
      return match ? match[1] : isoString;
    }
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Tokyo",
    });
  } catch {
    const match = isoString.match(/T(\d{2}:\d{2})/);
    return match ? match[1] : isoString;
  }
}
