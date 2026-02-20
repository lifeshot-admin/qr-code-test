import NextAuth, { DefaultSession, DefaultUser } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  /**
   * 세션 인터페이스 확장
   */
  interface Session extends DefaultSession {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      nickname?: string | null;
      role?: string;
      profileComplete?: boolean;
      lan?: string | null;
    };
    accessToken?: string | null;
    error?: string; // ✅ 토큰 갱신 실패 에러 전달용
  }

  /**
   * 사용자 인터페이스 확장
   */
  interface User extends DefaultUser {
    id: string;
    userId?: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
    nickname?: string | null;
    accessToken?: string | null;
    refreshToken?: string | null;  // ✅ 리프레시 토큰
    expiresIn?: number;            // ✅ 만료 시간(초)
    role?: string;
    lan?: string | null;
  }
}

declare module "next-auth/jwt" {
  /**
   * JWT 토큰 인터페이스 확장
   */
  interface JWT extends DefaultJWT {
    id?: string;
    userId?: string;
    email?: string;
    name?: string;
    nickname?: string | null;
    accessToken?: string | null;
    refreshToken?: string | null;      // ✅ 리프레시 토큰
    accessTokenExpires?: number;       // ✅ 만료 시각 (Unix ms)
    role?: string;
    profileComplete?: boolean;
    lan?: string | null;
    error?: string;                    // ✅ "RefreshAccessTokenError"
  }
}
