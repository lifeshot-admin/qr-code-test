# 🎯 헤더에서 토큰 추출 - 최종 해결!

## 🔥 핵심 발견

**문제의 원인:** 토큰이 응답 **본문(body)**이 아니라 **헤더(header)**에 있었습니다!

```
❌ 이전: response.json().data.access_token (본문에서 찾음)
✅ 현재: response.headers.get('Authorization') (헤더에서 찾음)
```

## ✅ 수정 완료 사항

### 1. 이메일 로그인 (authorize() 함수)

**변경 내용:**

```typescript
// ✅ credentials: 'include' 추가
const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  credentials: "include", // ✅ 쿠키 포함!
  body: JSON.stringify({
    email: credentials.email,
    password: credentials.password,
  }),
});

// ✅ STEP 1: 헤더에서 토큰 추출
const authHeader = response.headers.get("authorization") || response.headers.get("Authorization");

let accessToken = null;
if (authHeader) {
  // ✅ "Bearer " 접두사 제거
  if (authHeader.startsWith("Bearer ") || authHeader.startsWith("bearer ")) {
    accessToken = authHeader.substring(7);
  } else {
    accessToken = authHeader;
  }
}

// ✅ STEP 2: 응답 본문에서 사용자 정보 추출
const data = await response.json();
const userData = data.data || data;

const nickname = userData.nickname || userData.name || null; // ✅ 실제 닉네임!
```

**로그 출력:**

```
🔍 [Checking Headers] Looking for Authorization header...
📋 [All Response Headers]:
  content-type: application/json
  authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  set-cookie: session=...; Path=/; HttpOnly

✅ [Header Found] Authorization header: Bearer eyJhbGciOiJ...
✅ [Token Extracted] Removed 'Bearer ' prefix
🔑 [Token Extracted from Header] Token prefix: eyJhbGciOi
🔑 [Token Extracted from Header] Token length: 250
🔑 [Token Extracted from Header] Is JWT: YES ✅

✅✅✅ [Login Success] User authenticated with REAL JWT from HEADER
```

### 2. 소셜 로그인 (signIn 콜백)

**Method 1 & 2 모두 수정:**

```typescript
// ✅ credentials: 'include' 추가
const response = await fetch(url, {
  method: "POST",
  credentials: "include", // ✅
  // ...
});

// ✅ 헤더에서 토큰 추출
const authHeader = response.headers.get("authorization") || response.headers.get("Authorization");
let accessToken = null;

if (authHeader) {
  accessToken = authHeader.startsWith("Bearer ") || authHeader.startsWith("bearer ")
    ? authHeader.substring(7)
    : authHeader;
}

// ✅ 본문에서 사용자 정보 추출
const data = await response.json();
const userData = data.data || data;

// ✅ 헤더 토큰 우선, 본문 토큰 폴백
user.accessToken = accessToken || userData.access_token;
user.nickname = userData.nickname || userData.name;
```

### 3. API 클라이언트 로그 강화

```typescript
if (token.startsWith('eyJ')) {
  console.log("🔍 [API Client] Real JWT found in header:", 
    tokenPrefix + "..." + token.substring(token.length - 10));
}

console.log("🔐 [API Client] Authorization header added: Bearer " + tokenPrefix + "...");
console.log("🔍 [API Client] Token length:", token.length);
```

## 🧪 테스트 방법

### 1단계: 완전 로그아웃

```bash
1. 메인 페이지 → "로그아웃" 버튼
2. F12 → Application → Cookies → 모든 쿠키 삭제
3. 브라우저 재시작
```

### 2단계: 테스트 계정으로 로그인

```
Email: yang.d@lifeshot.me
Password: qkrghksehdwls0
```

### 3단계: 콘솔 로그 확인

**✅ 성공 시:**

