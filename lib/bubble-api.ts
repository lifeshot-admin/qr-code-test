/**
 * Bubble.io Data API 연동 (캡처된 실제 DB 구조 기준)
 *
 * ⚠️ 중요: 테스트 DB 전용 설정
 * - BUBBLE_USE_VERSION_TEST=true → 모든 요청이 /version-test 경로로 전송됨
 * - URL 예시: https://api.lifeshot.me/version-test/api/1.1/obj
 * - Authorization: Bearer {토큰} (Bearer 접두사는 코드에서 추가, env에는 순수 토큰만)
 *
 * 테이블·필드명 매핑 (✅ 2026.02.13 Bubble DB 확인 - 전부 소문자):
 * - reserved_pose: pose_reservation_id (Link), spot_pose_Id (Link)
 * - spot_pose: image, persona, spot_Id, tour_Id
 * - auth_photo: auth_photo (이미지), pose_reservation_id (text - 문자열 ID)
 * - pose_reservation: status 필드로 상태 관리 (예: "Completed")
 *
 * Mutation(POST/PATCH) 환경별 동작:
 * - BUBBLE_USE_VERSION_TEST=true: 실제로 테스트 DB에 전송. 로그에 "Targeting Bubble Test DB" 표시.
 * - BUBBLE_USE_VERSION_TEST=false: 가상 성공만 반환, 운영 DB 보호.
 *
 * 최종 저장 흐름 ("다음 손님 보기" 클릭):
 * 1. updateAuthPhoto: PATCH .../obj/pose_reservation/{id} → { auth_photo } (사진 업데이트)
 * 2. updateReservationStatus: PATCH .../obj/pose_reservation/{id} → { status: "Completed" }
 */

const APP_NAME = process.env.NEXT_PUBLIC_BUBBLE_APP_NAME || "";
/** 
 * Bubble API 토큰 (Bearer 접두사 없이 순수 토큰만 입력)
 * 예: 09d177ba7ec8b145ef39d1028e26143f
 */
const API_TOKEN = process.env.BUBBLE_API_TOKEN || "";
/** 
 * 커스텀 도메인 (베이스만, 끝에 / 없이. 예: https://api.lifeshot.me)
 * /version-test나 /api/1.1/obj는 포함하지 않음
 */
const API_BASE_URL = process.env.BUBBLE_API_BASE_URL || "";
/** 
 * true 시 version-test 사용
 * 최종 URL: https://api.lifeshot.me/version-test/api/1.1/obj
 * false 시: https://api.lifeshot.me/api/1.1/obj
 */
const USE_VERSION_TEST = process.env.BUBBLE_USE_VERSION_TEST === "true" || process.env.BUBBLE_USE_VERSION_TEST === "1";

function getBaseUrl(): string {
  if (API_BASE_URL) {
    const host = API_BASE_URL.replace(/\/$/, "");
    const versionPath = USE_VERSION_TEST ? "/version-test" : "";
    const fullPath = `${host}${versionPath}/api/1.1/obj`;
    
    if (USE_VERSION_TEST) {
      console.log(`🧪 Targeting Bubble Test DB: ${fullPath}`);
    } else {
      console.log(`🚀 Targeting Bubble Production DB: ${fullPath}`);
    }
    return fullPath;
  }
  const bubbleUrl = `https://${APP_NAME}.bubbleapps.io/api/1.1/obj`;
  console.log(`[Bubble API] Base URL: ${bubbleUrl}`);
  return bubbleUrl;
}

const BASE = getBaseUrl();

/** (다른 mutation용 참고) true이면 일반적으로 전송 생략. updateAuthPhoto는 환경별 로직으로 별도 처리 */
const SAFE_MODE =
  process.env.BUBBLE_API_SAFE_MODE === "true" ||
  process.env.BUBBLE_API_SAFE_MODE === "1";

function headers(): HeadersInit {
  if (!API_TOKEN) {
    console.error("❌ [Bubble API] BUBBLE_API_TOKEN이 설정되지 않았습니다!");
    console.error("   .env.local 파일에 BUBBLE_API_TOKEN을 추가해주세요.");
  }
  // Authorization 헤더: 코드에서 'Bearer ' 접두사 추가 (env 파일에는 순수 토큰만)
  return {
    Authorization: `Bearer ${API_TOKEN}`,
    "Content-Type": "application/json",
  };
}

/**
 * Reservation ID 정리: MANUAL_ 접두사 제거
 * Bubble DB에는 순수 ID만 저장되므로, 클라이언트에서 생성한 접두사를 제거
 * 예: "MANUAL_1234567890" → "1234567890"
 */
function sanitizeReservationId(id: string): string {
  if (!id) return id;
  const cleaned = id.replace(/^MANUAL_/, "");
  if (cleaned !== id) {
    console.log(`🔧 Sanitized ID: "${id}" → "${cleaned}"`);
  }
  return cleaned;
}

/**
 * API 호출 디버깅용: 토큰 첫 5자와 전체 URL 로그 출력
 */
function logApiCall(method: string, url: string, hasBody: boolean = false): void {
  const tokenPreview = API_TOKEN ? API_TOKEN.slice(0, 5) : "(없음)";
  const dbType = USE_VERSION_TEST ? "Test DB" : "Production DB";
  console.log(`\n[Bubble API] ${method} Request`);
  console.log(`📍 Targeting Bubble ${dbType}: ${url}`);
  console.log(`🔑 Authorization: Bearer ${tokenPreview}***`);
  if (hasBody) {
    console.log(`📦 Request includes body`);
  }
  console.log('---');
}

/** pose_reservation 테이블: 예약 정보 (최신 스키마 2026.02.11) */
export type PoseReservation = {
  _id: string;
  folder_Id?: number;        // 자바 백엔드 예약 ID
  tour_Id?: number;          // FK (tour 테이블)
  user_Id?: number;          // 유저 고유 ID
  status?: string;           // 예약 상태
  qrCodeUrl?: string;        // 현장 인증용 QR 주소
  "Created Date"?: string;
  "Modified Date"?: string;
};

/** pose_category 테이블: 페르소나 관리 (최신 스키마 2026.02.11) */
export type PoseCategory = {
  _id: string;
  type?: string;   // 카테고리 타입
  num?: string;    // ✅ 번호 (text 타입)
  "Created Date"?: string;
  "Modified Date"?: string;
};

/** auth_photo 테이블: 인증샷 (최신 스키마 2026.02.11) */
export type AuthPhoto = {
  _id: string;
  pose_reservation_id?: string;  // ✅ 예약 연동 ID (text)
  auth_photo?: string;            // 유저가 직접 촬영한 인증샷 (image)
  "Created Date"?: string;
  "Modified Date"?: string;
};

/** spot_pose 테이블 (최신 스키마 2026.02.11) */
export type SpotPose = {
  _id: string;
  tour_Id?: number;       // FK
  spot_Id?: number;       // FK
  persona?: string;       // 1인, 가족, 커플 등 카테고리
  image?: string;         // 가이드 포즈 이미지
  "Created Date"?: string;
  "Modified Date"?: string;
};

/** reserved_pose 테이블: 선택된 포즈 (최신 스키마 2026.02.11) */
export type ReservedPose = {
  _id: string;
  pose_reservation_id?: string;       // ✅ pose_reservation 연동 ID (text)
  spot_pose_Id?: SpotPose;            // ✅ 선택된 포즈 객체 참조 (Link)
  "Created Date"?: string;
  "Modified Date"?: string;
};

/** 목록 조회 응답 (Bubble 공통) */
export type BubbleListResponse<T> = {
  response: { results: T[]; count: number };
  status: string;
};

/** 단일 조회 응답 */
export type BubbleItemResponse<T> = {
  response: T;
  status: string;
};

