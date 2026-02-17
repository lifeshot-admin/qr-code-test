# PROJECT_CONTEXT_FOR_AI.md

> **이 문서는 AI 협업자가 프로젝트 전체 맥락을 빠르게 파악하기 위한 기술 레퍼런스입니다.**
> 마지막 업데이트: 2026-02-14

---

## 1. 프로젝트 개요

**Cheiz**는 일본 포토 투어 예약 서비스의 **웹 버전**입니다.
고객은 투어별로 촬영 스팟과 포즈를 선택·예약하고, 포토그래퍼는 QR 스캔 → 인증사진 촬영 → 포즈 가이드 확인 → 촬영 완료 흐름으로 현장 촬영을 진행합니다.

| 항목 | 내용 |
|------|------|
| 프레임워크 | **Next.js 14.2.15** (App Router) |
| 스타일링 | **Tailwind CSS 3.4** + 커스텀 디자인 시스템 (Cheiz Electric Blue `#0055FF`) |
| 언어 | TypeScript 5 (strict mode) |
| 패키지 매니저 | npm |
| 호스팅 | Vercel (추정, Next.js 기본) |

---

## 2. 기술 스택 상세

### 2.1 주요 라이브러리

| 라이브러리 | 버전 | 용도 |
|-----------|------|------|
| `next` | 14.2.15 | 풀스택 프레임워크 (App Router, API Routes, Middleware) |
| `react` / `react-dom` | ^18.3.1 | UI 렌더링 |
| `next-auth` | ^4.24.13 | 인증 (Kakao OAuth, Google Direct, Email/Password) |
| `@react-oauth/google` | ^0.13.4 | Google One Tap / ID Token 로그인 |
| `zustand` | ^5.0.11 | 클라이언트 상태 관리 (포즈 예약 플로우) |
| `framer-motion` | ^12.34.0 | 애니메이션, 페이지 전환 |
| `lucide-react` | ^0.564.0 | 아이콘 |
| `qrcode` | ^1.5.4 | QR 코드 생성 (Canvas) |
| `jsqr` | ^1.4.0 | QR 코드 인식 (소프트웨어 폴백) |
| `@sendgrid/mail` | ^8.1.6 | 이메일 발송 (회원가입 인증) |
| `bcryptjs` | ^3.0.3 | 비밀번호 해싱 |
| `tailwindcss` | ^3.4.14 | 유틸리티 CSS |

### 2.2 DB 및 백엔드 연동

이 프로젝트는 **자체 DB를 보유하지 않습니다**. 두 개의 외부 백엔드와 연동합니다:

#### (A) Bubble.io Data API — 비즈니스 데이터

- **역할**: 투어, 스팟, 포즈, 예약, 리뷰, 쿠폰 등 핵심 비즈니스 데이터 CRUD
- **접근 방식**: Next.js API Routes (`app/api/bubble/`)가 서버사이드 프록시 역할
- **Base URL 패턴**:
  - 프로덕션: `{BUBBLE_API_BASE_URL}/api/1.1/obj/{테이블명}`
  - 테스트: `{BUBBLE_API_BASE_URL}/version-test/api/1.1/obj/{테이블명}`
- **환경 변수**: `BUBBLE_API_BASE_URL`, `BUBBLE_API_TOKEN`, `BUBBLE_USE_VERSION_TEST`
- **인증**: `Authorization: Bearer {BUBBLE_API_TOKEN}` 헤더
- **테스트/프로덕션 전환**: `BUBBLE_USE_VERSION_TEST=true`이면 테스트 DB 사용, `false`이면 mutation을 시뮬레이션(실제 PATCH 안 함)
- **주요 테이블**: `pose_reservation`, `reserved_pose`, `spot_pose`, `tour`, `spot`, `pose_category`, `review`, `excel_coupon`

#### (B) Java Spring 백엔드 (api.lifeshot.me) — 인증/사용자

