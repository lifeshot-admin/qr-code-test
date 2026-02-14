# Cheiz

포토그래퍼 예약 관리 및 고객용 포즈 예약 서비스입니다.  
Bubble.io Data API와 연동됩니다.

## 두 가지 앱 모드 (RBAC 적용)

1. **일반 사용자 앱** (`/cheiz`) - 🔐 User Role Required
   - 5-Step Email Signup Wizard
   - Multi-Provider Auth (Google, Kakao, Email)
   - My Tours Dashboard → Pose Selection → Order Confirmation
   
2. **포토그래퍼 앱** (`/photographer`) - 🔐 Photographer Role Required
   - QR 스캔, 인증사진 업로드, 포즈 가이드
   - **Middleware Guard**: User role은 접근 불가 (Toast + Redirect)

> **RBAC Middleware**: `middleware.ts`가 모든 요청을 가로채고 역할 기반 접근 제어를 수행합니다.

## 기술 스택

- **프레임워크**: Next.js 14 (App Router), TypeScript
- **인증**: NextAuth v4
  - **Providers**: Google OAuth, Kakao OAuth, Credentials (Email/Password)
  - **Session**: JWT-based, persistent cookies
  - **RBAC**: Role-based access control via middleware
- **애니메이션**: Framer Motion (slide-up, fade-in, scale-up, spring animations)
- **스타일**: Tailwind CSS
  - **브랜드 컬러**: Sky Blue (#00AEEF) - 30+ instances
  - **Corner Radius**: rounded-3xl - 40+ instances
  - **반응형**: Mobile-first (grid-cols-2 md:grid-cols-3 lg:grid-cols-4)
- **백엔드 연동**:
  - **Swagger API** (`https://api.lifeshot.me`)
    - Email verification: `/api/v1/auth/email/code/*`
    - Nickname check: `/api/v1/auth/nickname/check`
    - Terms & conditions: `/api/v1/auth/terms/*`
    - Tours: `/api/v1/folders`
    - Orders: `/api/v1/orders`
  - **Bubble.io Data API** (Fallback)
    - **테이블**: tour, SPOT, Spot_pose, EXCEL (쿠폰), Reservation_Final
    - **Workflow**: sign_up_cheiz_web, login_cheiz_web

## 화면 흐름

### 일반 사용자 (Cheiz) - 🔐 **Swagger-Based Architecture**

#### 🔑 **Authentication Flow**
1. **회원가입** (`/auth/signup`) – **5-Step Email Signup Wizard** ⭐
   - **Step 1**: Email Verification (Backend API: `/api/v1/auth/email/code/send`, 3분 타이머)
   - **Step 2**: Password Setup (실시간 강도 체크, confirm password 매칭)
   - **Step 3**: Terms Agreement (Swagger API: `/api/v1/auth/terms/policies`, 스크롤 모달)
   - **Step 4**: Nickname (실시간 중복 체크: `/api/v1/auth/nickname/check`)
   - **Step 5**: Profile Image (업로드 또는 기본 이미지)
   - **Progress Bar**: 상단 진행도 표시 (1/5 → 5/5)
   - **Persistence**: sessionStorage에 자동 저장 (페이지 새로고침 대응)

2. **로그인** (`/auth/signin`) – **Multi-Provider Login**
   - 🟦 **Google OAuth**: GoogleProvider
   - 🟨 **Kakao OAuth**: KakaoProvider  
   - 📧 **Email/Password**: CredentialsProvider (Bubble Workflow: `login_cheiz_web`)
   - **Social Login Bridge**: 첫 로그인 시 → Step 3 (Terms)로 리다이렉트

#### 📊 **Main User Flow**
3. **My Tours Dashboard** (`/cheiz/my-tours`) – **Gateway Page** ⭐⭐⭐
   - **Data Source**: Swagger API `GET /api/v1/folders?user_id={userId}&status=Active,Confirmed`
   - **UI**: D-day 정렬 카드 그리드 (D-7, D-1, D-DAY, 완료)
   - **Empty State**: "예약된 투어가 없습니다" + "쿠폰 조회하기" CTA
   - **Navigation**: 카드 클릭 → `/cheiz/reserve?tour_id={id}`

4. **Pose Selection Flow** (`/cheiz/reserve?tour_id={id}`) – **Core Feature** ⭐
   - **Step 1**: Tour 유효성 검증 (tour_id 없으면 "No Reservation" 화면)
   - **Step 2**: Spot 선택 (Bubble API: SPOT 테이블, 썸네일 카드)
   - **Step 3**: Persona 필터 (전체, 1인, 2인, 커플, 가족) - 실시간 필터링
   - **Step 4**: Pose 갤러리 (Instagram 스타일, 체크마크 선택)
   - **Floating Counter**: "N개 포즈 선택됨" + "확인하기"
   - **Final Save**: Swagger API `POST /api/v1/orders`
     - Payload: `{ tour_id, selected_pose_ids, user_id, timestamp }`
   - **Success Modal**: Framer Motion spring animation + 2초 후 자동 리다이렉트

5. **홈** (`/cheiz`) – 3개 주요 기능 버튼
   - 🎫 **쿠폰 조회**: EXCEL 테이블 검색 → tour_Id 획득
   - 📸 **나만의 포즈 예약**: 로그인 체크 → My Tours로 이동
   - 💬 **1:1 문의하기**: 카카오톡 채널

6. **기타 페이지**
   - `/cheiz/pose-selector` – 전체 포즈 목록 (로그인 필수)
   - `/cheiz/coupons` – 쿠폰 목록 (참고용)
   - `/not-found` – 커스텀 404 (Cheiz 브랜딩)

### 포토그래퍼
1. **스캔** (`/photographer?page=scan`) – QR 스캔 또는 예약화면 수동 촬영
2. **확인** (`?page=confirm`) – 인식된 예약 ID 확인 후 인증사진 촬영으로 진행
3. **인증사진** (`?page=auth`) – 고객 인증사진 촬영 후 업로드 확인
4. **완료** (`?page=shoot`) – 인증사진 미리보기 + Reserved_pose 포즈 가이드 목록 → 다음 고객으로

## 설정

1. 의존성 설치  
   ```bash
   npm install
   ```

2. 환경 변수  
   `.env.local.example`을 복사해 `.env.local` 생성 후 값 설정:

   ```env
   BUBBLE_API_BASE_URL=https://api.lifeshot.me
   BUBBLE_API_TOKEN=09d177ba7ec8b145ef39d1028e26143f
   BUBBLE_USE_VERSION_TEST=true
   ```

   - `BUBBLE_API_BASE_URL`: 커스텀 도메인 베이스
   - `BUBBLE_API_TOKEN`: Bubble Data API 토큰 (Bearer 접두사 없이)
   - `BUBBLE_USE_VERSION_TEST`: **true면 테스트 DB(version-test)**
   - `KAKAO_CLIENT_ID`: Kakao OAuth 클라이언트 ID
   - `KAKAO_CLIENT_SECRET`: Kakao OAuth 시크릿
   - `NEXTAUTH_URL`: NextAuth URL (로컬: http://localhost:3000)
   - `NEXTAUTH_SECRET`: NextAuth 시크릿 키

   **⚠️ 중요: 테스트 DB 전용 설정**
   - `BUBBLE_USE_VERSION_TEST=true`로 설정하면 모든 API 요청이 `/version-test` 경로로 전송됩니다
   - 최종 URL: `https://api.lifeshot.me/version-test/api/1.1/obj`
   - 터미널에 `🧪 Targeting Bubble Test DB:` 로그가 표시되어 확인 가능
   
   **Authorization 헤더:**
   - 코드에서 자동으로 `Authorization: Bearer {토큰}` 형식으로 구성됨
   - `.env.local`에는 `Bearer` 없이 순수 토큰만 입력

3. 실행  
   ```bash
   npm run dev
   ```
   브라우저에서 http://localhost:3000

## URL 파라미터

- `?page=scan` – 스캔 화면 (기본)
- `?page=confirm&reservation={id}` – 확인 화면
- `?page=auth&reservation={id}` – 인증사진 촬영
- `?page=shoot&reservation={id}` – 촬영 완료(포즈 가이드)

## 주요 파일

### 일반 사용자 (Cheiz)
- `app/cheiz/page.tsx` – 메인 홈 (쿠폰 조회 모달, 포즈 예약, 1:1 문의)
- `app/cheiz/reserve/page.tsx` – **포즈 선택 플로우** (Spot + Persona + Pose 갤러리) ⭐
- `app/cheiz/pose-selector/page.tsx` – 포즈 셀렉터 (Bubble Spot_pose 전체 목록)
- `app/cheiz/coupons/page.tsx` – 쿠폰 목록
- `app/cheiz/mypage/page.tsx` – 마이페이지
- `app/auth/signin/page.tsx` – 카카오 로그인 페이지
- `app/auth/error/page.tsx` – 인증 에러 페이지

### 포토그래퍼
- `components/CameraScanner.tsx` – 카메라/QR 스캔/수동·인증 촬영 로직
- `app/photographer/page.tsx` – 포토그래퍼 앱

### 공통
- `lib/bubble-api.ts` – Bubble Data API 호출
  - **새로운 타입**: `Tour`, `Spot`, `ExcelCoupon` (tour_Id 포함)
  - **새로운 함수**: `getTourById`, `getSpotsByTourId`, `getSpotPosesBySpotId` (persona 필터)
  - **기존 함수**: 예약 조회, 인증사진 생성, 포즈 목록, 쿠폰 검색
- `app/api/bubble/*` – API 라우트
  - `search-coupon/route.ts` – 쿠폰 조회 (EXCEL 테이블)
  - `tour/[id]/route.ts` – Tour 조회
  - `spots/[tourId]/route.ts` – Spot 목록 조회
  - `spot-poses-by-spot/[spotId]/route.ts` – Spot_pose 조회 (persona 필터)
  - `auth-photo/route.ts` – 인증사진 업로드
  - `reservation/[id]/route.ts` – 예약 조회
  - `pose-guides/[reservationId]/route.ts` – 포즈 가이드
  - `categories/route.ts` – 카테고리 목록
- `app/api/auth/[...nextauth]/route.ts` – NextAuth (Kakao OAuth, Bubble Workflow API)
- `app/providers.tsx` – SessionProvider 래퍼
- `app/api/auth/[...nextauth]/route.ts` – NextAuth 설정 (Kakao Login)
