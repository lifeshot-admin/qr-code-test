import { NextAuthOptions } from "next-auth";
import { JWT } from "next-auth/jwt";
import KakaoProvider from "next-auth/providers/kakao";
import CredentialsProvider from "next-auth/providers/credentials";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ✅ 리프레시 토큰 자동 갱신 함수
// POST /api/v1/auth/token/refresh
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
/**
 * ✅ Bearer Stripper 유틸: "Bearer xxx" → "xxx" (순수 토큰만 추출)
 *    "Bearer Bearer xxx" 같은 다중 Bearer도 완전 제거
 */
function stripBearer(tokenStr: string): string {
  let cleaned = tokenStr;
  // 반복 제거 (Bearer Bearer Bearer... 방지)
  while (/^Bearer\s+/i.test(cleaned)) {
    cleaned = cleaned.replace(/^Bearer\s+/i, "");
  }
  return cleaned;
}

/**
 * ✅ Bearer Wrapper 유틸: "xxx" → "Bearer xxx"
 *    반드시 stripBearer 후 래핑하여 이중 Bearer 원천 차단
 */
function wrapBearer(pureToken: string): string {
  // 안전장치: 먼저 완전히 벗기고, trim()으로 양끝 공백/줄바꿈 제거 후 한 번만 입히기
  const stripped = stripBearer(pureToken).trim();
  return "Bearer " + stripped;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ✅ Set-Cookie 헤더에서 리프레시 토큰 추출 유틸리티
// 백엔드가 body가 아닌 쿠키로 refreshToken을 내려줄 때 사용
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * ✅ 쿠키 이름 정규화: 대소문자 무시 + 하이픈/언더스코어 통일
 * "Refresh-Token" → "refreshtoken"
 * "refresh_token" → "refreshtoken"
 * "REFRESH_TOKEN" → "refreshtoken"
 * "RefreshToken"  → "refreshtoken"
 */
function normalizeCookieName(name: string): string {
  return name.toLowerCase().replace(/[-_]/g, "");
}

// ✅ 정규화된 리프레시 토큰 쿠키 이름 후보 (대소문자/하이픈/언더스코어 무관)
const REFRESH_COOKIE_NORMALIZED = [
  "refreshtoken",   // refresh_token, Refresh-Token, refreshToken, REFRESH_TOKEN, refresh-token 등
  "rt",             // rt (짧은 별칭)
];

/**
 * ✅ Set-Cookie 문자열에서 refreshToken 값을 정밀 추출
 *
 * 핵심 로직:
 *   1. 세미콜론(;) 기준으로 첫 번째 쌍(key=value)만 가져온다
 *   2. = 기준으로 key/value를 분리한다
 *   3. key를 정규화(소문자 + 하이픈/언더스코어 제거)하여 후보 목록과 비교
 *   4. value는 trim()으로 양끝 공백/줄바꿈 불순물을 제거
 *
 * 예: "Refresh-Token=eyJhbGci...; Path=/; HttpOnly; Secure"
 *   → key: "Refresh-Token" → 정규화: "refreshtoken" → ✅ 매칭
 *   → value: "eyJhbGci..." (순수 토큰)
 */
function parseRefreshTokenFromSetCookie(setCookieHeader: string | null): string | null {
  if (!setCookieHeader) return null;

  // Set-Cookie는 여러 개의 쿠키가 쉼표(,)로 구분될 수 있음
  // 단, expires=Thu, 01 Dec 같은 날짜 안의 쉼표는 보존해야 함
  // → 쉼표 뒤에 알파벳이 바로 오는 경우만 분리 (날짜 패턴 보호)
  const cookieEntries = setCookieHeader.split(/,(?=\s*[A-Za-z_-]+=)/);

  for (const entry of cookieEntries) {
    // ━━━ Step 1: 세미콜론(;) 기준으로 첫 번째 key=value 쌍만 추출 ━━━
    const firstPart = entry.trim().split(";")[0]?.trim();
    if (!firstPart) continue;

    // ━━━ Step 2: = 기준으로 key와 value 분리 ━━━
    const eqIdx = firstPart.indexOf("=");
    if (eqIdx === -1) continue;

    const rawKey = firstPart.substring(0, eqIdx).trim();
    const rawValue = firstPart.substring(eqIdx + 1).trim();

    if (!rawKey || !rawValue) continue;

    // ━━━ Step 3: key 정규화 → 대소문자/하이픈/언더스코어 무관 매칭 ━━━
    const normalizedKey = normalizeCookieName(rawKey);

    if (REFRESH_COOKIE_NORMALIZED.includes(normalizedKey)) {
      // ━━━ Step 4: 불순물 제거 (trim + 따옴표 제거) ━━━
      let cleanValue = rawValue.trim();
      // 일부 백엔드가 값을 따옴표로 감싸는 경우: "eyJ..." → eyJ...
      if (cleanValue.startsWith('"') && cleanValue.endsWith('"')) {
        cleanValue = cleanValue.slice(1, -1);
      }

      return cleanValue;
    }
  }

  return null;
}

/**
 * Response 객체에서 refreshToken을 모든 경로로 추출하는 통합 함수
 * 우선순위: Set-Cookie 쿠키 > Refresh-Token 헤더 > body JSON
 */
function extractRefreshTokenFromResponse(
  res: Response,
  bodyData: any,
  parentData: any,
  providerTag: string,
): string | null {
  // [경로 1] Set-Cookie 헤더에서 추출
  let fromCookie: string | null = null;

  try {
    const setCookies = (res.headers as any).getSetCookie?.();
    if (Array.isArray(setCookies) && setCookies.length > 0) {
      for (const sc of setCookies) {
        const found = parseRefreshTokenFromSetCookie(sc);
        if (found) { fromCookie = found; break; }
      }
    }
  } catch { /* getSetCookie 미지원 시 무시 */ }

  if (!fromCookie) {
    const setCookieRaw = res.headers.get("set-cookie") || res.headers.get("Set-Cookie");
    if (setCookieRaw) {
      fromCookie = parseRefreshTokenFromSetCookie(setCookieRaw);
    }
  }

  // ━━━ 토큰 원천 + 순수 값을 담을 변수 ━━━
  let pureToken: string | null = null;
  let source: string = "";

  if (fromCookie) {
    pureToken = stripBearer(fromCookie).trim();
    source = "🍪 Set-Cookie";
  }

  // ━━━ [경로 2] 커스텀 응답 헤더 ━━━
  if (!pureToken) {
    const refreshHeader =
      res.headers.get("refresh-token") ||
      res.headers.get("Refresh-Token") ||
      res.headers.get("x-refresh-token") ||
      res.headers.get("X-Refresh-Token");
    if (refreshHeader) {
      pureToken = stripBearer(refreshHeader).trim();
      source = "📨 Refresh-Token 헤더";
    }
  }

  // ━━━ [경로 3] body JSON 내부 (data.refreshToken 등) ━━━
  if (!pureToken) {
    const fromBody =
      bodyData?.refreshToken ||
      bodyData?.refresh_token ||
      parentData?.refreshToken ||
      parentData?.refresh_token ||
      null;
    if (fromBody) {
      pureToken = stripBearer(String(fromBody)).trim();
      source = "📦 body JSON";
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ✅ 최종 검증: 추출 성공 여부 + JWT 형식 확인
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (pureToken) {
    // Bearer 불순물 재확인
    if (pureToken.toLowerCase().startsWith("bearer")) {
      pureToken = stripBearer(pureToken).trim();
    }
    return pureToken;
  }

  console.warn(`[${providerTag}] refreshToken 미발견 (Set-Cookie/헤더/body 모두 없음)`);
  return null;
}

async function refreshAccessToken(token: JWT): Promise<JWT> {
  const refreshUrl = `${API_BASE_URL}/api/v1/auth/token/refresh`;

  try {
    const rawRefreshToken = token.refreshToken as string;
    if (!rawRefreshToken) {
      console.error("[TOKEN_REFRESH] ❌ refreshToken 없음");
      return { ...token, error: "RefreshAccessTokenError" };
    }

    const cleanedRefreshToken = stripBearer(rawRefreshToken);

    const res = await fetch(refreshUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept-Language": "ko" },
      body: JSON.stringify({ refreshToken: cleanedRefreshToken }),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.error(`[TOKEN_REFRESH] ❌ 갱신 실패 (${res.status}): ${errorText.substring(0, 150)}`);
      if (res.status === 401 || res.status === 403) {
        return { ...token, error: "RefreshAccessTokenError" };
      }
      return token;
    }

    const responseText = await res.text();
    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      console.error("[TOKEN_REFRESH] ❌ 응답 파싱 실패");
      return { ...token, error: "RefreshAccessTokenError" };
    }

    const data = parsed.data || parsed;

    const authHeader = res.headers.get("authorization") || res.headers.get("Authorization");
    let pureNewAccessToken: string | null = null;
    if (authHeader) pureNewAccessToken = stripBearer(authHeader);
    if (!pureNewAccessToken) {
      const bodyToken = data.accessToken || data.access_token || data.token || null;
      if (bodyToken) pureNewAccessToken = stripBearer(bodyToken);
    }

    const newRefreshFromAll = extractRefreshTokenFromResponse(res, data, parsed, "TOKEN_REFRESH");
    const pureNewRefreshToken = newRefreshFromAll || cleanedRefreshToken;

    const expiresIn = data.expiresIn || data.expires_in || 3600;
    const accessTokenExpires = Date.now() + (expiresIn * 1000);

    if (!pureNewAccessToken) {
      console.error("[TOKEN_REFRESH] ❌ 새 accessToken 미발견");
      return { ...token, error: "RefreshAccessTokenError" };
    }

    const wrappedAccessToken = wrapBearer(pureNewAccessToken);
    const wrappedRefreshToken = wrapBearer(pureNewRefreshToken);

    return {
      ...token,
      accessToken: wrappedAccessToken,       // ✅ "Bearer abc123..." 형태
      refreshToken: wrappedRefreshToken,      // ✅ "Bearer def456..." 형태
      accessTokenExpires,                     // ✅ Date.now() + expiresIn * 1000
      error: undefined,
    };
  } catch (error: any) {
    console.error("[TOKEN_REFRESH] ❌ 예외 발생:", error?.message);
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30일
  },

  debug: process.env.NODE_ENV === "development",

  providers: [
    // Kakao OAuth
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID!,
      clientSecret: process.env.KAKAO_CLIENT_SECRET!,
    }),

    // Google Direct (클라이언트에서 id_token 직접 수신 → 백엔드에서 JWT 교환)
    CredentialsProvider({
      id: "google-direct",
      name: "Google Direct",
      credentials: {
        idToken: { label: "ID Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.idToken) return null;

        const idToken = credentials.idToken;
        const loginUrl = `${API_BASE_URL}/api/v1/auth/social/login/google`;

        try {
          const res = await fetch(loginUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: idToken }),
          });

          if (!res.ok) {
            const errorText = await res.text();
            console.error(`[Google Direct] ❌ 백엔드 ${res.status}: ${errorText.substring(0, 200)}`);
            return null;
          }

          const authHeader = res.headers.get("authorization") || res.headers.get("Authorization");
          let accessToken: string | null = null;
          if (authHeader) {
            accessToken = stripBearer(authHeader);
          }

          const backendData = await res.json();
          const userData = backendData.data || backendData;

          const finalToken = accessToken || userData.access_token || userData.accessToken || userData.token;

          if (!finalToken) {
            console.error("[Google Direct] ❌ accessToken 없음 → 로그인 실패");
            return null;
          }

          const pureAccessToken = stripBearer(finalToken);
          const isJwt = pureAccessToken.startsWith("eyJ");
          if (!isJwt) {
            console.warn("[Google Direct] ⚠️ 비JWT 토큰 감지");
          }

          const refreshToken = extractRefreshTokenFromResponse(res, userData, backendData, "Google Direct");

          const expiresIn =
            userData.expiresIn || userData.expires_in ||
            backendData.expiresIn || backendData.expires_in ||
            3600;

          // /user/me 호출
          let userId = userData.user_id || userData.userId || userData.id;
          let nickname = userData.nickname || userData.name;
          let email = userData.email;
          let role = userData.role || "User";
          let profileImage = userData.profile_image || userData.profileImage;
          let lan = userData.lan || null;

          try {
            const meRes = await fetch(`${API_BASE_URL}/api/v1/user/me`, {
              method: "GET",
              headers: { "Authorization": `Bearer ${pureAccessToken}`, "Content-Type": "application/json" },
            });
            if (meRes.ok) {
              const meJson = await meRes.json();
              const realData = meJson.data || meJson;
              userId = realData.id || realData.user_id || userId;
              nickname = realData.nickname || realData.name || nickname;
              email = realData.email || email;
              role = realData.role || role;
              profileImage = realData.profile_image || realData.profileImage || profileImage;
              lan = realData.lan || realData.language || lan;
            }
          } catch { /* /user/me 실패 시 login 응답 데이터 사용 */ }

          const returnUser = {
            id: userId ? String(userId) : email || "google-user",
            email: email || null,
            name: nickname || email || "Google User",
            nickname: nickname || null,
            image: profileImage || null,
            accessToken: pureAccessToken,
            refreshToken,
            expiresIn,
            userId: userId ? String(userId) : undefined,
            role,
            lan,
          };
          return returnUser;
        } catch (err: any) {
          console.error("[Google Direct] ❌ Exception:", err?.message);
          return null;
        }
      },
    }),

    // Email/Password
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ email: credentials.email, password: credentials.password }),
          });

          if (!response.ok) {
            console.error(`[Login] 실패 ${response.status}`);
            return null;
          }

          // Authorization 헤더에서 JWT 추출
          const authHeader = response.headers.get("authorization") || response.headers.get("Authorization");
          let accessToken: string | null = null;
          if (authHeader) {
            accessToken = (authHeader.startsWith("Bearer ") || authHeader.startsWith("bearer "))
              ? authHeader.substring(7) : authHeader;
          }

          const responseText = await response.text();
          let data: any = {};
          try { data = JSON.parse(responseText); } catch { data = {}; }

          const userData = data.data || data;

          if (!accessToken) {
            console.error("[Login] Authorization 헤더 없음");
            return null;
          }

          // ✅ refreshToken 완전 추출 (Set-Cookie > 헤더 > body 통합 탐색)
          const refreshToken = extractRefreshTokenFromResponse(response, userData, data, "Login");
          const expiresIn = userData.expiresIn || userData.expires_in || data.expiresIn || data.expires_in || 3600;


          // /user/me 호출
          let realUserId = null;
          let realNickname = null;
          let realProfileImage = null;
          let realRole = null;
          let realLan = null;

          try {
            const userMeResponse = await fetch(`${API_BASE_URL}/api/v1/user/me`, {
              method: "GET",
              headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
              credentials: "include",
            });
            if (userMeResponse.ok) {
              const userMeData = await userMeResponse.json();
              const meData = userMeData.data || userMeData;
              realUserId = meData.id || meData.user_id || meData.userId;
              realNickname = meData.nickname || meData.name;
              realProfileImage = meData.profile_image || meData.profile_img || meData.profileImage;
              realRole = meData.role;
              realLan = meData.lan || meData.language || null;
            }
          } catch { /* /user/me 실패 시 login 응답 데이터 사용 */ }

          if (!realUserId) {
            realUserId = userData.user_id || userData.userId || userData.id;
            realNickname = userData.nickname || userData.name;
            realProfileImage = userData.profile_image || userData.profile_img || userData.profileImage;
            realRole = userData.role;
            realLan = userData.lan || userData.language || null;
          }

          const returnUser = {
            id: realUserId ? String(realUserId) : credentials.email,
            email: credentials.email,
            name: realNickname || credentials.email,
            nickname: realNickname,
            image: realProfileImage || null,
            accessToken,
            refreshToken, // ✅ 리프레시 토큰
            expiresIn,    // ✅ 만료 시간(초)
            role: realRole || "User",
            lan: realLan,
          };
          return returnUser;
        } catch (error) {
          console.error("[Login] Exception:", error instanceof Error ? error.message : String(error));
          return null;
        }
      },
    }),
  ],
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: false },
    },
    callbackUrl: {
      name: `next-auth.callback-url`,
      options: { sameSite: 'lax', path: '/', secure: false },
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: { sameSite: 'lax', path: '/', secure: false },
    },
    state: {
      name: `next-auth.state`,
      options: { sameSite: 'lax', path: '/', secure: false, maxAge: 900 },
    },
  },
  callbacks: {
    async signIn({ user, account }) {
      // Kakao 소셜 로그인
      if (account?.provider === "kakao") {
        try {
          const loginUrl = `${API_BASE_URL}/api/v1/auth/social/login/${account.provider}`;
          const payload = { token: account.access_token };

          const socialLoginResponse = await fetch(loginUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload),
          });

          if (socialLoginResponse.ok) {
            const authHeader = socialLoginResponse.headers.get("authorization") || socialLoginResponse.headers.get("Authorization");
            let accessToken: string | null = null;
            if (authHeader) {
              accessToken = (authHeader.startsWith("Bearer ") || authHeader.startsWith("bearer "))
                ? authHeader.substring(7) : authHeader;
            }

            const backendData = await socialLoginResponse.json();
            const userData = backendData.data || backendData;
            const finalToken = accessToken || userData.access_token || userData.accessToken || userData.token;

            if (finalToken) {
              const kakaoRefreshToken = extractRefreshTokenFromResponse(
                socialLoginResponse, userData, backendData, "Kakao"
              );

              (user as any).refreshToken = kakaoRefreshToken;
              (user as any).expiresIn = userData.expiresIn || userData.expires_in || backendData.expiresIn || backendData.expires_in || 3600;

              try {
                const userMeResponse = await fetch(`${API_BASE_URL}/api/v1/user/me`, {
                  method: "GET",
                  headers: { "Authorization": `Bearer ${finalToken}`, "Content-Type": "application/json" },
                  credentials: "include",
                });
                if (userMeResponse.ok) {
                  const meData = await userMeResponse.json();
                  const realData = meData.data || meData;
                  (user as any).accessToken = finalToken;
                  (user as any).userId = realData.id || realData.user_id || realData.userId;
                  (user as any).nickname = realData.nickname || realData.name || user.name;
                  (user as any).role = realData.role || "User";
                  (user as any).email = realData.email || user.email;
                  (user as any).lan = realData.lan || realData.language || null;
                } else {
                  (user as any).accessToken = finalToken;
                  (user as any).nickname = userData.nickname || userData.name || user.name;
                  (user as any).userId = userData.user_id || userData.userId || user.id;
                  (user as any).role = userData.role || "User";
                  (user as any).lan = userData.lan || null;
                }
              } catch {
                (user as any).accessToken = finalToken;
                (user as any).nickname = userData.nickname || userData.name || user.name;
                (user as any).userId = userData.user_id || userData.userId || user.id;
                (user as any).role = userData.role || "User";
                (user as any).lan = null;
              }
            }
            return true;
          } else {
            const errorText = await socialLoginResponse.text();
            console.error(`[Kakao] 백엔드 ${socialLoginResponse.status}: ${errorText}`);
            return false;
          }
        } catch (error: any) {
          console.error("[Kakao] Exception:", error?.message);
          return false;
        }
      }
      return true;
    },

    async session({ session, token }) {
      if (session.user) {
        const realUserId = (token.userId as string) || token.sub || (token.id as string) || "";
        session.user.id = realUserId;
        session.user.email = token.email || session.user.email || "";
        session.user.name = token.name || session.user.name || "";
        session.user.nickname = (token.nickname as string) || (token.name as string) || null;
        session.user.image = (token.image as string) || (token.picture as string) || session.user.image || null;
        session.user.role = token.role as string || "User";
        session.user.profileComplete = token.profileComplete as boolean || false;
        session.user.lan = (token.lan as string) || null;
        // ✅ 세션에 accessToken 전달 (항상 "Bearer xxx" 형태)
        (session as any).accessToken = token.accessToken || null;

        // ✅ 세션에 에러 정보 전달 (클라이언트에서 감지용)
        if (token.error) {
          (session as any).error = token.error;
        }
      }
      return session;
    },

    async jwt({ token, user, account, trigger, session: updateData }) {
      // ━━━ 클라이언트 updateSession() 호출 시 세션 데이터 갱신 ━━━
      if (trigger === "update" && updateData) {
        if (updateData.nickname !== undefined) {
          token.nickname = updateData.nickname;
          token.name = updateData.nickname;
        }
        if (updateData.image !== undefined) {
          token.image = updateData.image;
          token.picture = updateData.image;
        }
        if (updateData.name !== undefined) {
          token.name = updateData.name;
        }
        if (updateData.lan !== undefined) {
          token.lan = updateData.lan;
        }
        return token;
      }

      // ━━━ 최초 로그인 시 (user 객체가 있을 때) ━━━
      if (user) {
        const realUserId = (user as any).userId || user.id;

        token.id = realUserId;
        token.userId = realUserId;
        token.email = user.email || undefined;
        token.name = user.name || undefined;
        token.nickname = (user as any).nickname || user.name || null;
        token.image = user.image || (user as any).profileImage || (user as any).profile_image || null;
        token.role = (user as any).role || "User";
        token.lan = (user as any).lan || null;

        // ✅ accessToken → 항상 "Bearer xxx" 형태로 저장 (통일)
        const rawAccessToken = (user as any).accessToken || account?.access_token || null;
        if (rawAccessToken) {
          token.accessToken = wrapBearer(stripBearer(rawAccessToken));
        } else {
          token.accessToken = null;
        }

        // ✅ refreshToken → 항상 "Bearer xxx" 형태로 저장 (통일)
        const rawRefreshToken = (user as any).refreshToken || null;
        if (rawRefreshToken) {
          token.refreshToken = wrapBearer(stripBearer(rawRefreshToken));
        } else {
          token.refreshToken = null;
        }

        // ✅ 만료 시간 계산: expiresIn(초) × 1000 = ms, Date.now() 기준
        const expiresIn = (user as any).expiresIn || 3600; // 기본 1시간
        token.accessTokenExpires = Date.now() + (expiresIn * 1000);

        if (!token.refreshToken) {
          console.warn("[AUTH] refreshToken 미확보 — 자동 갱신 불가");
        }

        // 소셜 로그인 프로필 체크
        if (account?.provider === "kakao" || account?.provider === "google-direct") {
          token.profileComplete = false;
        } else {
          token.profileComplete = true;
        }

        return token;
      }

      // ━━━ 이후 요청: 토큰 만료 체크 & 자동 갱신 ━━━

      // ✅ [타입 강제 보정] accessTokenExpires가 문자열일 수 있음 → 반드시 Number()
      const rawExpires = token.accessTokenExpires;
      const accessTokenExpires: number | undefined =
        (rawExpires !== undefined && rawExpires !== null)
          ? Number(rawExpires)
          : undefined;

      // ✅ [진단 로그] 매 요청마다 시각 비교를 눈으로 확인
      const now = Date.now();
      const hasRefresh = !!token.refreshToken;
      const expiresValid = typeof accessTokenExpires === "number" && !isNaN(accessTokenExpires);
      const remainMs = expiresValid ? accessTokenExpires - now : NaN;
      const remainSec = expiresValid ? Math.round(remainMs / 1000) : NaN;

      // 만료 시간이 숫자이고, 아직 유효한 경우 → 그대로 반환 (무음)
      if (expiresValid && now < accessTokenExpires! - 60_000) {
        return token;
      }

      // 만료 1분 이내 또는 이미 만료 → 경고 1줄 + 리프레시 시도
      if (hasRefresh) {
        console.warn(`[AUTH_TIMER] ⚠️ 토큰 만료 임박 (${expiresValid ? `${remainSec}초 남음` : "미설정"}) → 갱신 시도`);
        return refreshAccessToken(token);
      }

      // refreshToken 없음
      if (expiresValid) {
        console.warn("[AUTH_TIMER] ⚠️ 토큰 만료 + refreshToken 없음");
      }
      return token;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
};