- **역할**: 회원가입, 로그인, 소셜 로그인, 이메일 인증, 닉네임 체크, 프로필 이미지 업로드
- **접근 방식**: 클라이언트에서 직접 호출 (`lib/api-client.ts`) 또는 NextAuth 콜백에서 서버사이드 호출
- **Base URL**: `NEXT_PUBLIC_API_BASE_URL` (기본값: `https://api.lifeshot.me`)
- **인증**: JWT (로그인 응답의 `Authorization` 헤더에서 추출)
- **주요 엔드포인트**:
  - `POST /api/v1/auth/login` — 이메일/비밀번호 로그인
  - `POST /api/v1/auth/social/login/{provider}` — 소셜 로그인 (kakao, google)
  - `GET /api/v1/user/me` — 사용자 정보 조회
  - `POST /api/v1/auth/signup` — 회원가입
  - `POST /api/v1/auth/send-verification` — 이메일 인증 코드 발송
  - `POST /api/v1/auth/verify-email` — 인증 코드 확인
  - `GET /api/v1/auth/check-nickname` — 닉네임 중복 확인
  - `POST /api/v1/user/profile-image` — 프로필 이미지 업로드
  - `GET /api/v1/user/tours?status=RESERVED` — 사용자 예약 투어 목록

---

## 3. 인증 시스템

### NextAuth 설정 (`lib/auth.ts`)

| Provider | ID | 방식 |
|----------|----|------|
| Kakao | `kakao` | OAuth (KAKAO_CLIENT_ID/SECRET) → 백엔드 social login → JWT 발급 |
| Google | `google-direct` | CredentialsProvider: 클라이언트 GoogleLogin → idToken → 백엔드 social login → JWT |
| Email/Password | `credentials` | CredentialsProvider: 백엔드 `/api/v1/auth/login` → JWT |

**세션 구조** (JWT 전략):
```typescript
session.user = {
  id: string,          // 백엔드 userId
  email: string,
  name: string,
  nickname: string | null,
  role: string,        // "User" | "Photographer" | "ROLE_SNAP"
  profileComplete: boolean,
}
session.accessToken = string  // 백엔드 JWT
```

### Middleware RBAC (`middleware.ts`)

| 경로 | 접근 조건 |
|------|----------|
| `/`, `/api/auth`, `/auth/*` | 공개 |
| `/photographer/*` | `Photographer` 또는 `ROLE_SNAP` 역할 필요 |
| `/cheiz/*` | `User`, `Photographer`, `ROLE_SNAP` 역할 필요 |
| 기타 | 로그인 필요 (미인증 시 `/auth/signin`으로 리다이렉트) |

---

## 4. 폴더 구조

