import NextAuth, { DefaultSession, DefaultUser } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  /**
   * 세션 인터페이스 확장
   * ✅ accessToken과 nickname을 세션에 포함
   */
  interface Session extends DefaultSession {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      nickname?: string | null;  // ✅ 닉네임
      role?: string;
      profileComplete?: boolean;
    };
    accessToken?: string | null;  // ✅ JWT 토큰 (최상위 레벨)
  }

  /**
   * 사용자 인터페이스 확장
   * ✅ authorize() 함수에서 반환하는 객체 타입
   */
  interface User extends DefaultUser {
    id: string;
    userId?: string;  // ✅ 실제 백엔드 사용자 ID (/user/me에서 가져옴)
    email?: string | null;
    name?: string | null;
    image?: string | null;
    nickname?: string | null;  // ✅ 닉네임
    accessToken?: string | null;  // ✅ JWT 토큰
    role?: string;
  }
}

declare module "next-auth/jwt" {
  /**
   * JWT 토큰 인터페이스 확장
   * ✅ JWT 콜백에서 저장하는 데이터 타입
   */
  interface JWT extends DefaultJWT {
    id?: string;
    userId?: string;  // ✅ 실제 백엔드 사용자 ID
    email?: string;
    name?: string;
    nickname?: string | null;  // ✅ 닉네임
    accessToken?: string | null;  // ✅ JWT 토큰
    role?: string;
    profileComplete?: boolean;
  }
}