/**
 * 예약 ID로 pose_reservation 단일 조회
 * GET /api/1.1/obj/pose_reservation/{id}
 */
export async function getPoseReservation(
  reservationId: string
): Promise<PoseReservation | null> {
  const cleanId = sanitizeReservationId(reservationId);
  const hasBase = !!API_BASE_URL || !!APP_NAME;
  if (!hasBase || !API_TOKEN) {
    console.warn("Bubble API: BUBBLE_API_BASE_URL(또는 NEXT_PUBLIC_BUBBLE_APP_NAME) 및 BUBBLE_API_TOKEN missing");
    return null;
  }
  try {
    const url = `${BASE}/pose_reservation/${cleanId}`;
    logApiCall("GET", url);
    const res = await fetch(url, {
      method: "GET",
      headers: headers(),
    });
    if (!res.ok) return null;
    const json: BubbleItemResponse<PoseReservation> = await res.json();
    return json?.response ?? null;
  } catch (e) {
    console.error("getPoseReservation", e);
    return null;
  }
}

/**
 * 예약 존재 여부 확인 (예약 확인 화면용)
 */
export async function checkReservationExists(
  reservationId: string
): Promise<boolean> {
  const row = await getPoseReservation(reservationId);
  return row != null;
}

/**
 * 예약 상태 업데이트 (pose_reservation)
 * PATCH /api/1.1/obj/pose_reservation/{id}
 * 
 * 환경별 동작:
 * - 운영(BUBBLE_USE_VERSION_TEST false/미설정): 가상 성공만 반환.
 * - 테스트(BUBBLE_USE_VERSION_TEST=true): 실제 PATCH 전송.
 */
export async function updateReservationStatus(
  reservationId: string,
  status: string
): Promise<PoseReservation | null> {
  const cleanId = sanitizeReservationId(reservationId);
  const isVersionTest = USE_VERSION_TEST;

  if (!isVersionTest) {
    console.log(`[Bubble API] 운영 환경 - updateReservationStatus 실제 전송 없음 (가상 성공): ${cleanId} → ${status}`);
    return { _id: cleanId, status };
  }

  const hasBase = !!API_BASE_URL || !!APP_NAME;
  if (!hasBase || !API_TOKEN) {
    console.warn("Bubble API: BUBBLE_API_BASE_URL 및 BUBBLE_API_TOKEN 필요");
    return null;
  }
  try {
    const url = `${BASE}/pose_reservation/${cleanId}`;
    logApiCall("PATCH", url, true);
    const res = await fetch(url, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("updateReservationStatus", res.status, err);
      return null;
    }
    const json: BubbleItemResponse<PoseReservation> = await res.json();
    const result = json?.response ?? null;
    if (result) {
      console.log(`테스트 DB에 예약 상태가 성공적으로 업데이트되었습니다: ${reservationId} → ${status}`);
    }
    return result;
  } catch (e) {
    console.error("updateReservationStatus", e);
    return null;
  }
}

/**
 * auth_photo 테이블 필드: auth_photo (이미지), pose_reservation_id (문자열 ID)
 * Base64/Data URL을 버블이 인식할 수 있는 JSON용 문자열로 정규화.
 * - 이미 data:image/...;base64,... 형식이면 그대로 사용
 * - 순수 base64 문자열이면 data:image/jpeg;base64, 접두사 부여
 */
function normalizeAuthPhotoImage(value: string | undefined): string | undefined {
  if (!value || typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^data:image\/[a-z+]+;base64,/i.test(trimmed)) return trimmed;
  if (/^[A-Za-z0-9+/=]+$/.test(trimmed)) return `data:image/jpeg;base64,${trimmed}`;
  return trimmed;
}

/**
 * 인증사진 업데이트 (pose_reservation 테이블의 auth_photo 필드)
 * PATCH /api/1.1/obj/pose_reservation/{pose_reservation_id}
 * 
 * ✅ 변경 이력:
 *   기존: POST .../obj/auth_photo → 별도 테이블에 새 레코드 생성 (X)
 *   변경: PATCH .../obj/pose_reservation/{id} → 기존 예약 건에 사진 업데이트 (O)
 * 
 * Body에는 auth_photo 필드만 전송 (pose_reservation_id는 URL 경로에 포함):
 * {
 *   "auth_photo": "data:image/jpeg;base64,/9j/4AAQ..."
 * }
 *
 * 환경별 동작:
 * - 운영(BUBBLE_USE_VERSION_TEST false/미설정): 가상 성공만 반환.
 * - 테스트(BUBBLE_USE_VERSION_TEST=true): 실제 PATCH 전송.
 */
export async function updateAuthPhoto(payload: {
  pose_reservation_id: string;
  auth_photo?: string;
}): Promise<AuthPhoto | null> {
  const cleanId = sanitizeReservationId(payload.pose_reservation_id);
  
  // ✅ Body에는 auth_photo만! (pose_reservation_id는 URL 경로에 포함)
  const body = {
    auth_photo: normalizeAuthPhotoImage(payload.auth_photo),
  };

  const isVersionTest = USE_VERSION_TEST;

  if (!isVersionTest) {
    console.log("[Bubble API] 운영 환경 - updateAuthPhoto 실제 전송 없음 (가상 성공만 반환)");
    console.log(`📋 pose_reservation_id (URL경로): ${cleanId}`);
    console.log(`📷 auth_photo: ${body.auth_photo ? 'Present (base64 data)' : 'Missing'}`);
    
    const mock: AuthPhoto = {
      _id: cleanId,
      pose_reservation_id: cleanId,
    };
    return mock;
  }

  const hasBase = !!API_BASE_URL || !!APP_NAME;
  if (!hasBase || !API_TOKEN) {
    console.warn("Bubble API: BUBBLE_API_BASE_URL(또는 NEXT_PUBLIC_BUBBLE_APP_NAME) 및 BUBBLE_API_TOKEN 필요");
    return null;
  }

  try {
    // ✅ 핵심: PATCH .../obj/pose_reservation/{id}
    const url = `${BASE}/pose_reservation/${cleanId}`;
    
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📤 [Bubble API] PATCH → pose_reservation 테이블에 auth_photo 업데이트");
    console.log(`📋 URL: ${url}`);
    console.log(`📋 pose_reservation_id (경로): ${cleanId}`);
    console.log(`📷 auth_photo: ${body.auth_photo ? `있음 (${(body.auth_photo.length / 1024 / 1024).toFixed(2)}MB, ${body.auth_photo.length} chars)` : '❌ 없음'}`);
    if (body.auth_photo) {
      console.log(`📷 base64 헤더(50자): ${body.auth_photo.substring(0, 50)}...`);
    }
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    logApiCall("PATCH", url, true);
    const res = await fetch(url, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify(body),
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.error(`❌ [Bubble API] updateAuthPhoto 실패! HTTP ${res.status}`);
      console.error(`📋 [Bubble API] 에러 응답 전문: ${errorText}`);
      console.error(`📋 [Bubble API] 요청 URL: ${url}`);
      console.error(`📋 [Bubble API] pose_reservation_id: ${cleanId}`);
      console.error(`📋 [Bubble API] auth_photo 전송 여부: ${body.auth_photo ? "있음" : "없음"}`);
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      
      throw new Error(`Bubble API Error ${res.status}: ${errorText}`);
    }
    
    // ✅ Bubble 응답 전문 로깅
    const rawResponseText = await res.text();
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📨 [Bubble API] PATCH 응답 전문 (Raw Response):");
    console.log(rawResponseText);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // PATCH 응답이 빈 경우도 성공 (Bubble은 PATCH 시 빈 응답 가능)
    if (!rawResponseText || rawResponseText.trim() === "") {
      console.log("✅ [Bubble API] PATCH 성공! (빈 응답 = 정상)");
      return {
        _id: cleanId,
        pose_reservation_id: cleanId,
      };
    }

    const json = JSON.parse(rawResponseText);
    const result = json?.response ?? json;

    console.log("✅ [Bubble API] pose_reservation 테이블 auth_photo 업데이트 성공!");
    console.log(`📌 [Bubble API] _id: ${result?._id || cleanId}`);
    console.log(`📋 [Bubble API] 응답 키 목록: [${Object.keys(result || {}).join(", ")}]`);
    
    return {
      _id: result?._id || cleanId,
      pose_reservation_id: cleanId,
    };
  } catch (e) {
    console.error("❌ updateAuthPhoto exception:", e);
    throw e;
  }
}

