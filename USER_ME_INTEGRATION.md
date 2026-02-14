# 🎯 /user/me 연동으로 진짜 ID 확보!

## 🔥 핵심 개선

**문제:** 로그인 시 받은 ID가 실제 백엔드 DB의 사용자 ID가 아니었습니다.  
**해결:** 로그인 후 `/api/v1/user/me`를 호출하여 **진짜 숫자형 ID**를 가져옵니다!

---

## ✅ 수정 완료 사항

### 1. 로그인 후 /user/me 자동 호출

**플로우:**

```
STEP 1: 로그인 API 호출
POST /api/v1/auth/login
{
  "email": "user@example.com",
  "password": "password"
}
    ↓
STEP 2: 헤더에서 JWT 추출
response.headers.get('Authorization')
→ "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..."
→ "eyJhbGciOiJIUzI1NiIsInR5cCI6..." (Bearer 제거)
    ↓
STEP 3: 즉시 /user/me 호출
GET /api/v1/user/me
Headers: {
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6...
}
    ↓
STEP 4: 실제 사용자 ID 추출
Response: {
  "statusCode": 200,
  "data": {
    "id": 12345,  ← 진짜 숫자형 ID!
    "nickname": "양동규",
    "email": "yang.d@lifeshot.me",
    "role": "User"
  }
}
    ↓
STEP 5: 세션에 저장
session.user.id = "12345"  ← 진짜 ID!
session.user.nickname = "양동규"
session.accessToken = "eyJhbG..."
```

### 2. getUserTours 파라미터 변경

**이전 (❌):**
```typescript
GET /api/v1/folders?user_id=4689160694
```

**현재 (✅):**
```typescript
GET /api/v1/folders?userId=12345  // ✅ user_id → userId 변경!
```

**코드:**
```typescript
export async function getUserTours(userId: string, status?: string) {
  console.log("📋 [getUserTours] Called with userId:", userId, "type:", typeof userId);
  
  const params = new URLSearchParams({ userId: userId }); // ✅ userId!
  if (status) params.append("status", status);
  
  return apiCall(`/api/v1/folders?${params.toString()}`, {}, true);
}
```

### 3. JWT 콜백 - userId 저장

```typescript
// ✅ userId 우선 사용
const realUserId = user.userId || user.id;

token.id = realUserId; // ✅ REAL ID from /user/me
token.userId = realUserId; // ✅ Separate field
token.nickname = user.nickname || user.name || null; // ✅ NO email split!
```

### 4. Session 콜백 - userId 전달

```typescript
// ✅ userId를 session.user.id에 저장
const realUserId = token.userId || token.sub || token.id || "";

session.user.id = realUserId; // ✅ REAL ID from /user/me!
session.user.nickname = token.nickname || null;
```

---

## 🧪 테스트 방법

### 1단계: 완전 로그아웃

```bash
1. 메인 페이지 → "로그아웃"
2. F12 → Application → Cookies → 모든 쿠키 삭제
3. 브라우저 재시작
```

### 2단계: 테스트 계정으로 로그인

```
Email: yang.d@lifeshot.me
Password: qkrghksehdwls0

"이메일로 로그인" 버튼 클릭
```

### 3단계: 콘솔 로그 확인

**✅ 성공 시:**

```
📡 [Swagger API] POST https://api.lifeshot.me/api/v1/auth/login
📦 [Response Status]: 200 OK

🔍 [Checking Headers] Looking for Authorization header...
✅ [Header Found] Authorization header: Bearer eyJhbG...
✅ [Token Extracted] Removed 'Bearer ' prefix
🔑 [Token Extracted from Header] Token prefix: eyJhbGciOi  ← JWT!
🔑 [Token Extracted from Header] Is JWT: YES ✅

📦 [Response Body] Parsed JSON: {
  "statusCode": 200,
  "data": {
    "user_id": 12345,  ← 일단 이 ID
    "nickname": "양동규"
  }
}

🔍 [Fetching User Info] Calling /api/v1/user/me...
📦 [User Me] Raw response: {...}
✅ [User Me] Parsed JSON: {
  "statusCode": 200,
  "data": {
    "id": 67890,  ← 진짜 ID!
    "nickname": "양동규",
    "email": "yang.d@lifeshot.me"
  }
}

🔍 [User Me] Real ID found: 67890  ← 중요!
👤 [User Me] Real nickname found: 양동규

✅✅✅ [Login Success] User authenticated with REAL data: {
  userId: "67890",  ← 진짜 ID!
  nickname: "양동규",
  tokenPrefix: "eyJhbGciOi"
}

👤 [JWT] User data stored: {
  id: "67890",  ← 진짜 ID!
  userId: "67890",
  nickname: "양동규"
}

✅✅✅ [SESSION BUILT] Final session data: {
  id: "67890",  ← 진짜 ID!
  nickname: "양동규",
  tokenType: "✅ JWT"
}

🔍 [Session] Real User ID for API calls: 67890
👤 [Session] Real User Nickname: 양동규
```