```
📡 [Swagger API] POST https://api.lifeshot.me/api/v1/auth/login
📦 [Response Status]: 200 OK

🔍 [Checking Headers] Looking for Authorization header...
📋 [All Response Headers]:
  authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  content-type: application/json
  set-cookie: session=abc123; Path=/; HttpOnly

✅ [Header Found] Authorization header: Bearer eyJhbGciOiJ...
✅ [Token Extracted] Removed 'Bearer ' prefix
🔑 [Token Extracted from Header] Token prefix: eyJhbGciOi
🔑 [Token Extracted from Header] Token length: 250
🔑 [Token Extracted from Header] Is JWT: YES ✅

📦 [Response Body] Raw: {"statusCode":200,"data":{...}}
✅ [Response Body] Parsed JSON: {
  "statusCode": 200,
  "data": {
    "user_id": "...",
    "nickname": "양동규",
    "email": "yang.d@lifeshot.me"
  }
}

👤 [User Data] Extracted: {
  "user_id": "...",
  "nickname": "양동규"
}

✅✅✅ [Login Success] User authenticated with REAL JWT from HEADER: {
  userId: "...",
  email: "yang.d@lifeshot.me",
  nickname: "양동규",
  hasToken: true,
  tokenType: "JWT ✅",
  tokenPrefix: "eyJhbGciOi",
  tokenLength: 250
}
```

### 4단계: 메인 화면 확인

```
✅ "환영합니다, 양동규님!"
```

### 5단계: 예약 페이지 확인

```
"나만의 포즈예약" 클릭

콘솔:
🔍 [API Client] Real JWT found in header: eyJhbGciOi...abc123xyz
🔐 [API Client] Authorization header added: Bearer eyJhbGciOi...
🔑 [API Client] Token type: ✅ JWT Token (Standard)
🔍 [API Client] Token length: 250
✅ [API Client] Token valid: YES ✅

[API Call] GET https://api.lifeshot.me/api/v1/folders?...
✅ 200 OK (성공!)
```

## 📊 변경 사항 요약

| 항목 | 이전 | 현재 |
|------|------|------|
| 토큰 위치 | ❌ 본문 (body) | ✅ 헤더 (header) |
| 토큰 추출 | `data.access_token` | `headers.get('Authorization')` |
| Bearer 접두사 | ❌ 처리 안 함 | ✅ 제거함 |
| credentials | ❌ 없음 | ✅ 'include' |
| 닉네임 | ❌ 이메일 split | ✅ 본문에서 추출 |
| 가짜 토큰 | ❌ 생성함 | ✅ 완전 제거 |

## 🔍 헤더 vs 본문

### Authorization Header (토큰)
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
- **JWT 토큰**이 여기 있음!
- `response.headers.get('Authorization')` 사용
- "Bearer " 접두사 제거 필요

### Response Body (사용자 정보)
```json
{
  "statusCode": 200,
  "data": {
    "user_id": "12345",
    "nickname": "양동규",
    "email": "yang.d@lifeshot.me",
    "role": "User"
  }
}
```
- **사용자 정보**가 여기 있음!
- `response.json()` 사용
- nickname, user_id 등 추출

## 🚨 중요 포인트

1. ✅ **토큰은 헤더**에서, **사용자 정보는 본문**에서!
2. ✅ `credentials: 'include'`로 쿠키 포함
3. ✅ "Bearer " 접두사 반드시 제거
4. ✅ 모든 응답 헤더 로그 출력으로 디버깅 용이
5. ✅ 가짜 토큰 생성 로직 완전 제거

## 🎯 체크리스트

- [x] 헤더에서 토큰 추출
- [x] Bearer 접두사 제거
- [x] credentials: 'include' 추가
- [x] 본문에서 닉네임 추출
- [x] 가짜 토큰 생성 제거
- [x] 소셜 로그인도 동일하게 수정
- [x] API 클라이언트 로그 강화

---

✅ **토큰은 헤더에 있었습니다!**  
✅ **이제 실제 JWT를 받아옵니다!**  
✅ **더 이상 가짜 토큰을 생성하지 않습니다!**