/**
 * 예약에 연결된 reserved_pose 목록 조회
 * pose_reservation_id는 Link(연결형)이므로, constraints에서 연결된 예약의 _id(currentReservationId)와
 * 일치하도록 equals로 조회.
 * GET /api/1.1/obj/reserved_pose?constraints=[{"key":"pose_reservation_id","constraint_type":"equals","value":"예약_id"}]
 * ✅ 테이블명: reserved_pose (전체 소문자)
 */
export async function getReservedPosesByReservation(
  poseReservationId: string
): Promise<ReservedPose[]> {
  const cleanId = sanitizeReservationId(poseReservationId);
  const hasBase = !!API_BASE_URL || !!APP_NAME;
  if (!hasBase || !API_TOKEN) return [];
  try {
    const constraints = encodeURIComponent(
      JSON.stringify([
        {
          key: "pose_reservation_id",
          constraint_type: "equals",
          value: cleanId,
        },
      ])
    );
    const url = `${BASE}/reserved_pose?constraints=${constraints}`;  // ✅ 소문자 통일
    logApiCall("GET", url);
    const res = await fetch(url, { method: "GET", headers: headers() });
    if (!res.ok) return [];
    const json: BubbleListResponse<ReservedPose> = await res.json();
    return json?.response?.results ?? [];
  } catch (e) {
    console.error("getReservedPosesByReservation", e);
    return [];
  }
}

/**
 * spot_pose 단일 조회 (이미지 URL 등)
 * GET /api/1.1/obj/spot_pose/{id}
 * ✅ 테이블명: spot_pose (전체 소문자)
 */
export async function getSpotPose(spotPoseId: string): Promise<SpotPose | null> {
  const hasBase = !!API_BASE_URL || !!APP_NAME;
  if (!hasBase || !API_TOKEN) return null;
  try {
    const url = `${BASE}/spot_pose/${spotPoseId}`;  // ✅ 소문자 통일
    logApiCall("GET", url);
    const res = await fetch(url, {
      method: "GET",
      headers: headers(),
    });
    if (!res.ok) return null;
    const json: BubbleItemResponse<SpotPose> = await res.json();
    return json?.response ?? null;
  } catch (e) {
    console.error("getSpotPose", e);
    return null;
  }
}

/**
 * Link 필드에서 연결된 객체의 _id 추출 (API가 문자열 또는 { _id } 반환 시 대응)
 */
function extractLinkedId(link: string | { _id: string } | undefined): string {
  if (!link) return "";
  if (typeof link === "string") return link;
  return link._id ?? "";
}

/**
 * 예약건에 대한 포즈 가이드 목록
 * 1) Reserved_pose에서 해당 예약 ID(pose_reservation_id)로 모든 행 조회
 * 2) 각 행의 spot_pose_Id(Link)로 Spot_pose 테이블에서 실제 image URL 조회
 * 3) 화면에 뿌릴 { reservedPoseId, spotPoseId, imageUrl } 배열 반환
 */
export type PoseGuideItem = {
  reservedPoseId: string;
  spotPoseId: string;
  imageUrl: string;
};

export async function getPoseGuidesForReservation(
  poseReservationId: string
): Promise<PoseGuideItem[]> {
  const reserved = await getReservedPosesByReservation(poseReservationId);
  const out: PoseGuideItem[] = [];
  for (const r of reserved) {
    const spotPoseId = extractLinkedId(r.spot_pose_Id);
    if (!spotPoseId) continue;
    const spot = await getSpotPose(spotPoseId);
    if (spot?.image) {
      out.push({
        reservedPoseId: r._id,
        spotPoseId: spot._id,
        imageUrl: spot.image,
      });
    }
  }
  return out;
}

/**
 * 포즈 카테고리 목록 조회
 * GET /api/1.1/obj/pose_category
 */
export async function getPoseCategories(): Promise<PoseCategory[]> {
  const hasBase = !!API_BASE_URL || !!APP_NAME;
  if (!hasBase || !API_TOKEN) return [];
  try {
    const url = `${BASE}/pose_category`;
    logApiCall("GET", url);
    const res = await fetch(url, { method: "GET", headers: headers() });
    if (!res.ok) return [];
    const json: BubbleListResponse<PoseCategory> = await res.json();
    return json?.response?.results ?? [];
  } catch (e) {
    console.error("getPoseCategories", e);
    return [];
  }
}

/**
 * spot_pose 목록 조회 (포즈 셀렉터용)
 * GET /api/1.1/obj/spot_pose
 * ✅ 테이블명: spot_pose (전체 소문자)
 */
export async function getSpotPoses(): Promise<SpotPose[]> {
  const hasBase = !!API_BASE_URL || !!APP_NAME;
  if (!hasBase || !API_TOKEN) return [];
  try {
    const url = `${BASE}/spot_pose`;  // ✅ 소문자 통일
    logApiCall("GET", url);
    const res = await fetch(url, { method: "GET", headers: headers() });
    if (!res.ok) return [];
    const json: BubbleListResponse<SpotPose> = await res.json();
    return json?.response?.results ?? [];
  } catch (e) {
    console.error("getSpotPoses", e);
    return [];
  }
}

/** tour 테이블: 투어 정보 (최신 스키마 2026.02.11) */
export type Tour = {
  _id: string;
  tour_Id?: number;          // PK (백엔드와 연동 키)
  tour_name?: string;
  tour_date?: string;
  status?: string;
  min_total?: number;        // 투어 전체 최소 선택 개수
  max_total?: number;        // 투어 전체 최대 선택 개수
  "Created Date"?: string;
  "Modified Date"?: string;
};

/** SPOT 테이블: 스팟 정보 (최신 스키마 2026.02.11) */
export type Spot = {
  _id: string;
  tour_Id?: number;          // ✅ FK (tour 테이블 연동) - 소문자 i
  spot_Id?: number;          // 스팟 고유 번호
  spot_name?: string;        // 스팟 명칭 (기모노의 숲 등)
  min_count_limit?: number;  // 해당 스팟 최소 선택 제한
  thumbnail?: string;        // 스팟 대표 이미지
  "Created Date"?: string;
  "Modified Date"?: string;
};

/** 
 * EXCEL 테이블: 쿠폰 조회용
 * 
 * ✅ 실제 스키마 (Bubble DB 확인 완료):
 * - phone: text (전화번호)
 * - code: text (쿠폰 코드)
 * - tour_date: date (투어 날짜)
 * - user_name: text
 * - coupon_name: text
 * - tour_Id: number
 */
export type ExcelCoupon = {
  _id: string;
  phone?: string;            // 전화번호 (Type: text)
  code?: string;             // 쿠폰 코드 (Type: text)
  tour_date?: string;        // 투어 날짜 (Type: date)
  user_name?: string;        // 사용자 이름
  coupon_name?: string;      // 쿠폰 이름
  tour_Id?: number;          // 투어 ID
  "Created Date"?: string;
  "Modified Date"?: string;
  [key: string]: any;        // 디버깅용: 알 수 없는 필드 접근 허용
};

