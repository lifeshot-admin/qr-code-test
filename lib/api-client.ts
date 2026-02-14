/**
 * Cheiz API Client (Swagger-Compliant)
 * Base URL: https://api.lifeshot.me
 * 
 * ⚠️ CRITICAL: All field names MUST match Swagger documentation exactly
 * - Use snake_case for API payloads (e.g., tour_id, user_id)
 * - Response types must match Swagger schema
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";

/**
 * Standard Swagger Response Envelope
 */
export type SwaggerResponse<T = any> = {
  statusCode: number;
  message: string;
  code: string;
  data: T;
};

/**
 * Request headers with optional auth token
 * ✅ 세션에서 accessToken을 강제로 가져옴
 */
async function getHeaders(includeAuth: boolean = false): Promise<HeadersInit> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (includeAuth) {
    let token: string | null = null;

    // 클라이언트 사이드에서만 실행
    if (typeof window !== "undefined") {
      console.log("🔍 [API Client] Searching for auth token...");

      // 1. NextAuth 세션에서 토큰 가져오기 (최우선)
      try {
        const { getSession } = await import("next-auth/react");
        const session = await getSession();
        
        console.log("📋 [API Client] Session data:", {
          hasSession: !!session,
          hasUser: !!session?.user,
          userEmail: session?.user?.email,
          userNickname: (session?.user as any)?.nickname,
          hasAccessToken: !!(session as any)?.accessToken,
        });

        if (session) {
          // accessToken은 session 객체 최상위에 있음
          token = (session as any).accessToken || null;
          
          if (token) {
            console.log("✅ [API Client] Token found in NextAuth session");
          } else {
            console.warn("⚠️ [API Client] Session exists but accessToken is missing!");
          }
        }
      } catch (error) {
        console.error("❌ [API Client] Failed to get NextAuth session:", error);
      }

      // 2. sessionStorage 폴백 (레거시)
      if (!token) {
        token = sessionStorage.getItem("auth_token");
        if (token) {
          console.log("✅ [API Client] Token found in sessionStorage (legacy)");
        }
      }
    }
    
    if (token) {
      // ✅ Validate token before adding to headers
      const tokenPrefix = token.substring(0, 10);
      
      // 🚨 REJECT FAKE TOKENS!
      if (token.startsWith('temp_')) {
        console.error("🚨🚨🚨 [API Client] FAKE TOKEN DETECTED!");
        console.error("🚨 [API Client] Token prefix:", tokenPrefix);
        console.error("🚨 [API Client] This is a mock/temporary token!");
        console.error("🚨 [API Client] ABORTING API CALL!");
        throw new Error("Cannot make API call with fake temp_ token. Please re-login with valid backend credentials.");
      }
      
      if (token.startsWith('ya29') || token.startsWith('gho_')) {
        console.error("🚨🚨🚨 [API Client] OAUTH TOKEN DETECTED!");
        console.error("🚨 [API Client] Token prefix:", tokenPrefix);
        console.error("🚨 [API Client] Backend does not accept OAuth tokens directly!");
        console.error("🚨 [API Client] Token should have been exchanged in signIn callback!");
        console.error("🚨 [API Client] ABORTING API CALL!");
        throw new Error("Cannot make API call with OAuth token. Backend requires JWT. Please re-login.");
      }
      
      // ✅ Token is valid, add to headers with Bearer prefix
      // 🔍 Check if Bearer is already present (중복 방지)
      let finalToken = token;
      if (token.startsWith('Bearer ')) {
        console.warn("⚠️ [API Client] Token already has 'Bearer ' prefix, using as-is");
        finalToken = token; // Already has Bearer
      } else if (token.startsWith('bearer ')) {
        console.warn("⚠️ [API Client] Token has lowercase 'bearer ' prefix, normalizing to 'Bearer '");
        finalToken = 'Bearer ' + token.substring(7); // Normalize to Bearer
      } else {
        // ✅ Add Bearer prefix (일반적인 경우)
        finalToken = `Bearer ${token}`;
      }
      
      headers["Authorization"] = finalToken;
      
      let tokenType = "Unknown";
      let isValid = false;
      const pureToken = finalToken.replace(/^Bearer\s+/i, ''); // Bearer 제거한 순수 토큰
      
      if (pureToken.startsWith('eyJ')) {
        tokenType = '✅ JWT Token (Standard)';
        isValid = true;
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("🔍 [API Client] ✅ REAL JWT FOUND!");
        console.log("  - Pure token prefix: eyJ (VALID JWT)");
        console.log("  - First 20 chars:", pureToken.substring(0, 20) + "...");
        console.log("  - Last 20 chars:", "..." + pureToken.substring(pureToken.length - 20));
        console.log("  - Total length:", pureToken.length);
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      } else if (pureToken.length > 20 && !pureToken.includes(' ')) {
        tokenType = '✅ Custom Backend Token';
        isValid = true;
      } else {
        tokenType = '⚠️ Unknown Token Format';
        isValid = false;
      }
      
      console.log("🔐 [API Client] Authorization header added: Bearer " + pureToken.substring(0, 10) + "...");
      console.log("🔑 [API Client] Token type:", tokenType);
      console.log("🔍 [API Client] Token prefix (first 10 chars):", pureToken.substring(0, 10));
      console.log("🔍 [API Client] Token length:", pureToken.length);
      console.log("✅ [API Client] Token valid:", isValid ? "YES ✅" : "MAYBE ⚠️");
      
      // ✅ [최종 검증] 전체 헤더 형식 출력
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🔐🔐🔐 [Final Header Check]");
      console.log("Full Authorization Header:");
      console.log(`  Authorization: ${finalToken.substring(0, 50)}...`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      
      if (!isValid) {
        console.warn("⚠️ [API Client] Unknown token format, proceeding anyway...");
      }
    } else {
      console.error("🚨🚨🚨 [API Client] NO AUTH TOKEN FOUND!");
      console.error("🚨 [API Client] API call will FAIL with 401 Unauthorized");
      console.error("🚨 [API Client] Please login first!");
      throw new Error("No authentication token available. Please login first.");
    }
  }

  return headers;
}

