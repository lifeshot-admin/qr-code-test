# 🚨 긴급 수정 가이드 - 토큰 인증 문제

## 현재 상황

**문제:** 토큰 prefix `hlbmZolKxm`는 유효하지 않은 임시 토큰입니다.  
**원인:** 카카오 로그인이 백엔드 토큰 교환에 실패했습니다.  
**결과:** 백엔드가 `Invalid access token (401)` 에러 반환

## ✅ 즉시 해결 방법

### 방법 1: 이메일 로그인 사용 (권장)

```
1. 로그아웃
2. /auth/signin으로 이동
3. 테스트 계정으로 로그인:
   - Email: yang.d@lifeshot.me
   - Password: qkrghksehdwls0
```

이메일 로그인은 실제 백엔드 API를 호출하므로 **진짜 JWT**를 받을 수 있습니다.

### 방법 2: 백엔드 소셜 로그인 API 구현 요청

백엔드 개발자에게 다음 엔드포인트 구현을 요청하세요:

```http
POST /api/v1/auth/social-login
Content-Type: application/json

{
  "provider": "kakao",
  "access_token": "카카오_OAuth_토큰",
  "email": "user@kakao.com",
  "name": "홍길동",
  "profile_image": "https://..."
}

Response:
{
  "statusCode": 200,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user_id": "4689160694",
    "nickname": "홍길동",
    "role": "User"
  }
}
```

## 🔍 토큰 검증 방법

로그인 후 콘솔에서 다음 로그를 확인하세요:

### ✅ 성공 (JWT 토큰)
```
🔍 [API Client] Token prefix: eyJhbGciOi
🔑 [API Client] Token type: ✅ JWT Token (Standard)
✅ [API Client] Token valid: YES
```

### ❌ 실패 (OAuth 토큰)
```
🔍 [API Client] Token prefix: ya29.a0AfH
🔑 [API Client] Token type: ❌ OAuth Token (Backend will reject!)
✅ [API Client] Token valid: NO - WILL FAIL!
```

### ❌ 실패 (임시 토큰)
```
🔍 [API Client] Token prefix: hlbmZolKxm
🔑 [API Client] Token type: ❌ Temporary Token (Backend will reject!)
✅ [API Client] Token valid: NO - WILL FAIL!
```

## 📋 체크리스트

- [ ] 완전 로그아웃 (쿠키 삭제)
- [ ] 테스트 계정으로 이메일 로그인
- [ ] 콘솔에서 토큰 타입 확인
- [ ] 토큰이 `eyJ`로 시작하는지 확인
- [ ] `/cheiz/my-tours`에서 401 에러 없는지 확인

## 🎯 토큰 교환 로직 개선 사항

새로운 signIn 콜백이 3단계로 토큰을 받습니다:

1. **Method 1:** `/api/v1/auth/social-login` 시도
2. **Method 2:** Bubble 로그인 워크플로우 시도 (실제 토큰 받기)
3. **Method 3:** Bubble 회원가입 워크플로우 (최후의 수단)

어느 방법이든 실패하면 더 이상 임시 토큰을 생성하지 않고 `null`로 설정합니다.

## 🚨 중요: 임시 토큰 제거

임시 토큰 생성 로직을 제거했습니다. 이제 유효한 토큰을 받지 못하면:

```
🚨🚨🚨 [JWT] CRITICAL: NO ACCESS TOKEN AVAILABLE!
🚨 User will NOT be able to make authenticated API calls!
```

이 로그가 보이면 **반드시** 로그인 방식을 변경해야 합니다.