/**
 * ──────────────────────────────────────────────
 * 전화번호 정규화 (Data Cleaning)
 * 숫자가 아닌 모든 문자(e, 쉼표, 하이픈, 공백 등)를 제거
 * 예: "e1212" → "1212", "010-1234-1212" → "01012341212"
 * ──────────────────────────────────────────────
 */
function cleanPhoneDigits(raw: string | undefined | null): string {
  if (!raw) return "";
  return String(raw).replace(/[^0-9]/g, "");
}

/**
 * ──────────────────────────────────────────────
 * Timezone-Aware 날짜 비교 (KST ↔ UTC)
 * 
 * DB에 2026-02-09T15:00:00Z 로 저장 = 한국 시간 2026-02-10 00:00
 * → substring(0,10) 비교하면 "2026-02-09" ≠ "2026-02-10" 으로 실패!
 * 
 * 해결: new Date()로 파싱 → toLocaleDateString('ko-KR') 로 KST 날짜 추출
 * ──────────────────────────────────────────────
 */
function toKSTDateString(isoOrDateStr: string | undefined | null): string {
  if (!isoOrDateStr) return "";
  try {
    const d = new Date(String(isoOrDateStr));
    if (isNaN(d.getTime())) return "";
    // KST = UTC+9, toLocaleDateString('ko-KR')는 YYYY. M. D. 형식
    // 직접 UTC 오프셋 계산이 더 확실함
    const kstMs = d.getTime() + 9 * 60 * 60 * 1000;
    const kstDate = new Date(kstMs);
    const y = kstDate.getUTCFullYear();
    const m = String(kstDate.getUTCMonth() + 1).padStart(2, "0");
    const day = String(kstDate.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return "";
  }
}

/**
 * EXCEL 테이블에서 쿠폰 조회 (전화번호 뒷자리 + 투어 날짜 매칭)
 * 
 * ✅ 최종 로직 (시차 + 노이즈 완벽 처리):
 * - phone (text): 숫자 외 문자 제거 후 뒷 4자리 매칭
 * - tour_date (date): KST/UTC 9시간 시차 보정 범위 검색
 *   → 사용자 "2026-02-10" 선택 시 서버 범위: 2월 9일 15:00Z ~ 2월 10일 14:59:59Z
 * - code (text): 매칭된 레코드에서 자동 추출
 * 
 * GET /api/1.1/obj/excel with constraints
 */
export async function searchCoupon(
  tourDate: string,
  phone4Digits: string
): Promise<ExcelCoupon | null> {
  const hasBase = !!API_BASE_URL || !!APP_NAME;
  if (!hasBase || !API_TOKEN) return null;

  // 입력값 정규화
  const cleanedPhone = cleanPhoneDigits(phone4Digits);

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🎫 [searchCoupon] 쿠폰 조회 시작 (Timezone-Aware)");
  console.log(`  📞 원본 입력: "${phone4Digits}" → 정규화: "${cleanedPhone}"`);
  console.log(`  📅 사용자 선택 날짜 (KST): "${tourDate}"`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // ──────────────────────────────────────────────
  // KST → UTC 변환: 한국 날짜 "2026-02-10" =
  //   UTC 시작: 2026-02-09T15:00:00Z (= KST 2026-02-10 00:00:00)
  //   UTC 끝:   2026-02-10T14:59:59Z (= KST 2026-02-10 23:59:59)
  // ──────────────────────────────────────────────
  const kstMidnight = new Date(`${tourDate}T00:00:00+09:00`);   // KST 자정
  const kstEndOfDay = new Date(`${tourDate}T23:59:59+09:00`);   // KST 23:59:59

  const utcRangeStart = kstMidnight.toISOString();  // → 전날 15:00:00Z
  const utcRangeEnd = kstEndOfDay.toISOString();     // → 당일 14:59:59Z

  console.log(`  🌏 KST "${tourDate}" → UTC 범위:`);
  console.log(`     시작: ${utcRangeStart} (KST ${tourDate} 00:00:00)`);
  console.log(`     끝:   ${utcRangeEnd} (KST ${tourDate} 23:59:59)`);

  // ── 전략 1: phone (text contains) + tour_date KST 범위 검색 ──
  try {
    console.log("📍 [전략 1] phone (text contains) + tour_date KST-aware 범위");
    const constraints1 = [
      { key: "phone", constraint_type: "text contains", value: cleanedPhone },
      { key: "tour_date", constraint_type: "greater than", value: utcRangeStart },
      { key: "tour_date", constraint_type: "less than", value: utcRangeEnd },
    ];
    const result1 = await fetchCouponWithConstraints(constraints1, "전략 1");
    if (result1) return result1;
  } catch (e) {
    console.error("  ❌ [전략 1] Exception:", e);
  }

  // ── 전략 2: phone (text contains) + tour_date 넉넉한 범위 (±1일) ──
  // Bubble의 날짜 저장 형식이 불확실할 때를 대비
  try {
    console.log("📍 [전략 2] phone (text contains) + tour_date 넉넉한 범위 (전날 09:00Z ~ 당일 23:59:59Z)");
    const wideStart = `${tourDate.replace(/-(\d{2})$/, (_, d) => {
      const prev = String(Number(d) - 1).padStart(2, '0');
      return `-${prev}`;
    })}T09:00:00.000Z`;
    // 더 안전한 방법: Date 객체로 계산
    const wideStartDate = new Date(`${tourDate}T00:00:00.000Z`);
    wideStartDate.setUTCDate(wideStartDate.getUTCDate() - 1);
    wideStartDate.setUTCHours(9, 0, 0, 0);
    const wideEndStr = `${tourDate}T23:59:59.999Z`;

    const constraints2 = [
      { key: "phone", constraint_type: "text contains", value: cleanedPhone },
      { key: "tour_date", constraint_type: "greater than", value: wideStartDate.toISOString() },
      { key: "tour_date", constraint_type: "less than", value: wideEndStr },
    ];
    console.log(`     범위: ${wideStartDate.toISOString()} ~ ${wideEndStr}`);
    const result2 = await fetchCouponWithConstraints(constraints2, "전략 2");
    if (result2) return result2;
  } catch (e) {
    console.error("  ❌ [전략 2] Exception:", e);
  }

  // ── 전략 3: phone만으로 검색 → 클라이언트에서 KST 날짜 필터 ──
  try {
    console.log("📍 [전략 3] phone (text contains)만 → 클라이언트 KST 날짜 필터");
    const constraints3 = [
      { key: "phone", constraint_type: "text contains", value: cleanedPhone },
    ];

    const url = `${BASE}/excel`;
    const params = new URLSearchParams();
    params.append("constraints", JSON.stringify(constraints3));
    const fullUrl = `${url}?${params.toString()}`;
    logApiCall("GET", fullUrl);

    const res = await fetch(fullUrl, { method: "GET", headers: headers() });
    if (res.ok) {
      const json: BubbleListResponse<ExcelCoupon> = await res.json();
      const results = json?.response?.results ?? [];
      console.log(`  📥 phone 매칭 결과: ${results.length}개`);

      if (results.length > 0) {
        console.log("  🔑 Raw Item Keys:", Object.keys(results[0]));

        const matched = clientSideMatchKST(results, cleanedPhone, tourDate, "전략 3");
        if (matched) return matched;
      }
    } else {
      console.error(`  ❌ [전략 3] HTTP ${res.status}`);
    }
  } catch (e) {
    console.error("  ❌ [전략 3] Exception:", e);
  }

  // ── 전략 4: 전체 EXCEL 로드 → 클라이언트 KST 필터 (최후 수단) ──
  try {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📍 [전략 4] 전체 EXCEL 로드 → 클라이언트 KST 필터 (최후 수단)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const url = `${BASE}/excel`;
    logApiCall("GET", url);
    const res = await fetch(url, { method: "GET", headers: headers() });
    if (!res.ok) {
      console.error(`❌ [전략 4] HTTP ${res.status}`);
      return null;
    }
    const json: BubbleListResponse<ExcelCoupon> = await res.json();
    const allResults = json?.response?.results ?? [];
    console.log(`  📦 전체 로드: ${allResults.length}개`);

    if (allResults.length > 0) {
      // ✅ 디버깅: 실제 필드명과 데이터 확인
      console.log("  🔑 [DEBUG] Raw Item Keys:", Object.keys(allResults[0]));
      console.log("  🔍 [DEBUG] 첫 번째 아이템:", JSON.stringify(allResults[0], null, 2));

      // Privacy Rules 삭제 확인 체크
      const firstItem = allResults[0];
      if (firstItem['tour_date'] === undefined && firstItem['code'] === undefined) {
        console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.error("🚨🚨🚨 [CRITICAL] tour_date와 code가 모두 undefined!");
        console.error("🚨 Privacy Rules가 정말 삭제되었는지 Bubble 에디터에서 다시 확인하세요!");
        console.error("🚨 Data → Privacy → EXCEL 테이블의 규칙을 확인하세요.");
        console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      }

      console.log("  🔍 첫 5개 raw 데이터:");
      allResults.slice(0, 5).forEach((item, idx) => {
        const rawPhone = item['phone'];
        const rawDate = item['tour_date'];
        const rawCode = item['code'];
        const kstDate = toKSTDateString(rawDate);
        console.log(`    [${idx}] phone="${rawPhone}" (cleaned="${cleanPhoneDigits(rawPhone)}"), tour_date="${rawDate}" (KST="${kstDate}"), code="${rawCode}"`);
      });

      const matched = clientSideMatchKST(allResults, cleanedPhone, tourDate, "전략 4");
      if (matched) return matched;

      console.log("  ❌ 전체 데이터에서도 매칭 실패");
    } else {
      console.log("  ⚠️ EXCEL 테이블이 비어있습니다");
    }
  } catch (e) {
    console.error("❌ [전략 4] Exception:", e);
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("❌ [searchCoupon] 모든 전략(1~4) 실패 - 매칭되는 쿠폰 없음");
  console.log(`  📞 입력 phone: "${phone4Digits}" (정규화: "${cleanedPhone}")`);
  console.log(`  📅 입력 tourDate (KST): "${tourDate}"`);
  console.log(`  🌏 UTC 검색 범위: ${utcRangeStart} ~ ${utcRangeEnd}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  return null;
}

/**
 * 클라이언트 사이드 KST-Aware 매칭
 * 
 * ✅ 전화번호: 숫자 외 문자 제거 후 뒷 4자리 매칭
 * ✅ 날짜: UTC → KST 변환 후 YYYY-MM-DD 비교 (substring 비교 금지)
 */
function clientSideMatchKST(
  results: ExcelCoupon[],
  cleanedPhone: string,
  targetKSTDate: string,
  strategyLabel: string
): ExcelCoupon | null {
  // 대소문자 이슈 체크
  const firstItemKeys = Object.keys(results[0]);
  const phoneKey = firstItemKeys.find(k => k.toLowerCase() === 'phone') || 'phone';
  const tourDateKey = firstItemKeys.find(k => k.toLowerCase() === 'tour_date') || 'tour_date';
  const codeKey = firstItemKeys.find(k => k.toLowerCase() === 'code') || 'code';

  console.log(`  🏷️ 필드명 매핑: phone="${phoneKey}", tour_date="${tourDateKey}", code="${codeKey}"`);

  for (const item of results) {
    // ✅ 전화번호 정규화: 숫자만 추출 후 뒷 4자리 비교
    const rawPhone = String(item[phoneKey] ?? "");
    const cleanedItemPhone = cleanPhoneDigits(rawPhone);
    const phoneLast4 = cleanedItemPhone.slice(-4);
    const phoneMatch = cleanedItemPhone.includes(cleanedPhone) ||
                       cleanedItemPhone.endsWith(cleanedPhone) ||
                       phoneLast4 === cleanedPhone;

    // ✅ 날짜: UTC → KST 변환 후 비교 (substring 비교 절대 금지)
    const rawDate = item[tourDateKey];
    const kstDateStr = toKSTDateString(rawDate);
    const dateMatch = kstDateStr === targetKSTDate;

    if (phoneMatch || dateMatch) {
      console.log(`    🔎 후보: phone="${rawPhone}" (cleaned="${cleanedItemPhone}", last4="${phoneLast4}", match=${phoneMatch})`);
      console.log(`            tour_date="${rawDate}" → KST="${kstDateStr}" vs target="${targetKSTDate}" (match=${dateMatch})`);
    }

    if (phoneMatch && dateMatch) {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`✅✅✅ [${strategyLabel}] KST-Aware 클라이언트 매칭 성공!`);
      console.log(`  📌 code: ${item[codeKey]}`);
      console.log(`  📞 phone: ${rawPhone} (정규화: ${cleanedItemPhone})`);
      console.log(`  📅 tour_date (UTC): ${rawDate}`);
      console.log(`  📅 tour_date (KST): ${kstDateStr}`);
      console.log(`  👤 user_name: ${item['user_name']}`);
      console.log(`  🎫 tour_Id: ${item['tour_Id']}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      return item;
    }
  }

  return null;
}

/**
 * 쿠폰 검색 헬퍼: constraints 기반 Bubble API 호출
 * ✅ phone 필드만 사용, KST-aware 날짜 범위
 */
async function fetchCouponWithConstraints(
  constraints: Array<{ key: string; constraint_type: string; value: string }>,
  strategyLabel: string
): Promise<ExcelCoupon | null> {
  const url = `${BASE}/excel`;
  const params = new URLSearchParams();
  params.append("constraints", JSON.stringify(constraints));

  const fullUrl = `${url}?${params.toString()}`;
  console.log(`  📤 Constraints: ${JSON.stringify(constraints)}`);
  logApiCall("GET", fullUrl);

  const res = await fetch(fullUrl, { method: "GET", headers: headers() });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(`  ❌ [${strategyLabel}] HTTP ${res.status}: ${errText}`);
    return null;
  }

  const json: BubbleListResponse<ExcelCoupon> = await res.json();
  const results = json?.response?.results ?? [];
  console.log(`  📥 [${strategyLabel}] 결과: ${results.length}개`);

  if (results.length > 0) {
    const found = results[0];
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`  ✅ [${strategyLabel}] 매칭 성공!`);
    console.log(`  🔑 Raw Keys: ${Object.keys(found).join(", ")}`);
    console.log(`  📌 code: ${found['code']}`);
    console.log(`  📞 phone: ${found['phone']}`);
    console.log(`  📅 tour_date (UTC): ${found['tour_date']}`);
    console.log(`  📅 tour_date (KST): ${toKSTDateString(found['tour_date'])}`);
    console.log(`  👤 user_name: ${found['user_name']}`);
    console.log(`  🎫 tour_Id: ${found['tour_Id']}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    return found;
  }
  return null;
}

/**
 * tour_Id로 투어 조회
 * GET /api/1.1/obj/tour with constraints
 * ✅ 다중 전략: constraints 실패 시 전체 로드 후 find
 */
export async function getTourById(tourId: number): Promise<Tour | null> {
  const hasBase = !!API_BASE_URL || !!APP_NAME;
  if (!hasBase || !API_TOKEN) return null;
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔍 [getTourById] 다중 전략 검색 시작");
  console.log(`  🎯 Target tour_Id: ${tourId} (${typeof tourId})`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  // 🎯 전략 1: 필드명 소문자 + 숫자 값 (tour_Id: 30)
  try {
    console.log("📍 [Strategy 1] key: 'tour_Id' (소문자), value: 30 (숫자)");
    const constraints1 = [
      { key: "tour_Id", constraint_type: "equals", value: tourId },
    ];
    const result1 = await tryFetchWithConstraints(constraints1, "Strategy 1");
    if (result1) {
      console.log("✅ [Strategy 1] SUCCESS - tour_Id (소문자) + 숫자");
      return result1;
    }
  } catch (e) {
    console.error("❌ [Strategy 1] Failed:", e);
  }
  
  // 🎯 전략 2: 필드명 대문자 I + 숫자 값 (Tour_Id: 30)
  try {
    console.log("📍 [Strategy 2] key: 'Tour_Id' (대문자 T, I), value: 30 (숫자)");
    const constraints2 = [
      { key: "Tour_Id", constraint_type: "equals", value: tourId },
    ];
    const result2 = await tryFetchWithConstraints(constraints2, "Strategy 2");
    if (result2) {
      console.log("✅ [Strategy 2] SUCCESS - Tour_Id (대문자 T, I) + 숫자");
      return result2;
    }
  } catch (e) {
    console.error("❌ [Strategy 2] Failed:", e);
  }
  
  // 🎯 전략 3: 필드명 소문자 + 문자열 값 (tour_Id: "30")
  try {
    console.log("📍 [Strategy 3] key: 'tour_Id' (소문자), value: '30' (문자열)");
    const constraints3 = [
      { key: "tour_Id", constraint_type: "equals", value: String(tourId) },
    ];
    const result3 = await tryFetchWithConstraints(constraints3, "Strategy 3");
    if (result3) {
      console.log("✅ [Strategy 3] SUCCESS - tour_Id (소문자) + 문자열");
      return result3;
    }
  } catch (e) {
    console.error("❌ [Strategy 3] Failed:", e);
  }
  
  // 🎯 전략 4: 필드명 대문자 ID + 숫자 값 (Tour_ID: 30)
  try {
    console.log("📍 [Strategy 4] key: 'Tour_ID' (대문자 T, ID), value: 30 (숫자)");
    const constraints4 = [
      { key: "Tour_ID", constraint_type: "equals", value: tourId },
    ];
    const result4 = await tryFetchWithConstraints(constraints4, "Strategy 4");
    if (result4) {
      console.log("✅ [Strategy 4] SUCCESS - Tour_ID (대문자 T, ID) + 숫자");
      return result4;
    }
  } catch (e) {
    console.error("❌ [Strategy 4] Failed:", e);
  }
  
  // 🎯 전략 5: constraints 없이 전체 로드 후 find
  try {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📍 [Strategy 5] 전체 데이터 로드 후 find (constraints 없음)");
    console.log("  ⚠️ Constraints 기능이 막혀있을 가능성 테스트");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    const url = `${BASE}/tour`;
    logApiCall("GET", url);
    
    const res = await fetch(url, {
      method: "GET",
      headers: headers(),
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ [Strategy 5] HTTP ${res.status}: ${errorText}`);
      return null;
    }
    
    const json: BubbleListResponse<Tour> = await res.json();
    const allResults = json?.response?.results ?? [];
    
    console.log(`📦 [Strategy 5] 전체 로드: ${allResults.length}개`);
    
    if (allResults.length > 0) {
      console.log("  🔍 [Strategy 5] 첫 3개 데이터 샘플:");
      allResults.slice(0, 3).forEach((tour, idx) => {
        console.log(`    [${idx}] tour_Id: ${tour.tour_Id} (${typeof tour.tour_Id}), name: ${tour.tour_name}`);
      });
    }
    
    // 🎯 다양한 필드명으로 찾기 시도
    const candidates = [
      allResults.find(t => t.tour_Id === tourId),
      allResults.find(t => (t as any).Tour_Id === tourId),
      allResults.find(t => String(t.tour_Id) === String(tourId)),
      allResults.find(t => String((t as any).Tour_Id) === String(tourId)),
    ].filter(Boolean);
    
    if (candidates.length > 0) {
      const found = candidates[0];
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("✅✅✅ [Strategy 5] SUCCESS - 전체 로드 후 find 성공!");
      console.log(`  📌 Found: tour_Id=${found?.tour_Id}, name=${found?.tour_name}`);
      console.log("  ⚠️ 이는 Bubble constraints 기능에 문제가 있다는 증거!");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      
      // 🎯 중복 데이터 처리: Modified Date 기준 최신 선택
      const matchedTours = allResults.filter(t => 
        t.tour_Id === tourId || 
        (t as any).Tour_Id === tourId ||
        String(t.tour_Id) === String(tourId) ||
        String((t as any).Tour_Id) === String(tourId)
      );
      
      if (matchedTours.length > 1) {
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`⚠️ [중복 데이터 발견] tour_Id=${tourId}인 데이터 ${matchedTours.length}개 존재`);
        matchedTours.forEach((tour, idx) => {
          console.log(`  [${idx}] Modified Date: ${tour["Modified Date"]}, Created: ${tour["Created Date"]}`);
        });
        
        // Modified Date 기준 최신 선택
        const sortedByModified = [...matchedTours].sort((a, b) => {
          const dateA = new Date(a["Modified Date"] || a["Created Date"] || 0).getTime();
          const dateB = new Date(b["Modified Date"] || b["Created Date"] || 0).getTime();
          return dateB - dateA; // 내림차순 (최신이 먼저)
        });
        
        const latest = sortedByModified[0];
        console.log(`  ✅ 최신 데이터 선택: Modified Date=${latest["Modified Date"]}`);
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        return latest;
      }
      
      return found || null;  // ✅ undefined → null 변환
    }
    
    console.error("❌ [Strategy 5] 전체 데이터에서도 찾지 못함");
    return null;
  } catch (e) {
    console.error("❌ [Strategy 5] Exception:", e);
    return null;
  }
}

