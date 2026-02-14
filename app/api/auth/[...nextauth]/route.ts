import NextAuth, { NextAuthOptions } from "next-auth";
import KakaoProvider from "next-auth/providers/kakao";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  providers: [
    // Kakao OAuth
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID!,
      clientSecret: process.env.KAKAO_CLIENT_SECRET!,
    }),

    // Google Direct (시크릿 키 불필요 - 클라이언트에서 id_token 직접 수신)
    CredentialsProvider({
      id: "google-direct",
      name: "Google Direct",
      credentials: {
        idToken: { label: "ID Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.idToken) return null;

        const idToken = credentials.idToken;
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";
        const loginUrl = `${API_BASE_URL}/api/v1/auth/social/login/google`;

        try {
          const res = await fetch(loginUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: idToken }),
          });

          if (!res.ok) {
            const errorText = await res.text();
            console.error(`[Google Direct] 백엔드 ${res.status}: ${errorText}`);
            return null;
          }

          // Authorization 헤더에서 JWT 추출
          const authHeader = res.headers.get("authorization") || res.headers.get("Authorization");
          let accessToken: string | null = null;
          if (authHeader) {
            accessToken = (authHeader.startsWith("Bearer ") || authHeader.startsWith("bearer "))
              ? authHeader.substring(7) : authHeader;
          }

          const backendData = await res.json();
          const userData = backendData.data || backendData;
          const finalToken = accessToken || userData.access_token || userData.accessToken || userData.token;

          if (!finalToken) {
            console.error("[Google Direct] 응답에 토큰 없음");
            return null;
          }

          // /user/me 호출
          let userId = userData.user_id || userData.userId || userData.id;
          let nickname = userData.nickname || userData.name;
          let email = userData.email;
          let role = userData.role || "User";
          let profileImage = userData.profile_image || userData.profileImage;

          try {
            const meRes = await fetch(`${API_BASE_URL}/api/v1/user/me`, {
              method: "GET",
              headers: { "Authorization": `Bearer ${finalToken}`, "Content-Type": "application/json" },
            });
            if (meRes.ok) {
              const meJson = await meRes.json();
              const realData = meJson.data || meJson;
              userId = realData.id || realData.user_id || userId;
              nickname = realData.nickname || realData.name || nickname;
              email = realData.email || email;
              role = realData.role || role;
              profileImage = realData.profile_image || realData.profileImage || profileImage;
            }
          } catch { /* /user/me 실패 시 login 응답 데이터 사용 */ }

          return {
            id: userId ? String(userId) : email || "google-user",
            email: email || null,
            name: nickname || email || "Google User",
            nickname: nickname || null,
            image: profileImage || null,
            accessToken: finalToken,
            userId: userId ? String(userId) : undefined,
            role,
          };
        } catch (err: any) {
          console.error("[Google Direct] Exception:", err?.message);
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

        const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";

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

          // /user/me 호출
          let realUserId = null;
          let realNickname = null;
          let realProfileImage = null;
          let realRole = null;

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
            }
          } catch { /* /user/me 실패 시 login 응답 데이터 사용 */ }

          if (!realUserId) {
            realUserId = userData.user_id || userData.userId || userData.id;
            realNickname = userData.nickname || userData.name;
            realProfileImage = userData.profile_image || userData.profile_img || userData.profileImage;
            realRole = userData.role;
          }

          return {
            id: realUserId ? String(realUserId) : credentials.email,
            email: credentials.email,
            name: realNickname || credentials.email,
            nickname: realNickname,
            image: realProfileImage || null,
            accessToken,
            role: realRole || "User",
          };
        } catch (error) {
          console.error("[Login] Exception:", error instanceof Error ? error.message : String(error));
          return null;
        }
      },
    }),
  ],
  cookies: {
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
      // Kakao 소셜 로그인 (Google은 google-direct CredentialsProvider에서 처리)
      if (account?.provider === "kakao") {
        try {
          const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me";
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
              // /user/me 호출
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
                } else {
                  (user as any).accessToken = finalToken;
                  (user as any).nickname = userData.nickname || userData.name || user.name;
                  (user as any).userId = userData.user_id || userData.userId || user.id;
                  (user as any).role = userData.role || "User";
                }
              } catch {
                (user as any).accessToken = finalToken;
                (user as any).nickname = userData.nickname || userData.name || user.name;
                (user as any).userId = userData.user_id || userData.userId || user.id;
                (user as any).role = userData.role || "User";
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
        session.user.role = token.role as string || "User";
        session.user.profileComplete = token.profileComplete as boolean || false;
        (session as any).accessToken = token.accessToken || null;
      }
      return session;
    },

    async jwt({ token, user, account }) {
      if (user) {
        const realUserId = (user as any).userId || user.id;
        token.id = realUserId;
        token.userId = realUserId;
        token.email = user.email || undefined;
        token.name = user.name || undefined;
        token.nickname = (user as any).nickname || user.name || null;
        token.role = (user as any).role || "User";

        if ((user as any).accessToken) {
          token.accessToken = (user as any).accessToken;
        } else if (account?.access_token) {
          token.accessToken = account.access_token;
        } else {
          token.accessToken = null;
        }

        // 소셜 로그인 프로필 체크
        if (account?.provider === "kakao" || account?.provider === "google-direct") {
          token.profileComplete = false;
        } else {
          token.profileComplete = true;
        }
      }
      return token;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