### 4단계: 예약 페이지 확인

```
"나만의 포즈예약" 클릭 → /cheiz/my-tours

콘솔:
📋📋📋 [My Tours] Fetching tours for REAL user ID: 67890  ← 진짜 ID!
🔑 [My Tours] Full session data: {
  id: "67890",
  idType: "string",
  nickname: "양동규",
  tokenType: "✅ JWT Token"
}

📋 [getUserTours] Called with userId: 67890 type: string
📋 [getUserTours] Request params: userId=67890&status=Active%2CConfirmed

[API Call] GET https://api.lifeshot.me/api/v1/folders?userId=67890&status=Active%2CConfirmed

🔍 [API Client] Real JWT found in header: eyJhbGciOi...
✅ [API Client] Token valid: YES ✅

✅✅✅ [My Tours] API Response received: {...}
📦 [My Tours] Tours data: [...]  ← 진짜 데이터!
📦 [My Tours] Tours count: 5
```

---

## 📊 ID 추출 플로우

### 이전 (❌)
```
로그인 → email 사용 → /folders?user_id=email@kakao.com
→ 백엔드: "이 ID 모르는데요?" → 빈 배열 반환
```

### 현재 (✅)
```
로그인 
  ↓
헤더에서 JWT 추출 (eyJhbG...)
  ↓
/user/me 호출 (JWT 사용)
  ↓
진짜 ID 추출 (12345)
  ↓
세션에 저장 (session.user.id = "12345")
  ↓
/folders?userId=12345 호출
  ↓
✅ 실제 예약 데이터 반환!
```

---

## 🔍 파라미터 변경 사항

### GET /api/v1/folders

**이전:**
```
?user_id=4689160694  ← 카카오 OAuth ID (백엔드가 모름)
```

**현재:**
```
?userId=67890  ← /user/me에서 가져온 진짜 ID!
```

---

## 📋 변경 사항 요약

| 항목 | 이전 | 현재 |
|------|------|------|
| **ID 소스** | OAuth provider ID | `/user/me` API |
| **ID 타입** | 문자열 (이메일/OAuth) | 숫자 (백엔드 DB) |
| **파라미터 이름** | `user_id` | `userId` |
| **닉네임** | 이메일 split | 백엔드 응답 |
| **토큰 위치** | 본문 (body) | 헤더 (header) |
| **Bearer 처리** | 안 함 | 자동 제거 |

---

## 🚨 중요 포인트

1. ✅ **로그인 직후 `/user/me` 자동 호출**
2. ✅ **진짜 숫자형 ID 추출 및 저장**
3. ✅ **`userId` 파라미터 사용** (user_id 아님!)
4. ✅ **토큰은 헤더, 사용자 정보는 본문**
5. ✅ **닉네임은 백엔드 응답에서만** (이메일 split 금지!)

---

## 🎯 체크리스트

- [x] 로그인 후 `/user/me` 호출
- [x] 헤더에서 JWT 추출
- [x] 진짜 ID 추출 및 저장
- [x] `userId` 파라미터로 변경
- [x] JWT 타입에 userId 필드 추가
- [x] 세션에 userId 전달
- [x] 상세한 디버깅 로그

---

## 🎉 완료!

**지금 즉시:**
1. ✅ 완전 로그아웃 (쿠키 삭제!)
2. ✅ 테스트 계정으로 이메일 로그인
3. ✅ 콘솔에서 "🔍 [User Me] Real ID found: [숫자]" 확인
4. ✅ 예약 페이지에서 예약 리스트 확인

**성공 기준:**
- ✅ 로그인 후 `/user/me` 호출됨
- ✅ 진짜 ID (숫자) 확보: `67890`
- ✅ 파라미터: `userId=67890`
- ✅ 예약 데이터 반환: 배열 또는 빈 배열
- ✅ 401 에러 없음

**실패 시:**
- 콘솔 로그 전체 복사!
- 특히 "🔍 [User Me] Real ID found" 부분!

---

✅ **로그인 후 /user/me로 진짜 ID를 가져옵니다!**  
✅ **userId 파라미터로 예약 리스트를 요청합니다!**  
✅ **더 이상 이메일이나 OAuth ID를 사용하지 않습니다!**

🔥🔥🔥 **진짜 ID로 진짜 데이터를 가져옵니다!** 🔥🔥🔥