/**
 * Constraints를 사용한 검색 헬퍼 함수
 */
async function tryFetchWithConstraints(
  constraints: Array<{ key: string; constraint_type: string; value: any }>,
  strategyName: string
): Promise<Tour | null> {
  const url = `${BASE}/tour`;
  const params = new URLSearchParams();
  params.append("constraints", JSON.stringify(constraints));
  
  const fullUrl = `${url}?${params.toString()}`;
  
  console.log(`  📤 [${strategyName}] URL: ${fullUrl}`);
  console.log(`  📦 [${strategyName}] Constraints: ${JSON.stringify(constraints)}`);
  
  logApiCall("GET", fullUrl);
  
  const res = await fetch(fullUrl, {
    method: "GET",
    headers: headers(),
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`  ❌ [${strategyName}] HTTP ${res.status}: ${errorText}`);
    return null;
  }
  
  const json: BubbleListResponse<Tour> = await res.json();
  const results = json?.response?.results ?? [];
  
  console.log(`  📥 [${strategyName}] 결과: ${results.length}개`);
  
  if (results.length === 0) {
    return null;
  }
  
  // 🎯 중복 데이터 처리
  if (results.length > 1) {
    console.log(`  ⚠️ [${strategyName}] 중복 데이터 ${results.length}개 발견 - Modified Date 기준 최신 선택`);
    const sorted = [...results].sort((a, b) => {
      const dateA = new Date(a["Modified Date"] || a["Created Date"] || 0).getTime();
      const dateB = new Date(b["Modified Date"] || b["Created Date"] || 0).getTime();
      return dateB - dateA;
    });
    return sorted[0];
  }
  
  return results[0];
}