```
AI/                                    # 프로젝트 루트
├── app/
│   ├── layout.tsx                     # 루트 레이아웃 (Pretendard 폰트, Providers)
│   ├── page.tsx                       # 랜딩 페이지 (Cheiz 메인 / 포토그래퍼 앱 선택)
│   ├── globals.css                    # 글로벌 CSS (KIMI 디자인 시스템 변수, 애니메이션)
│   ├── providers.tsx                  # SessionProvider + GoogleOAuthProvider
│   ├── error.tsx                      # 글로벌 에러 바운더리
│   ├── not-found.tsx                  # 404 페이지
│   ├── global-error.tsx               # 글로벌 에러 (root layout 밖)
│   │
│   ├── auth/
│   │   ├── signin/page.tsx            # 로그인 (이메일/카카오/구글)
│   │   ├── signup/page.tsx            # 회원가입 (5단계: 약관→인증→비밀번호→닉네임→프로필)
│   │   └── error/page.tsx             # 인증 에러 표시
│   │
│   ├── cheiz/
│   │   ├── layout.tsx                 # Cheiz 레이아웃 (BottomNav 포함, pb-16)
│   │   ├── page.tsx                   # 홈 (이벤트 슬라이더, 퀵메뉴, 포즈, 리뷰)
│   │   ├── providers.tsx              # Cheiz용 SessionProvider
│   │   ├── components/
│   │   │   ├── BottomNav.tsx          # 하단 내비게이션 (홈/예약리스트/사진리뷰/마이)
│   │   │   ├── EventSlider.tsx        # 이벤트 이미지 캐러셀 (자동재생)
│   │   │   ├── CouponSheet.tsx        # 쿠폰 조회 바텀시트
│   │   │   └── QRModal.tsx            # QR 코드 표시 모달
│   │   │
│   │   ├── my-tours/page.tsx          # 예약 리스트 (투어 카드, QR, 포즈 수정/취소)
│   │   ├── mypage/page.tsx            # 마이페이지 (기본 정보)
│   │   ├── booking/page.tsx           # 예약 폼 (일반 예약, 포즈 플로우와 별개)
│   │   ├── coupons/page.tsx           # 쿠폰 목록 (현재 mock 데이터)
│   │   ├── pose-selector/page.tsx     # 단독 포즈 선택기 (레거시)
│   │   │
│   │   └── reserve/
│   │       ├── page.tsx               # /reserve → /reserve/spots 리다이렉트
│   │       ├── spots/page.tsx         # 스팟 선택 (투어 내 촬영 장소)
│   │       ├── poses/page.tsx         # 포즈 선택 (스팟 내 포즈, 페르소나 필터)
│   │       └── review/page.tsx        # 최종 확인 및 예약 제출 (QR 생성)
│   │
│   ├── photographer/
│   │   ├── page.tsx                   # 포토그래퍼 앱 (Suspense → PhotographerApp)
│   │   └── scan/page.tsx              # QR 스캔 리다이렉트 (?reservation_id=)
│   │
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts   # NextAuth 핸들러
│   │   └── bubble/                        # Bubble.io API 프록시 (아래 상세)
│   │
│   └── _kimi-design/                  # 디자인 참고용 (빌드 제외, tsconfig 제외)
│
├── components/
│   ├── PhotographerApp.tsx            # 포토그래퍼 전체 플로우 (스캔→인증→촬영→완료)
│   └── CameraScanner.tsx              # 카메라/QR 스캐너 (BarcodeDetector + jsQR)
│
├── lib/
│   ├── auth.ts                        # NextAuth 옵션 (providers, callbacks, pages)
│   ├── bubble-api.ts                  # Bubble.io API 클라이언트 (타입, 함수)
│   ├── api-client.ts                  # Java 백엔드 API 클라이언트 (인증, 사용자)
│   ├── reservation-store.ts           # Zustand 스토어 (포즈 예약 상태)
│   └── validation-engine.ts           # 예약 유효성 검사 로직
│
├── middleware.ts                       # RBAC 미들웨어
├── next.config.js                      # Next.js 설정
├── tailwind.config.ts                  # Tailwind 설정 (커스텀 색상, 라운딩)
├── tsconfig.json                       # TypeScript 설정
├── package.json                        # 의존성 및 스크립트
└── .env.local                          # 환경 변수 (비공개)
```

---

## 5. API Routes 상세 (`app/api/bubble/`)

모든 Bubble API Route는 서버사이드에서 `lib/bubble-api.ts`의 함수를 호출하여 Bubble.io Data API에 접근합니다.
클라이언트에서 직접 Bubble API를 호출하지 않고 반드시 이 프록시를 통합니다 (토큰 보호).

