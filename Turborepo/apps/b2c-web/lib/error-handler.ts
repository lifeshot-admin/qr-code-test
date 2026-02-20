/**
 * 전역 에러 핸들링 유틸리티
 *
 * HTTP 상태 코드, 백엔드 커스텀 에러 코드, 일반 예외를
 * 사용자 친화적 한글 메시지로 변환합니다.
 */

// ━━━ HTTP 상태 코드 → 한글 메시지 ━━━
const HTTP_STATUS_MESSAGES: Record<number, string> = {
  400: "요청 형식이 올바르지 않습니다. 입력값을 다시 확인해주세요.",
  401: "로그인이 필요합니다. 다시 로그인해주세요.",
  403: "접근 권한이 없습니다.",
  404: "요청하신 정보를 찾을 수 없습니다.",
  408: "서버 응답이 너무 오래 걸리고 있습니다. 잠시 후 다시 시도해주세요.",
  409: "이미 처리된 요청입니다. 중복 작업인지 확인해주세요.",
  413: "파일 크기가 너무 큽니다. 용량을 줄여 다시 시도해주세요.",
  422: "입력 정보가 올바르지 않습니다. 다시 확인해주세요.",
  429: "요청이 너무 빈번합니다. 잠시 후 다시 시도해주세요.",
  500: "서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
  502: "서버 연결에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
  503: "서비스가 일시적으로 중단되었습니다. 잠시 후 다시 시도해주세요.",
  504: "서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.",
};

// ━━━ 백엔드 커스텀 에러 코드 → 한글 메시지 ━━━
const BACKEND_ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "로그인이 만료되었습니다. 다시 로그인해주세요.",
  FORBIDDEN: "접근 권한이 없습니다.",
  NOT_FOUND: "요청하신 정보를 찾을 수 없습니다.",
  DUPLICATE_RESERVATION: "이미 예약된 투어입니다.",
  INVALID_STATUS: "현재 상태에서는 해당 작업을 수행할 수 없습니다.",
  PAYMENT_FAILED: "결제 처리에 실패했습니다. 결제 정보를 확인해주세요.",
  PAYMENT_MINIMUM: "결제 최소 금액은 500원입니다.",
  SESSION_EXPIRED: "세션이 만료되었습니다. 다시 로그인해주세요.",
  NETWORK_ERROR: "네트워크 연결을 확인해주세요.",
  FILE_TOO_LARGE: "파일 크기가 너무 큽니다. 용량을 줄여 다시 시도해주세요.",
  UPLOAD_FAILED: "파일 업로드에 실패했습니다. 다시 시도해주세요.",
  AI_PROCESSING_FAILED: "AI 보정 처리에 실패했습니다. 다시 시도해주세요.",
  RESERVATION_NOT_FOUND: "예약 정보를 찾을 수 없습니다.",
  TOUR_NOT_FOUND: "투어 정보를 찾을 수 없습니다.",
  BUBBLE_API_ERROR: "데이터 서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.",
};

// ━━━ 일반 에러 키워드 → 한글 메시지 ━━━
const ERROR_KEYWORD_MAP: [RegExp, string][] = [
  [/fetch failed|network|ECONNREFUSED/i, "네트워크 연결에 실패했습니다. 인터넷 연결을 확인해주세요."],
  [/timeout|ETIMEDOUT/i, "서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요."],
  [/JSON\.parse|Unexpected token/i, "서버 응답을 처리하는 중 문제가 발생했습니다."],
  [/too large|payload|entity/i, "파일이 너무 큽니다. 크기를 줄여 다시 시도해주세요."],
  [/unauthorized|auth/i, "인증 정보가 유효하지 않습니다. 다시 로그인해주세요."],
];

export type ErrorSeverity = "info" | "warning" | "error" | "critical";

export interface ParsedError {
  message: string;
  severity: ErrorSeverity;
  showKakaoLink: boolean;
  originalError?: string;
  httpStatus?: number;
}

/**
 * HTTP 상태 코드 기반 에러 파싱
 */
export function parseHttpError(status: number, serverMessage?: string): ParsedError {
  const severity: ErrorSeverity = status >= 500 ? "critical" : status >= 400 ? "error" : "warning";
  const message = HTTP_STATUS_MESSAGES[status]
    || (status >= 500 ? "서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요." : "요청을 처리할 수 없습니다.");

  return {
    message,
    severity,
    showKakaoLink: status >= 500,
    originalError: serverMessage,
    httpStatus: status,
  };
}

/**
 * 백엔드 커스텀 에러 코드 기반 파싱
 */
export function parseBackendError(errorCode: string, fallbackMessage?: string): ParsedError {
  const message = BACKEND_ERROR_MESSAGES[errorCode] || fallbackMessage || "알 수 없는 오류가 발생했습니다.";
  const isCritical = ["BUBBLE_API_ERROR", "AI_PROCESSING_FAILED"].includes(errorCode);

  return {
    message,
    severity: isCritical ? "critical" : "error",
    showKakaoLink: isCritical,
    originalError: errorCode,
  };
}

/**
 * 범용 에러 파싱: Error 객체, string, 또는 unknown 타입 모두 처리
 */
export function parseError(error: unknown): ParsedError {
  // fetch Response 객체
  if (error && typeof error === "object" && "status" in error && typeof (error as any).status === "number") {
    return parseHttpError((error as any).status, (error as any).statusText);
  }

  // Error 객체
  if (error instanceof Error) {
    const msg = error.message;

    // 키워드 매칭
    for (const [pattern, korMessage] of ERROR_KEYWORD_MAP) {
      if (pattern.test(msg)) {
        return {
          message: korMessage,
          severity: "error",
          showKakaoLink: false,
          originalError: msg,
        };
      }
    }

    return {
      message: "오류가 발생했습니다. 다시 시도해주세요.",
      severity: "error",
      showKakaoLink: false,
      originalError: msg,
    };
  }

  // 문자열
  if (typeof error === "string") {
    return {
      message: error || "오류가 발생했습니다.",
      severity: "error",
      showKakaoLink: false,
      originalError: error,
    };
  }

  return {
    message: "알 수 없는 오류가 발생했습니다. 다시 시도해주세요.",
    severity: "critical",
    showKakaoLink: true,
  };
}

/**
 * fetch 응답에서 에러 메시지 추출
 */
export async function parseResponseError(res: Response): Promise<ParsedError> {
  let serverMessage: string | undefined;
  try {
    const body = await res.json();
    serverMessage = body.message || body.error || body.detail || JSON.stringify(body);
  } catch {
    // JSON 파싱 실패 시 무시
  }

  // 백엔드 커스텀 에러 코드 확인
  if (serverMessage) {
    const upperMsg = serverMessage.toUpperCase().replace(/\s+/g, "_");
    if (BACKEND_ERROR_MESSAGES[upperMsg]) {
      return parseBackendError(upperMsg, serverMessage);
    }
  }

  return parseHttpError(res.status, serverMessage);
}