/**
 * Generic API caller with Swagger response handling
 */
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {},
  requireAuth: boolean = false
): Promise<SwaggerResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📡 [API Call] ${options.method || "GET"} ${url}`);
  
  // ✅ Await headers (now async)
  const headers = await getHeaders(requireAuth);
  
  // ✅ [강제] 최종 머지된 헤더 생성 (fetch에 전달될 실제 헤더)
  const finalHeaders = {
    ...headers,
    ...options.headers,
  };
  
  // ✅ [증거] 최종 전송 헤더 로그 출력 (형님이 눈으로 확인)
  if (requireAuth) {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🚀🚀🚀 [REAL OUTGOING HEADER] 실제 백엔드로 전송되는 헤더:");
    
    const finalHeadersObj = finalHeaders as Record<string, string>;
    if (finalHeadersObj['Authorization']) {
      const authHeader = finalHeadersObj['Authorization'];
      
      // ✅ 전체 Authorization 헤더 출력 (최소 100자)
      const displayLength = Math.min(authHeader.length, 150);
      console.log(`🚀 [REAL OUTGOING HEADER] Authorization: ${authHeader.substring(0, displayLength)}${authHeader.length > displayLength ? '...' : ''}`);
      console.log(`   → Full length: ${authHeader.length} chars`);
      
      // ✅ Bearer 접두사 강제 확인
      if (authHeader.startsWith('Bearer ')) {
        console.log("   ✅ Bearer 접두사: 정상 (Bearer 포함) ✅");
        console.log(`   ✅ Pure token starts with: ${authHeader.substring(7, 17)}...`);
      } else {
        console.error("   🚨🚨🚨 Bearer 접두사: 누락! (백엔드 인증 실패 확실!) 🚨🚨🚨");
        console.error(`   🚨 Current header: ${authHeader.substring(0, 50)}...`);
        console.error("   🚨 Expected format: Bearer eyJ...");
      }
    } else {
      console.error("🚨🚨🚨 [CRITICAL] Authorization 헤더가 최종 헤더에 없습니다!");
      console.error("🚨 API 호출이 401 Unauthorized로 실패할 것입니다!");
    }
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  }
  
  const response = await fetch(url, {
    ...options,
    headers: finalHeaders,
  });

  if (!response.ok) {
    const error: SwaggerResponse = await response.json().catch(() => ({
      statusCode: response.status,
      message: "API request failed",
      code: "ERROR",
      data: null,
    }));
    console.error("[API Error]", error);
    throw new Error(error.message || "API request failed");
  }

  const data: SwaggerResponse<T> = await response.json();
  console.log("[API Success]", data);
  
  return data;
}

// ==================== AUTH APIs (Swagger 명세 기준) ====================

/**
 * [Step 01] 이메일 중복 체크
 * POST /api/v1/auth/email/check
 * Swagger: body { email: string }
 * 
 * ⚠️ 백엔드 응답 해석:
 *   - 200 OK + data.exists === true → 이미 가입된 이메일 (중복)
 *   - 200 OK + data.exists === false → 사용 가능
 *   - 200 OK (exists 필드 없음) → 이메일이 DB에 존재함 (중복)
 *   - 404 Not Found → 이메일이 DB에 없음 (사용 가능)
 *   - 409 Conflict → 이미 존재 (중복)
 * 
 * 반환: { ...SwaggerResponse, available: boolean }
 */
export async function checkEmail(email: string): Promise<SwaggerResponse & { available: boolean }> {
  const url = `${API_BASE_URL}/api/v1/auth/email/check`;

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("[API REQUEST] Duplication Check:", email);
  console.log("📡 [checkEmail] POST", url);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  const statusCode = response.status;
  console.log("[API RESPONSE] Status:", statusCode);

  // ─── Case 1: 404 Not Found → 이메일이 DB에 없음 → 가입 가능 ───
  if (statusCode === 404) {
    console.log("[API RESPONSE] 404 = 이메일이 DB에 없습니다 → 사용 가능");
    return {
      statusCode: 404,
      message: "사용 가능한 이메일입니다.",
      code: "NOT_FOUND",
      data: null,
      available: true,
    };
  }

  // ─── Case 2: 409 Conflict → 이미 존재 → 중복 ───
  if (statusCode === 409) {
    console.log("[API RESPONSE] 409 = 이미 가입된 이메일 → 중복");
    const body = await response.json().catch(() => null);
    console.log("[API RESPONSE]:", body);
    return {
      statusCode: 409,
      message: "이미 가입된 이메일입니다.",
      code: "CONFLICT",
      data: body?.data || null,
      available: false,
    };
  }

  // ─── Case 3: 200 OK → 응답 데이터 분석 필요 ───
  if (response.ok) {
    const body: SwaggerResponse = await response.json().catch(() => ({
      statusCode: 200,
      message: "OK",
      code: "SUCCESS",
      data: null,
    }));
    console.log("[API RESPONSE]:", body);

    // 3-a: exists 필드가 명시적으로 있는 경우
    if (body.data && typeof body.data === "object" && "exists" in body.data) {
      const exists = body.data.exists;
      console.log("[API RESPONSE] exists 필드 발견:", exists);
      return {
        ...body,
        available: !exists,
      };
    }

    // 3-b: available 필드가 있는 경우
    if (body.data && typeof body.data === "object" && "available" in body.data) {
      const available = body.data.available;
      console.log("[API RESPONSE] available 필드 발견:", available);
      return {
        ...body,
        available: !!available,
      };
    }

    // 3-c: 특별한 필드 없이 200 OK만 온 경우
    // → Swagger에서 200 = "이메일이 존재함(중복)" 일 수도 있고 "체크 성공(사용가능)" 일 수도 있음
    // → 안전하게: message/code에 "exist" 또는 "duplicate" 키워드가 있으면 중복 처리
    const msgLower = (body.message || "").toLowerCase();
    const codeLower = (body.code || "").toLowerCase();
    if (
      msgLower.includes("exist") || msgLower.includes("duplicate") ||
      msgLower.includes("이미") || msgLower.includes("중복") ||
      codeLower.includes("exist") || codeLower.includes("duplicate") ||
      codeLower.includes("conflict")
    ) {
      console.log("[API RESPONSE] 200 OK + 중복 관련 메시지 감지 → 중복");
      return { ...body, available: false };
    }

    // 3-d: 200 OK + 특별한 키워드 없음 → 사용 가능으로 판단
    console.log("[API RESPONSE] 200 OK + 특별한 필드/키워드 없음 → 사용 가능으로 판단");
    return { ...body, available: true };
  }

  // ─── Case 4: 기타 에러 (400, 500 등) ───
  const errorBody = await response.json().catch(() => ({
    statusCode,
    message: "API request failed",
    code: "ERROR",
    data: null,
  }));
  console.error("[API RESPONSE] Error:", statusCode, errorBody);
  // 에러 메시지에 상태 코드를 포함시켜 catch 블록에서 판별 가능하도록
  throw new Error(`[${statusCode}] ${errorBody.message || "이메일 확인에 실패했습니다."}`);
}

/**
 * [Step 01] 이메일 인증 여부 확인
 * POST /api/v1/auth/email/verified
 * Swagger: body { email: string }
 */
export async function checkEmailVerified(email: string): Promise<SwaggerResponse> {
  return apiCall("/api/v1/auth/email/verified", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

/**
 * [Step 03] 이메일 인증 코드 발송 (회원가입용)
 * POST /api/v1/auth/email/code/send
 * Swagger: body { email: string }, header: Accept-Language
 */
export async function sendVerificationCode(
  email: string,
  language: string = "ko"
): Promise<SwaggerResponse> {
  return apiCall("/api/v1/auth/email/code/send", {
    method: "POST",
    headers: { "Accept-Language": language },
    body: JSON.stringify({ email }),
  });
}

/**
 * [Step 04] 이메일 인증 코드 검증 (회원가입용)
 * POST /api/v1/auth/email/code/verify
 * ⚠️ /reset-password 는 비밀번호 재설정 전용이므로 회원가입에 사용하지 않음
 * Swagger: body { email: string, code: string }
 */
export async function verifyEmailCode(
  email: string,
  code: string
): Promise<SwaggerResponse> {
  return apiCall("/api/v1/auth/email/code/verify", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}

/**
 * [Step 05] 닉네임 중복 체크
 * GET /api/v1/auth/nickname/check?nickname=
 * Swagger: query { nickname: string (required) }
 */
export async function checkNickname(
  nickname: string
): Promise<SwaggerResponse> {
  return apiCall(`/api/v1/auth/nickname/check?nickname=${encodeURIComponent(nickname)}`);
}

/**
 * [Step 02] 약관 조회
 * GET /api/v1/auth/terms/policies
 * Swagger: query { language, active, required, policyType, page, size, sortBy, sortDir }
 * policyType enum: SERVICE_TERMS, PRIVACY_SIGNUP, PRIVACY_PAYMENT, PRIVACY_PHOTO, PRIVACY_PHONE, MARKETING_CONSENT
 */
export type TermsPolicy = {
  id: number;
  title: string;
  content: string;
  policyType: string;
  version: string;
  isActive: boolean;
  isRequired: boolean;
  url: string;
};

export async function getTermsPolicies(
  language: string = "ko"
): Promise<SwaggerResponse<TermsPolicy[]>> {
  return apiCall(`/api/v1/auth/terms/policies?language=${language}&active=true`);
}

/**
 * [Step 02] 약관 동의 (건별 전송)
 * POST /api/v1/auth/terms/agreement
 * Swagger: body { email: string, policyType: string, agreed: boolean }
 * ⚠️ 기존 코드는 배열로 전송했으나, Swagger 스펙은 건별 전송임!
 */
export async function submitTermsAgreement(
  email: string,
  policyType: string,
  agreed: boolean
): Promise<SwaggerResponse> {
  return apiCall("/api/v1/auth/terms/agreement", {
    method: "POST",
    body: JSON.stringify({ email, policyType, agreed }),
  });
}

/**
 * [Step 02] 약관 동의 일괄 전송 (편의 함수 - 내부적으로 건별 호출)
 */
export async function submitAllTermsAgreements(
  email: string,
  agreements: { policyType: string; agreed: boolean }[]
): Promise<SwaggerResponse[]> {
  const results: SwaggerResponse[] = [];
  for (const agreement of agreements) {
    const result = await submitTermsAgreement(email, agreement.policyType, agreement.agreed);
    results.push(result);
  }
  return results;
}

/**
 * [Step 02] 약관 동의 여부 확인
 * POST /api/v1/auth/terms/agreement/check
 * Swagger: body { email: string, policyType: string }
 */
export async function checkTermsAgreement(
  email: string,
  policyType: string
): Promise<SwaggerResponse> {
  return apiCall("/api/v1/auth/terms/agreement/check", {
    method: "POST",
    headers: { "Accept-Language": "ko" },
    body: JSON.stringify({ email, policyType }),
  });
}

/**
 * [Step 07] 회원가입 (최종)
 * POST /api/v1/auth/signup
 * Swagger: body { nickname, email, password, language, socialId?, socialType? }
 * ⚠️ 응답 Authorization 헤더에서 토큰 추출 필요
 */
export type SignupPayload = {
  nickname: string;
  email: string;
  password: string;
  language: string;
  socialId?: string;
  socialType?: string;
};

export async function signup(payload: SignupPayload): Promise<{
  response: SwaggerResponse;
  accessToken: string | null;
}> {
  const url = `${API_BASE_URL}/api/v1/auth/signup`;
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📡 [Signup] POST", url);
  console.log("📦 [Signup] Payload:", JSON.stringify(payload, null, 2));
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  // Authorization 헤더에서 토큰 추출
  let accessToken: string | null = null;
  const authHeader = response.headers.get("authorization") || response.headers.get("Authorization");
  if (authHeader) {
    accessToken = authHeader.startsWith("Bearer ")
      ? authHeader.substring(7)
      : authHeader.startsWith("bearer ")
      ? authHeader.substring(7)
      : authHeader;
    console.log("✅ [Signup] Token extracted from header:", accessToken.substring(0, 20) + "...");
  }

  if (!response.ok) {
    const error: SwaggerResponse = await response.json().catch(() => ({
      statusCode: response.status,
      message: "회원가입에 실패했습니다.",
      code: "ERROR",
      data: null,
    }));
    console.error("❌ [Signup] Failed:", error);
    throw new Error(error.message || "회원가입에 실패했습니다.");
  }

  const data: SwaggerResponse = await response.json();
  console.log("✅ [Signup] Success:", data);
  
  return { response: data, accessToken };
}

/**
 * [Step 06] 프로필 사진 업로드
 * POST /api/v1/profile/{userId}/photo
 * Swagger: multipart/form-data, field: file (string($binary))
 * ⚠️ 가입 후 발급된 토큰을 사용하여 호출
 */
export async function uploadProfileImage(
  userId: number | string,
  file: File,
  accessToken: string
): Promise<SwaggerResponse> {
  const url = `${API_BASE_URL}/api/v1/profile/${userId}/photo`;
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📡 [Profile Upload] POST", url);
  console.log("📦 [Profile Upload] File:", file.name, file.size, "bytes");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error: SwaggerResponse = await response.json().catch(() => ({
      statusCode: response.status,
      message: "프로필 사진 업로드에 실패했습니다.",
      code: "ERROR",
      data: null,
    }));
    console.error("❌ [Profile Upload] Failed:", error);
    throw new Error(error.message || "프로필 사진 업로드에 실패했습니다.");
  }

  const data: SwaggerResponse = await response.json().catch(() => ({
    statusCode: 200,
    message: "프로필 사진 업로드 성공",
    code: "SUCCESS",
    data: null,
  }));
  console.log("✅ [Profile Upload] Success:", data);
  return data;
}

/**
 * 프로필 사진 조회
 * GET /api/v1/profile/{userId}/photo
 */
export async function getProfileImage(userId: number | string): Promise<SwaggerResponse> {
  return apiCall(`/api/v1/profile/${userId}/photo`, {}, true);
}

// ==================== USER APIs ====================

/**
 * Get user tours/folders
 * GET /api/v1/folders
 * ✅ SWAGGER SPEC - EXACT MAPPING
 */
export type Tour = {
  id: number; // 폴더 ID
  name: string; // ✅ 투어 제목 (Swagger: item.name)
  scheduleResponse: {
    id: number;
    tourDTO: {
      id: number;
      name: string;
      thumbnailImageUrl: string; // ✅ 썸네일 (Swagger: item.scheduleResponse.tourDTO.thumbnailImageUrl)
      location?: string;
      address?: string;
      [key: string]: any;
    };
    startTime: string; // ✅ 촬영 일정 (Swagger: item.scheduleResponse.startTime) - ISO 8601
    endTime: string;
    [key: string]: any;
  };
  hostUser: {
    id: number;
    nickname: string; // ✅ 호스트 닉네임 (Swagger: item.hostUser.nickname)
    profileImageUrl: string | null; // ✅ 호스트 프로필 (Swagger: item.hostUser.profileImageUrl)
    [key: string]: any;
  };
  status: "PAYMENT_IN_PROGRESS" | "RESERVED" | "PENDING" | "COMPLETED" | "CANCELED" | "NO_SHOW" | "CANCELED_BY_SCHEDULE";
  personCount: number;
  createdAt: string;
  isHidden: boolean;
  isDeleted: boolean;
  [key: string]: any;
};

export async function getUserTours(
  userId: string,
  statusSet?: string // ✅ SWAGGER SPEC: statusSet (예: "RESERVED")
): Promise<SwaggerResponse<any>> {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🎯 [getUserTours] Called with REAL userId:", userId);
  console.log("🔢 [getUserTours] userId type:", typeof userId);
  
  // ✅ Use userId parameter (camelCase - Swagger spec)
  const params = new URLSearchParams({ userId: userId });
  
  // ✅ SWAGGER SPEC: statusSet parameter (예: RESERVED)
  if (statusSet) {
    params.append("statusSet", statusSet);
    console.log("🔍 [getUserTours] statusSet filter:", statusSet);
  } else {
    console.log("⚠️ [getUserTours] No statusSet filter (모든 상태 조회)");
  }
  
  const fullUrl = `/api/v1/folders?${params.toString()}`;
  console.log("📤 [getUserTours] Request params:", params.toString());
  console.log("📤 [getUserTours] Full URL:", fullUrl);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🚀 [getUserTours] API 호출 시작...");
  console.log("🚀 [리스트 조회] statusSet=RESERVED + Bearer 헤더 포함 여부 확인:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  const response = await apiCall<any>(fullUrl, {}, true);
  
  // ✅ [강제] RAW 데이터 로그 출력 (전체 JSON 구조 확인)
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔥🔥🔥 [RAW RESPONSE BODY] 서버 응답 전체:");
  console.log(JSON.stringify(response, null, 2));
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔥 [RAW RESPONSE] response 객체:", response);
  console.log("🔥 [RAW RESPONSE] response.data:", response.data);
  console.log("🔥 [RAW RESPONSE] typeof response.data:", typeof response.data);
  console.log("🔥 [RAW RESPONSE] Array.isArray(response.data):", Array.isArray(response.data));
  console.log("🔥 [RAW RESPONSE] response.data.content:", response.data?.content);
  console.log("🔥 [RAW RESPONSE] typeof response.data.content:", typeof response.data?.content);
  console.log("🔥 [RAW RESPONSE] Array.isArray(response.data.content):", Array.isArray(response.data?.content));
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📥 [getUserTours] Response received:");
  console.log("  ✅ statusCode:", response.statusCode);
  console.log("  ✅ message:", response.message);
  console.log("  ✅ data type:", typeof response.data);
  console.log("  ✅ data.content exists:", !!response.data?.content);
  console.log("  ✅ data.content is array:", Array.isArray(response.data?.content));
  console.log("  ✅ data.content length:", response.data?.content?.length || 0);
  
  // ✅ [수정] 추출 경로 재설정 - 유연한 데이터 추출
  let toursData: any[] = [];
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔍 [Data Extraction] 데이터 추출 시도:");
  
  // 방법 1: response.data.content (SwaggerResponse 타입 기준)
  if (response.data?.content && Array.isArray(response.data.content)) {
    toursData = response.data.content;
    console.log("  ✅ [Method 1] response.data.content에서 추출 성공:", toursData.length, "개");
  }
  // 방법 2: response.content (실제 Swagger API 응답 기준)
  else if ((response as any).content && Array.isArray((response as any).content)) {
    toursData = (response as any).content;
    console.log("  ✅ [Method 2] response.content에서 추출 성공:", toursData.length, "개");
  }
  // 방법 3: response.data 자체가 배열
  else if (Array.isArray(response.data)) {
    toursData = response.data;
    console.log("  ✅ [Method 3] response.data 자체가 배열:", toursData.length, "개");
  }
  // 방법 4: response 자체가 배열
  else if (Array.isArray(response)) {
    toursData = response;
    console.log("  ✅ [Method 4] response 자체가 배열:", toursData.length, "개");
  }
  else {
    console.error("  ❌ [Data Extraction] 모든 방법 실패! 데이터를 찾을 수 없습니다.");
    console.error("  🔍 response 구조를 확인하세요 (위의 RAW RESPONSE 로그 참조)");
  }
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  if (toursData.length > 0) {
    console.log("  📦 First tour sample (Swagger spec):");
    const sample = toursData[0];
    console.log("    - id:", sample.id);
    console.log("    - name:", sample.name);
    console.log("    - scheduleResponse.tourDTO.thumbnailImageUrl:", sample.scheduleResponse?.tourDTO?.thumbnailImageUrl);
    console.log("    - scheduleResponse.startTime:", sample.scheduleResponse?.startTime);
    console.log("    - hostUser.nickname:", sample.hostUser?.nickname);
    console.log("    - hostUser.profileImageUrl:", sample.hostUser?.profileImageUrl);
    console.log("    - status:", sample.status, "(✅ RESERVED 상태 확인)");
  } else {
    console.warn("  ⚠️ [Data Extraction] 추출된 데이터가 0개입니다.");
    console.warn("  ⚠️ statusSet=RESERVED 조건으로 데이터가 없을 수 있습니다.");
    console.warn("  ⚠️ 확인을 위해 statusSet을 제거하거나 다른 상태로 테스트하세요.");
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  return response;
}

// ==================== ORDER APIs ====================

/**
 * Create pose selection order
 * POST /api/v1/orders
 */
export type CreateOrderPayload = {
  tour_id: string;
  selected_pose_ids: string[];
  user_id: string;
  timestamp: string;
};

export async function createPoseOrder(
  payload: CreateOrderPayload
): Promise<SwaggerResponse<{ order_id: string }>> {
  return apiCall("/api/v1/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  }, true);
}

// ==================== UTILITY ====================

/**
 * Save auth token to session
 */
export function saveAuthToken(token: string): void {
  if (typeof window !== "undefined") {
    sessionStorage.setItem("auth_token", token);
  }
}

/**
 * Clear auth token
 */
export function clearAuthToken(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem("auth_token");
  }
}