| Route | Method | 설명 | 호출하는 함수 |
|-------|--------|------|-------------|
| `/api/bubble/tour/[id]` | GET | 투어 상세 조회 | `getTourById` |
| `/api/bubble/spots/[tourId]` | GET | 투어별 스팟 목록 | `getSpotsByTourId` |
| `/api/bubble/spot/[spotId]` | GET | 단일 스팟 조회 | 직접 Bubble fetch |
| `/api/bubble/spot-poses` | GET | 전체 스팟 포즈 목록 | `getSpotPoses` |
| `/api/bubble/spot-poses-by-spot/[spotId]` | GET | 스팟별 포즈 (선택적 `tourId`, `persona` 필터) | `getSpotPosesBySpotId`, `getSpotPosesByFilters` |
| `/api/bubble/personas/[tourId]/[spotId]` | GET | 투어+스팟별 페르소나 목록 | `getPersonasByTourAndSpot` |
| `/api/bubble/categories` | GET | 포즈 카테고리 | `getPoseCategories` |
| `/api/bubble/reviews` | GET | 리뷰 목록 | `fetchReviews` |
| `/api/bubble/search-coupon` | GET | 쿠폰 검색 (날짜+전화번호) | `searchCoupon` |
| `/api/bubble/pose-reservation` | POST | 포즈 예약 마스터 레코드 생성 | 직접 Bubble fetch |
| `/api/bubble/reserved-pose` | POST | 개별 포즈 예약 레코드 생성 | 직접 Bubble fetch |
| `/api/bubble/pose-reservation-by-folder` | GET | folder_Id로 예약 조회 | 직접 Bubble fetch (constraints) |
| `/api/bubble/reservation/[id]` | GET, PATCH | 예약 조회/상태 업데이트 | `getPoseReservation`, `updateReservationStatus` |
| `/api/bubble/pose-guides/[reservationId]` | GET | 예약별 포즈 가이드 이미지 | `getPoseGuidesForReservation` |
| `/api/bubble/auth-photo` | POST | 인증사진 업로드 (base64) | `updateAuthPhoto` |
| `/api/bubble/cancel-reservation` | DELETE | 예약 취소 (reserved_pose + pose_reservation 삭제) | 직접 Bubble DELETE |

---

## 6. Bubble.io 데이터 모델 (주요 테이블)

```
┌─────────────────┐     ┌──────────────┐     ┌───────────────┐
│     tour        │────→│    spot       │────→│   spot_pose   │
│ _id             │     │ _id          │     │ _id           │
│ tour_Id (num)   │     │ spot_Id (num)│     │ tour_Id       │
│ tour_name       │     │ spot_name    │     │ spot_Id       │
│ tour_date       │     │ Tour_ID      │     │ persona       │
│ status          │     │ thumbnail    │     │ image         │
│ min_total       │     │ min_count    │     └───────┬───────┘
│ max_total       │     │  _limit      │             │
└─────────────────┘     └──────────────┘             │
                                                      │
┌──────────────────┐     ┌──────────────────┐         │
│pose_reservation  │────→│  reserved_pose   │─────────┘
│ _id              │     │ _id              │
│ folder_Id        │     │ pose_reservation │  (Link to pose_reservation)
│ tour_Id          │     │  _id             │
│ user_Id          │     │ spot_pose_Id     │  (Link to spot_pose)
│ status           │     └──────────────────┘
│ qrCodeUrl        │
│ auth_photo       │
│ Created Date     │
└──────────────────┘

┌──────────────────┐     ┌──────────────────┐
│  excel_coupon    │     │    review        │
│ _id              │     │ _id              │
│ phone            │     │ image            │
│ code             │     │ review (text)    │
│ tour_date        │     │ score            │
│ user_name        │     │ title            │
│ coupon_name      │     │ user             │
│ tour_Id          │     │ nickname         │
└──────────────────┘     └──────────────────┘
```

---

## 7. 핵심 플로우

### 7.1 포즈 예약 플로우 (고객)

```
[my-tours] → 투어 선택 → [reserve/spots] → 스팟 선택
         → [reserve/poses] → 포즈 선택 (페르소나 필터)
         → [reserve/review] → 확인 & 제출
         → pose_reservation 생성 → reserved_pose 생성
         → QR 코드 생성 → 성공 모달
```