/**
 * tour_Id로 spot 목록 조회
 * GET /api/1.1/obj/spot with constraints
 * ✅ 테이블명: spot (전체 소문자)
 * ✅ constraints 기반 검색 (URL 끝에 ID 붙이지 않음)
 */
export async function getSpotsByTourId(tourId: number): Promise<Spot[]> {
  const hasBase = !!API_BASE_URL || !!APP_NAME;
  if (!hasBase || !API_TOKEN) return [];
  try {
    const constraints = [
      { key: "tour_Id", constraint_type: "equals", value: tourId },
    ];
    
    const url = `${BASE}/spot`;  // ✅ 소문자 통일
    const params = new URLSearchParams();
    params.append("constraints", JSON.stringify(constraints));
    
    const fullUrl = `${url}?${params.toString()}`;
    
    // 🔍 형님 확인용 로깅
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎯 [getSpotsByTourId] Bubble API 호출");
    console.log(`  📍 전체 URL: ${fullUrl}`);
    console.log(`  📦 Constraints: ${JSON.stringify(constraints)}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    logApiCall("GET", fullUrl);
    
    const res = await fetch(fullUrl, {
      method: "GET",
      headers: headers(),
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.error("🚨 [getSpotsByTourId] 실패!");
      console.error(`  Status: ${res.status}`);
      console.error(`  Response: ${errorText}`);
      console.error(`  URL: ${fullUrl}`);
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      return [];
    }
    
    const json: BubbleListResponse<Spot> = await res.json();
    const results = json?.response?.results ?? [];
    
    console.log(`✅ [getSpotsByTourId] 결과: ${results.length}개`);
    
    return results;
  } catch (e) {
    console.error("getSpotsByTourId", e);
    return [];
  }
}

/**
 * spot_id로 spot_pose 목록 조회 (persona 필터 옵션)
 * GET /api/1.1/obj/spot_pose with constraints
 */
export async function getSpotPosesBySpotId(
  spotId: number,
  persona?: string
): Promise<SpotPose[]> {
  const hasBase = !!API_BASE_URL || !!APP_NAME;
  if (!hasBase || !API_TOKEN) return [];
  try {
    const constraints: Array<{
      key: string;
      constraint_type: string;
      value: number | string;
    }> = [
      { key: "spot_Id", constraint_type: "equals", value: spotId },
    ];
    
    // persona 필터가 있고 '전체'가 아닌 경우에만 추가
    if (persona && persona !== "전체") {
      constraints.push({
        key: "persona",
        constraint_type: "equals",
        value: persona,
      });
    }
    
    const url = `${BASE}/spot_pose`;  // ✅ 소문자 통일
    const params = new URLSearchParams();
    params.append("constraints", JSON.stringify(constraints));
    
    const fullUrl = `${url}?${params.toString()}`;
    logApiCall("GET", fullUrl);
    
    const res = await fetch(fullUrl, {
      method: "GET",
      headers: headers(),
    });
    
    if (!res.ok) {
      console.error("getSpotPosesBySpotId failed:", res.status);
      return [];
    }
    
    const json: BubbleListResponse<SpotPose> = await res.json();
    return json?.response?.results ?? [];
  } catch (e) {
    console.error("getSpotPosesBySpotId", e);
    return [];
  }
}

/**
 * tour_Id로 spot_pose 목록 조회
 * GET /api/1.1/obj/spot_pose with constraints
 * ✅ 테이블명: spot_pose (전체 소문자)
 */
export async function getSpotPosesByTourId(tourId: number): Promise<SpotPose[]> {
  const hasBase = !!API_BASE_URL || !!APP_NAME;
  if (!hasBase || !API_TOKEN) return [];
  try {
    const constraints = [
      { key: "tour_Id", constraint_type: "equals", value: tourId },
    ];
    
    const url = `${BASE}/spot_pose`;  // ✅ 소문자 통일
    const params = new URLSearchParams();
    params.append("constraints", JSON.stringify(constraints));
    
    const fullUrl = `${url}?${params.toString()}`;
    logApiCall("GET", fullUrl);
    
    const res = await fetch(fullUrl, {
      method: "GET",
      headers: headers(),
    });
    
    if (!res.ok) {
      console.error("getSpotPosesByTourId failed:", res.status);
      return [];
    }
    
    const json: BubbleListResponse<SpotPose> = await res.json();
    return json?.response?.results ?? [];
  } catch (e) {
    console.error("getSpotPosesByTourId", e);
    return [];
  }
}

/**
 * tour_Id와 spot_Id, persona로 spot_pose 목록 조회 (최종 이미지 렌더링용)
 * GET /api/1.1/obj/spot_pose with constraints
 * ✅ 테이블명: spot_pose (전체 소문자)
 */
export async function getSpotPosesByFilters(
  tourId: number,
  spotId: number,
  persona?: string
): Promise<SpotPose[]> {
  const hasBase = !!API_BASE_URL || !!APP_NAME;
  if (!hasBase || !API_TOKEN) return [];
  try {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎯 [getSpotPosesByFilters] API 호출:");
    console.log("  📍 tourId:", tourId);
    console.log("  📍 spotId:", spotId);
    console.log("  📍 persona:", persona || "전체");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    const constraints: Array<{
      key: string;
      constraint_type: string;
      value: number | string;
    }> = [
      { key: "tour_Id", constraint_type: "equals", value: tourId },
      { key: "spot_Id", constraint_type: "equals", value: spotId },
    ];
    
    // persona 필터 추가 (전체가 아닌 경우)
    if (persona && persona !== "전체") {
      constraints.push({
        key: "persona",
        constraint_type: "equals",
        value: persona,
      });
    }
    
    const url = `${BASE}/spot_pose`;  // ✅ 소문자 통일
    const params = new URLSearchParams();
    params.append("constraints", JSON.stringify(constraints));
    
    const fullUrl = `${url}?${params.toString()}`;
    console.log("📍 [Bubble API] Final URL:", fullUrl);
    console.log("📍 [Bubble API] Constraints:", JSON.stringify(constraints));
    logApiCall("GET", fullUrl);
    
    const res = await fetch(fullUrl, {
      method: "GET",
      headers: headers(),
    });
    
    if (!res.ok) {
      console.error("getSpotPosesByFilters failed:", res.status);
      return [];
    }
    
    const json: BubbleListResponse<SpotPose> = await res.json();
    const results = json?.response?.results ?? [];
    
    console.log("✅ [Bubble API] getSpotPosesByFilters 결과:", results.length, "개");
    
    return results;
  } catch (e) {
    console.error("getSpotPosesByFilters", e);
    return [];
  }
}

/**
 * tour_Id로 Spot_pose에서 persona 중복 제거하여 추출
 * 선택된 spot_Id에 속한 포즈들의 persona 값만 반환
 */
export async function getPersonasByTourAndSpot(
  tourId: number,
  spotId: number
): Promise<string[]> {
  try {
    // 🚨 [CRITICAL CHECK] 전송할 tourId 값 확인
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🚨 [CRITICAL CHECK] getPersonasByTourAndSpot 호출:");
    console.log("  ✅ Sending tourId:", tourId);
    console.log("  ✅ Sending spotId:", spotId);
    console.log("  ⚠️ tourId가 11093이면 잘못됨! 30처럼 작은 숫자여야 함!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    const allPoses = await getSpotPosesByFilters(tourId, spotId);
    
    // persona 중복 제거
    const uniquePersonas = Array.from(
      new Set(
        allPoses
          .map((pose) => pose.persona)
          .filter((p): p is string => !!p)
      )
    );
    
    console.log(`📋 [Bubble] Found ${uniquePersonas.length} unique personas for tour ${tourId}, spot ${spotId}:`, uniquePersonas);
    
    return uniquePersonas;
  } catch (e) {
    console.error("getPersonasByTourAndSpot", e);
    return [];
  }
}

// ═══════════════════════════════════════════
// review 테이블 연동 + User 조인
// ═══════════════════════════════════════════

/** review 테이블: 고객 리뷰 */
export type BubbleReview = {
  _id: string;
  image?: string;              // 리뷰 이미지 1
  "image-2"?: string;          // 리뷰 이미지 2
  "image-3"?: string;          // 리뷰 이미지 3
  review?: string;             // 리뷰 내용 (text)
  score?: number;              // 별점 (number)
  title?: string;              // 제목 (text)
  "대댓글"?: string;            // 관리자 답글 (text)
  user?: string;               // User ID (Link)
  "Created Date"?: string;
  "Modified Date"?: string;
  // 조인된 유저 정보 (프론트 전달용)
  _user_nickname?: string;
  _user_image?: string;
  [key: string]: any;
};

/**
 * Bubble User 단일 조회 (닉네임/프로필 사진 조인용)
 * GET /api/1.1/obj/user/{id}
 * 
 * 필드명 패턴:
 *   닉네임: "(new)nickname", "new)nickname", "nickname", "name" 등
 *   프로필: "(new)image", "(new ( image )", "new)image", "image", "profile_image" 등
 */
async function fetchBubbleUser(userId: string): Promise<{ nickname: string; image: string }> {
  const fallback = { nickname: "치이즈 고객님", image: "" };
  if (!userId) return fallback;
  try {
    const url = `${BASE}/user/${userId}`;
    const res = await fetch(url, { method: "GET", headers: headers() });
    if (!res.ok) {
      console.warn(`  [fetchBubbleUser] HTTP ${res.status} for userId=${userId}`);
      return fallback;
    }
    const json = await res.json();
    const user = json?.response;
    if (!user) return fallback;

    const keys = Object.keys(user);
    console.log(`  👤 [fetchBubbleUser] userId=${userId}, keys:`, keys.join(", "));

    // ─ 닉네임 필드 탐색 (우선순위: 정확 → 포함)
    const nickKey =
      keys.find(k => k === "(new)nickname") ||
      keys.find(k => k.toLowerCase().replace(/[\s()]/g, "").includes("newnickname")) ||
      keys.find(k => k.toLowerCase().includes("nickname")) ||
      keys.find(k => k === "name") ||
      "";

    // ─ 프로필 이미지 필드 탐색 (우선순위: 정확 → 포함)
    // "(new ( image ))" — 괄호·공백 포함 가능
    const imgKey =
      keys.find(k => k === "(new)image") ||
      keys.find(k => k.toLowerCase().replace(/[\s()]/g, "").includes("newimage")) ||
      keys.find(k => k.toLowerCase().replace(/[\s()]/g, "") === "image") ||
      keys.find(k => k === "image") ||
      keys.find(k => k.toLowerCase().includes("profile") && k.toLowerCase().includes("image")) ||
      "";

    const nickname = user[nickKey] || fallback.nickname;
    const image = user[imgKey] || fallback.image;

    console.log(`  👤 [fetchBubbleUser] 결과: nickKey="${nickKey}"="${nickname}", imgKey="${imgKey}"="${image ? "(있음)" : "(없음)"}"`);

    return { nickname, image };
  } catch (e) {
    console.warn(`  [fetchBubbleUser] Exception for userId=${userId}:`, e);
    return fallback;
  }
}

/**
 * review 테이블에서 리뷰 목록 조회 + User 조인
 * 
 * 1. review 테이블에서 최신 20건 조회
 * 2. 각 review의 user 필드(ID)로 User 테이블에서 닉네임/프로필 조인
 * 3. 조인 실패 시 "치이즈 고객님" + 기본 아바타 fallback
 * 
 * GET /api/1.1/obj/review
 */
export async function fetchReviews(): Promise<BubbleReview[]> {
  const hasBase = !!API_BASE_URL || !!APP_NAME;
  if (!hasBase || !API_TOKEN) {
    console.warn("[fetchReviews] Bubble API 설정 없음");
    return [];
  }
  try {
    const sortParams = new URLSearchParams();
    sortParams.append("sort_field", "Modified Date");
    sortParams.append("descending", "true");
    sortParams.append("limit", "20");

    const url = `${BASE}/review?${sortParams.toString()}`;
    logApiCall("GET", url);

    const res = await fetch(url, { method: "GET", headers: headers() });
    if (!res.ok) {
      console.error(`[fetchReviews] HTTP ${res.status}`);
      return [];
    }

    const json: BubbleListResponse<BubbleReview> = await res.json();
    const results = json?.response?.results ?? [];

    console.log(`📝 [fetchReviews] ${results.length}개 리뷰 로드 완료`);
    if (results.length > 0) {
      console.log("  🔑 Keys:", Object.keys(results[0]).join(", "));
    }

    // ─── 필드 정규화 & 디버깅 ───
    // Bubble은 필드명이 정확히 "review"가 아닐 수 있음 (대소문자, 공백 등)
    for (const item of results) {
      const keys = Object.keys(item);

      // review 필드 탐색 (정확 매칭 → 유사 매칭)
      if (item["review"] === undefined) {
        const reviewKey = keys.find(k =>
          k.toLowerCase() === "review" || k.toLowerCase().includes("review")
        );
        if (reviewKey && reviewKey !== "review") {
          console.log(`  🔄 [fetchReviews] review 필드명 보정: "${reviewKey}" → "review"`);
          item["review"] = item[reviewKey];
        }
      }

      // title 필드 탐색
      if (item["title"] === undefined) {
        const titleKey = keys.find(k =>
          k.toLowerCase() === "title" || k.toLowerCase().includes("title")
        );
        if (titleKey && titleKey !== "title") {
          console.log(`  🔄 [fetchReviews] title 필드명 보정: "${titleKey}" → "title"`);
          item["title"] = item[titleKey];
        }
      }

      // score 필드 탐색
      if (item["score"] === undefined) {
        const scoreKey = keys.find(k =>
          k.toLowerCase() === "score" || k.toLowerCase().includes("score") || k.toLowerCase().includes("rating")
        );
        if (scoreKey && scoreKey !== "score") {
          item["score"] = item[scoreKey];
        }
      }

      // 디버깅 로그 (각 리뷰의 실제 내용 확인)
      console.log("Review Content Check:", {
        _id: item._id,
        review: item.review,
        reviewType: typeof item.review,
        reviewLength: item.review?.length ?? 0,
        title: item.title,
        score: item.score,
        hasImage: !!item.image,
      });
    }

    // ─── 첫 번째 아이템 전체 덤프 (디버깅용) ───
    if (results.length > 0) {
      const first = results[0];
      const dump: Record<string, any> = {};
      for (const k of Object.keys(first)) {
        const val = first[k];
        dump[k] = typeof val === "string" && val.length > 80 ? val.slice(0, 80) + "…" : val;
      }
      console.log("  📦 [fetchReviews] 첫 번째 리뷰 전체:", JSON.stringify(dump, null, 2));
    }

    // User 조인: 고유 userId 수집 → 일괄 조회 → 매핑
    const userIds = [...new Set(
      results.map(r => {
        const uid = r.user || r['Created By'] || "";
        return typeof uid === "string" ? uid : (uid as any)?._id || "";
      }).filter(Boolean)
    )];

    console.log(`  👥 유저 조인 대상: ${userIds.length}명`);

    const userMap = new Map<string, { nickname: string; image: string }>();
    // 병렬 조회 (최대 10명)
    await Promise.all(
      userIds.slice(0, 10).map(async (uid) => {
        const userData = await fetchBubbleUser(uid);
        userMap.set(uid, userData);
      })
    );

    // 조인 결과 주입
    for (const review of results) {
      const uid = typeof review.user === "string"
        ? review.user
        : (review.user as any)?._id || review['Created By'] || "";
      const userData = userMap.get(uid) || { nickname: "치이즈 고객님", image: "" };
      review._user_nickname = userData.nickname;
      review._user_image = userData.image;
    }

    return results;
  } catch (e) {
    console.error("[fetchReviews] Exception:", e);
    return [];
  }
}