**상태 관리**: Zustand store (`lib/reservation-store.ts`)
- `tourId`, `folderId`, `spotSelections` (스팟별 선택된 포즈 ID 배열)
- `editMode`: 기존 예약 수정 시 활성화
- localStorage에 persist (키: `cheiz-reservation-storage`)

**유효성 검사**: `lib/validation-engine.ts`
- 스팟별 최소 포즈 수 (`min_count_limit`)
- 전체 최소/최대 포즈 수 (`tour.min_total` / `tour.max_total`)

### 7.2 포토그래퍼 촬영 플로우

```
[photographer] → QR 스캔 (BarcodeDetector / jsQR)
             → 인증사진 촬영 (Canvas 캡처 → 3MB 이하 압축 → 업로드)
             → 포즈 가이드 조회 (reservation별)
             → 촬영 시작 / 촬영 완료
             → reservation 상태 "Completed"로 PATCH
```

**이미지 압축**: Canvas API로 JPEG quality를 낮추며 3MB 이하까지 반복 압축

### 7.3 인증 플로우

```
[signin] → 이메일 입력 → 기존 회원: 비밀번호 → signIn("credentials")
                       → 신규: /auth/signup?email=
         → 카카오: signIn("kakao") → OAuth → 백엔드 social login
         → 구글: GoogleLogin → idToken → signIn("google-direct")
         
[signup] → 약관 동의 → 이메일 인증(6자리) → 비밀번호 설정 → 닉네임 → 프로필사진(선택) → 가입완료
```

---

## 8. 구현 완료된 기능

| 기능 | 상태 | 관련 파일 |
|------|------|----------|
| SNS 로그인 (카카오/구글) | ✅ 완료 | `lib/auth.ts`, `app/auth/signin/page.tsx` |
| 이메일/비밀번호 로그인 | ✅ 완료 | `lib/auth.ts`, `app/auth/signin/page.tsx` |
| 회원가입 (5단계) | ✅ 완료 | `app/auth/signup/page.tsx`, `lib/api-client.ts` |
| 이메일 인증 (SendGrid) | ✅ 완료 | `app/auth/signup/page.tsx`, `lib/api-client.ts` |
| RBAC 미들웨어 | ✅ 완료 | `middleware.ts` |
| 투어별 스팟/포즈 조회 | ✅ 완료 | `app/cheiz/reserve/spots/`, `poses/` |
| 포즈 예약 (신규/수정) | ✅ 완료 | `app/cheiz/reserve/review/page.tsx` |
| 예약 QR 코드 생성 | ✅ 완료 | `app/cheiz/reserve/review/page.tsx` |
| 예약 목록 조회 | ✅ 완료 | `app/cheiz/my-tours/page.tsx` |
| 예약 취소 | ✅ 완료 | `app/cheiz/my-tours/page.tsx` |
| 쿠폰 조회 (Bubble) | ✅ 완료 | `app/cheiz/page.tsx` (CouponSheet) |
| 리뷰 목록 조회 | ✅ 완료 | `app/cheiz/page.tsx` |
| 포토그래퍼 QR 스캔 | ✅ 완료 | `components/CameraScanner.tsx` |
| 인증사진 촬영/업로드 | ✅ 완료 | `components/PhotographerApp.tsx` |
| 이미지 3MB 이하 압축 | ✅ 완료 | `components/PhotographerApp.tsx` |
| 포즈 가이드 조회 | ✅ 완료 | `components/PhotographerApp.tsx` |
| 촬영 완료 상태 변경 | ✅ 완료 | `components/PhotographerApp.tsx` |
| 하단 네비게이션 바 | ✅ 완료 | `app/cheiz/components/BottomNav.tsx` |
| KIMI 디자인 시스템 적용 | ✅ 완료 | 전체 페이지 (Electric Blue #0055FF 테마) |

---

## 9. 미완성 / 진행 예정 기능

| 기능 | 현재 상태 | 설명 |
|------|----------|------|
| 마이페이지 예약 내역 | ⚠️ 미완성 | `app/cheiz/mypage/page.tsx`에서 예약 데이터 fetch 미구현 (빈 배열) |
| 쿠폰 목록 페이지 | ⚠️ 미완성 | `app/cheiz/coupons/page.tsx`에서 mock 데이터 사용 중 |
| 예약 폼 (booking) | ⚠️ 미완성 | `app/cheiz/booking/page.tsx`가 포즈 예약 플로우와 미연동 |
| 비밀번호 재설정 | ❌ 미구현 | `/auth/reset-password` 라우트 없음 (signin에 링크만 존재) |
| 알림/푸시 | ❌ 미구현 | - |
| 결제 연동 | ❌ 미구현 | `app/api/v1/orders/route.ts.deprecated` 파일이 존재 (비활성) |
| 설정 페이지 | ❌ 미구현 | - |
| 프로필 편집 | ❌ 미구현 | - |

### React Native 앱에서 이식 예정 기능

> 참고: `cheiz-app` 폴더는 현재 프로젝트에 포함되어 있지 않습니다. 별도 리포지토리에서 관리될 수 있습니다.

- **QR 스캔 고도화**: 네이티브 카메라 접근 → 웹 BarcodeDetector/jsQR로 이미 구현됨
- **사진 업로드 (고객용)**: 고객이 직접 사진을 업로드하는 기능
- **SendGrid 이메일 알림**: 예약 확인, 촬영 완료 알림 등 (현재는 회원가입 인증에만 사용)
- **실시간 촬영 상태 업데이트**: 포토그래퍼 촬영 진행 상황을 고객에게 실시간 반영

---

## 10. Zustand 스토어 상세 (`lib/reservation-store.ts`)

```typescript
// 스토어 상태 타입
interface ReservationState {
  tourId: number | null;
  tour: Tour | null;
  spots: Spot[];
  folderId: number | null;          // Java 백엔드의 folder ID (출입증)
  
  editMode: boolean;                 // 기존 예약 수정 모드
  existingReservationId: string | null;
  pendingPoseIds: string[];          // 기존 선택된 spot_pose ID들
  
  spotSelections: Record<number, SpotSelection>;
  // SpotSelection = { spotId, spotName, minCountLimit, selectedPoses: string[] }
}

// 주요 액션
setTourId, setTour, setSpots, setFolderId
setEditMode, consumePendingPoseIds
initializeSpotSelection, addPose, removePose
isPoseSelected, getSpotSelection, getTotalSelectedCount
clearSelections, clearAll

// Persistence: localStorage 키 "cheiz-reservation-storage"
// 저장 필드: tourId, folderId, editMode, existingReservationId, pendingPoseIds, spotSelections
```

---

## 11. 디자인 시스템

### 색상 팔레트 (Tailwind 설정)

| 이름 | HEX | 용도 |
|------|-----|------|
| `cheiz` / `cheiz-blue` | `#0055FF` | 프라이머리 (버튼, 활성 상태, 링크) |
| `cheiz-orange` | `#FF6B35` | 액센트 (배지, 강조) |
| `cheiz-gray` | `#F8F9FA` | 배경 (폼, 섹션) |
| `cheiz-ink` | `#1A1A1A` | 텍스트 (기본) |

### 디자인 규칙

- **폰트**: Pretendard (CDN, `app/layout.tsx`에서 로드)
- **Border Radius**: 카드 `rounded-2xl`, 버튼/인풋 `rounded-xl`
- **Shadow**: 카드 `shadow-sm`, 모달 `shadow-lg`
- **컨테이너**: `max-w-md mx-auto` (모바일 퍼스트)
- **하단 여백**: `pb-16` (BottomNav 높이 확보)

### 참고 디자인 (`app/_kimi-design/`)

`app/_kimi-design/` 폴더는 KIMI 디자이너가 제작한 SPA 참고 디자인입니다.
- Next.js 빌드에서 **제외** (`_` 접두사)
- tsconfig에서 **제외** (`"exclude": ["app/_kimi-design"]`)
- 디자인 참고 용도로만 사용

---

## 12. 환경 변수 (.env.local)

| 변수명 | 설명 |
|--------|------|
| `NEXTAUTH_URL` | NextAuth 베이스 URL (예: `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | NextAuth JWT 서명 시크릿 |
| `KAKAO_CLIENT_ID` | 카카오 OAuth 클라이언트 ID |
| `KAKAO_CLIENT_SECRET` | 카카오 OAuth 클라이언트 시크릿 |
| `GOOGLE_CLIENT_ID` | Google OAuth 클라이언트 ID (서버) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 클라이언트 시크릿 |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth 클라이언트 ID (클라이언트, One Tap) |
| `NEXT_PUBLIC_API_BASE_URL` | Java 백엔드 URL (기본: `https://api.lifeshot.me`) |
| `BUBBLE_API_BASE_URL` | Bubble.io API 베이스 URL |
| `BUBBLE_API_TOKEN` | Bubble.io API 인증 토큰 |
| `BUBBLE_USE_VERSION_TEST` | `true`: 테스트 DB, `false`: 프로덕션 (mutation 시뮬레이션) |
| `SENDGRID_API_KEY` | SendGrid 이메일 API 키 |
| `SENDGRID_FROM_EMAIL` | SendGrid 발신 이메일 주소 |

> **주의**: `.env.local`은 Git에 커밋되지 않습니다. `.env.local.example`이 템플릿으로 존재하지만 일부 변수(`SENDGRID_*`)가 누락되어 있을 수 있습니다.

---

## 13. 개발 명령어

```bash
npm run dev      # 개발 서버 (localhost:3000)
npm run build    # 프로덕션 빌드
npm run start    # 프로덕션 서버
npm run lint     # ESLint
```

---

## 14. 주요 주의사항

1. **Bubble API 테스트/프로덕션 구분**
   - `BUBBLE_USE_VERSION_TEST=true`일 때만 실제 데이터 mutation이 발생합니다.
   - `false`이면 `lib/bubble-api.ts`에서 mutation을 시뮬레이션합니다 (실제 PATCH/DELETE 안 함).

2. **ID 체계 이중성**
   - Java 백엔드: 숫자 ID (`tourId`, `folderId`)
   - Bubble.io: 문자열 `_id` (예: `1735012345678x123456789`)
   - `MANUAL_` 접두사가 붙은 ID는 `sanitizeReservationId()`로 정제 필요

3. **이미지 처리**
   - 인증사진: Canvas API로 JPEG 압축 (3MB 이하)
   - 원격 이미지: `next.config.js`의 `remotePatterns`에 등록된 도메인만 허용
   - 허용 도메인: `*.cdn.bubble.io`, `s3.amazonaws.com`, `api.lifeshot.me`

4. **TypeScript 빌드**
   - `next.config.js`에 `typescript.ignoreBuildErrors: true` 설정됨
   - 기존 코드에 pre-existing 타입 에러가 존재 (strict mode 관련)
   - 개발 시 IDE에서 타입 에러 확인 가능

5. **`_kimi-design` 폴더**
   - `app/_kimi-design/`은 디자인 레퍼런스용 Next.js 프로젝트입니다.
   - 빌드/타입체크에서 완전히 제외됩니다.
   - 이 폴더의 코드를 import하거나 참조하면 안 됩니다.

6. **`api-client.ts`의 snake_case 변환**
   - Java 백엔드 API와 통신 시 `lib/api-client.ts`가 요청/응답을 snake_case↔camelCase 변환합니다.

7. **localStorage 사용**
   - Zustand: `cheiz-reservation-storage` (예약 상태)
   - CameraScanner: `cheiz-last-camera` (마지막 사용 카메라)
   - PhotographerApp: `cheiz-session-count` (촬영 세션 카운트)
