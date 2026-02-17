# CHEIZ 백오피스 (Admin Panel) 설계서

> 생성일: 2026-02-15
> 프로젝트 전수조사 기반 — 42개 API 라우트 / 22개 페이지 / 12개 컴포넌트 분석 완료

---

## Step 1. 관리 항목 전수 추출

### 엔티티 맵

| # | 엔티티명 | 데이터 소스 | 현재 관리 방식 | 필요 기능 |
|---|---------|-----------|-------------|---------|
| 1 | **투어 (Tour)** | Java Backend | API 직접 호출 | 목록 조회, 생성, 수정(이름/설명/가격/이미지), 마감 토글, 삭제 |
| 2 | **스케줄 (Schedule)** | Java Backend | API 직접 호출 | 날짜/시간별 조회, 생성, 수정, 삭제 |
| 3 | **스팟 (Spot)** | Bubble DB | Bubble 에디터 수동 | 투어별 목록, 생성, 수정(이름/이미지/min_count), 순서 변경, 삭제 |
| 4 | **포즈 (Spot Pose)** | Bubble DB | Bubble 에디터 수동 | 스팟별 목록, 이미지 업로드, 페르소나 배정, min/max 설정, 삭제 |
| 5 | **페르소나 (Persona)** | Bubble DB | 포즈 데이터에 내장 | 목록 조회, 생성, 수정, 삭제 |
| 6 | **카테고리 (Category)** | Bubble DB | Bubble 에디터 수동 | 목록 조회, 생성, 수정, 삭제 |
| 7 | **예약 (Pose Reservation)** | Bubble DB | 유저 앱에서 자동 생성 | 목록 조회, 상태 변경, 상세 보기, QR 코드 확인, 삭제 |
| 8 | **선택 포즈 (Reserved Pose)** | Bubble DB | 유저 앱에서 자동 생성 | 예약별 조회, 삭제 |
| 9 | **주문 (Order)** | Java Backend | 없음 | 목록 조회, 상태 확인, 환불 처리 |
| 10 | **결제 (Payment)** | Stripe + Java | Stripe 대시보드 | 목록 조회, 환불, 매출 통계 |
| 11 | **폴더 (Folder)** | Java Backend | 없음 | 목록 조회, 상태 변경(RESERVED→COMPLETED 등), 사진 확인 |
| 12 | **사진 (Photo)** | Java Backend (S3) | 없음 | 폴더별 조회, 다운로드, AI 보정 상태 확인 |
| 13 | **쿠폰 (Coupon)** | Java Backend | 없음 | 발행, 목록 조회, 사용 현황, 비활성화 |
| 14 | **크레딧/지갑 (Credit)** | Java Backend | 없음 | 유저별 잔액 조회, 수동 지급/차감 |
| 15 | **리뷰 (Review)** | Bubble DB | Bubble 에디터 수동 | 목록 조회, 승인/비승인 토글, 삭제, 이미지 확인 |
| 16 | **사용자 (User)** | Java Backend | 없음 | 목록 조회, 역할 변경, 크레딧 관리, 강제 탈퇴 |
| 17 | **리터처 (Retoucher)** | **하드코딩** + Java | 코드 직접 수정 | 목록 조회, 프로필 수정, 가격 설정, 샘플 이미지 관리 |
| 18 | **이벤트 (Reward Event)** | **하드코딩** | 코드 직접 수정 | 목록 조회, 생성, 수정, 활성/비활성 토글, 삭제 |
| 19 | **홈 배너 (Banner)** | **하드코딩** | 코드 직접 수정 | 이미지 업로드, 제목/부제 수정, 순서 변경, 노출 토글 |
| 20 | **포즈 가이드 (Pose Guide)** | Bubble DB | Bubble 에디터 수동 | 예약별 조회, 이미지 업로드, 삭제 |
| 21 | **AI 작업 (AI Job)** | Bubble Workflow | 없음 | 작업 목록 조회, 상태 모니터링, 재실행 |
| 22 | **EXCEL 쿠폰** | Bubble DB | Bubble 에디터 수동 | 일괄 업로드, 조회, 삭제 |

---

## Step 2. 하드코딩 데이터 → DB 이전 설계

### 2-1. 이벤트 (Reward Event) — `events/page.tsx`

#### 현재 상태
`REWARD_EVENTS` 배열이 클라이언트 코드에 직접 작성됨 (5개 이벤트).
이벤트 추가/수정/비활성화 시 코드 배포 필수.

#### 제안 테이블 구조 (Bubble DB: `reward_event`)

| 필드명 | 타입 | 설명 |
|--------|------|------|
| `_id` | text (PK) | 이벤트 고유 ID (e.g., "welcome") |
| `title` | text | 이벤트 제목 |
| `subtitle` | text | 부제/요약 |
| `credit_type` | text | "PHOTO" / "AI" / "RETOUCH" |
| `credit_amount` | number | 지급 크레딧 수 |
| `image` | image | 리스트 썸네일 (400x300) |
| `badge` | text | 뱃지 텍스트 ("NEW", "HOT", "추천" 등, nullable) |
| `active` | boolean | 노출 여부 |
| `sort_order` | number | 정렬 순서 |
| `mission_type` | text | "CLICK" (내부 지급) / "PARTNER" (외부 이동) |
| `gift_Id` | number | CLICK 타입일 때 Java Backend gift ID (nullable) |
| `target_url` | text | PARTNER 타입일 때 외부 URL (nullable) |
| `main_image` | image | 상세 페이지 메인 이미지 (800x500) |
| `benefit_desc` | text | 혜택 설명 |
| `content_detail` | text | 상세 설명 (여러 줄) |
| `condition_desc` | text | 참여 조건 |
| `button_text` | text | CTA 버튼 텍스트 |
| `start_date` | date | 이벤트 시작일 (nullable) |
| `end_date` | date | 이벤트 종료일 (nullable) |
| `Created Date` | date | 생성일 |

#### 필요 API

| 메서드 | 경로 | 용도 |
|--------|------|------|
| `GET` | `/api/bubble/reward-events` | 활성 이벤트 목록 (active=true, sort_order 순) |
| `GET` | `/api/bubble/reward-events/[id]` | 이벤트 상세 |
| `POST` | `/api/admin/reward-events` | 이벤트 생성 (관리자 전용) |
| `PATCH` | `/api/admin/reward-events/[id]` | 이벤트 수정 (관리자 전용) |
| `DELETE` | `/api/admin/reward-events/[id]` | 이벤트 삭제 (관리자 전용) |

---

### 2-2. 홈 배너 (Banner Slider) — `EventSlider.tsx`

#### 현재 상태
`defaultSlides` 배열 4개가 컴포넌트 내부에 하드코딩.
이미지가 외부 CDN(kimi-web-img)에 의존 — 링크 깨짐 위험.

#### 제안 테이블 구조 (Bubble DB: `home_banner`)

| 필드명 | 타입 | 설명 |
|--------|------|------|
| `_id` | auto | PK |
| `image` | image | 배너 이미지 (S3 업로드 권장, 800x500) |
| `title` | text | 배너 제목 |
| `subtitle` | text | 배너 부제 |
| `link_url` | text | 클릭 시 이동 URL (nullable) |
| `sort_order` | number | 노출 순서 |
| `active` | boolean | 노출 여부 |
| `start_date` | date | 노출 시작일 (nullable) |
| `end_date` | date | 노출 종료일 (nullable) |
| `Created Date` | date | 생성일 |

#### 필요 API

| 메서드 | 경로 | 용도 |
|--------|------|------|
| `GET` | `/api/bubble/banners` | 활성 배너 목록 (active=true, sort_order 순) |
| `POST` | `/api/admin/banners` | 배너 생성 (관리자 전용) |
| `PATCH` | `/api/admin/banners/[id]` | 배너 수정 (관리자 전용) |
| `DELETE` | `/api/admin/banners/[id]` | 배너 삭제 (관리자 전용) |

---

### 2-3. 리터처 (Retoucher) — `retoucher/[id]/page.tsx`

#### 현재 상태
`RETOUCHERS` 객체에 ID=7인 작가 1명만 하드코딩.
프로필, 가격, Before/After 샘플 모두 코드에 직접 작성됨.

#### 제안 테이블 구조 (Java Backend: `retoucher` 테이블 확장)

| 필드명 | 타입 | 설명 |
|--------|------|------|
| `id` | bigint (PK) | 리터처 ID |
| `name` | varchar | 이름 |
| `title` | varchar | 직함 (e.g., "CHEIZ 전속 리터쳐") |
| `avatar_url` | varchar | 프로필 이미지 URL |
| `cover_image_url` | varchar | 커버 이미지 URL |
| `description` | text | 짧은 소개 |
| `long_description` | text | 상세 소개 |
| `specialties` | json | 전문 분야 배열 (["피부 보정", "컬러 그레이딩", ...]) |
| `rating` | decimal(2,1) | 평점 (4.9) |
| `review_count` | int | 리뷰 수 |
| `completed_count` | int | 완료 작업 수 |
| `avg_delivery_days` | int | 평균 납기 (일) |
| `price_per_photo` | int | 장당 가격 (원) |
| `active` | boolean | 활성 여부 |
| `sort_order` | int | 노출 순서 |

#### Before/After 샘플 테이블 (`retoucher_sample`)

| 필드명 | 타입 | 설명 |
|--------|------|------|
| `id` | bigint (PK) | 샘플 ID |
| `retoucher_id` | bigint (FK) | 리터처 ID |
| `before_image_url` | varchar | Before 이미지 |
| `after_image_url` | varchar | After 이미지 |
| `caption` | varchar | 설명 (e.g., "자연광 인물 보정") |
| `sort_order` | int | 순서 |

#### 필요 API

| 메서드 | 경로 | 용도 |
|--------|------|------|
| `GET` | `/api/backend/retouchers` | 리터처 목록 (기존 확장) |
| `GET` | `/api/backend/retouchers/[id]` | 리터처 상세 + 샘플 |
| `POST` | `/api/admin/retouchers` | 리터처 등록 (관리자 전용) |
| `PATCH` | `/api/admin/retouchers/[id]` | 리터처 수정 (관리자 전용) |
| `POST` | `/api/admin/retouchers/[id]/samples` | 샘플 추가 (관리자 전용) |
| `DELETE` | `/api/admin/retouchers/[id]/samples/[sampleId]` | 샘플 삭제 (관리자 전용) |

---

## Step 3. 백오피스 구조 설계

### 3-1. 관리자 권한 가드 (RBAC)

#### 현재 역할 체계 (auth.ts 분석)

```
User         → /cheiz/* 접근 가능
Photographer → /photographer/* + /cheiz/* 접근 가능
(ROLE_SNAP)
```

#### 추가할 역할

```
Admin        → /admin/* 접근 가능 (모든 관리 기능)
SuperAdmin   → /admin/* + 시스템 설정 접근 가능
```

#### middleware.ts 확장 포인트

```typescript
// 기존 코드의 RBAC 분기에 추가:
if (pathname.startsWith("/admin")) {
  const adminRoles = ["Admin", "SuperAdmin", "ROLE_ADMIN"];
  if (!adminRoles.includes(userRole)) {
    return NextResponse.redirect(new URL("/cheiz", request.url));
  }
}
```

#### 세션 기반 가드 (클라이언트 레이아웃)

```typescript
// app/admin/layout.tsx
export default function AdminLayout({ children }) {
  const { data: session, status } = useSession();
  
  if (status === "loading") return <AdminSkeleton />;
  if (!session || !["Admin","SuperAdmin","ROLE_ADMIN"].includes(session.user.role)) {
    redirect("/cheiz");
  }
  
  return <AdminShell>{children}</AdminShell>;
}
```

---

### 3-2. 대시보드 메뉴 구조

```
/admin
├── /admin                        ← 대시보드 (KPI 요약)
│   ├── 오늘의 예약 수
│   ├── 이번 달 매출
│   ├── 활성 유저 수
│   └── 최근 주문 리스트
│
├── /admin/tours                  ← 투어 관리
│   ├── 투어 목록 (검색/필터)
│   ├── 투어 생성/수정 폼
│   ├── 투어별 스케줄 관리
│   └── 투어 마감/노출 토글
│
├── /admin/spots                  ← 스팟 & 포즈 관리
│   ├── 투어별 스팟 목록
│   ├── 스팟별 포즈 목록
│   ├── 포즈 이미지 업로드
│   ├── 페르소나/카테고리 관리
│   └── min/max 포즈 수 설정
│
├── /admin/reservations           ← 예약 관리
│   ├── 전체 예약 목록 (상태별 필터)
│   ├── 예약 상세 (QR 코드, 선택 포즈, 인증사진)
│   ├── 상태 변경 (pending → reserved → completed)
│   └── 예약 취소/삭제
│
├── /admin/orders                 ← 주문 & 결제 관리
│   ├── 주문 목록 (날짜/상태 필터)
│   ├── 결제 현황 (Stripe 연동)
│   ├── 환불 처리
│   └── 매출 통계 (일별/월별)
│
├── /admin/users                  ← 사용자 관리
│   ├── 유저 목록 (검색/역할 필터)
│   ├── 유저 상세 (프로필, 예약 이력, 크레딧)
│   ├── 역할 변경 (User ↔ Photographer ↔ Admin)
│   └── 크레딧 수동 지급/차감
│
├── /admin/content                ← 콘텐츠 관리
│   ├── /admin/content/banners    ← 홈 배너 관리 (순서 변경, 노출 토글)
│   ├── /admin/content/events     ← 이벤트/미션 관리 (CRUD + 활성 토글)
│   ├── /admin/content/reviews    ← 리뷰 관리 (승인/비승인/삭제)
│   └── /admin/content/retouchers ← 리터처 프로필 관리
│
├── /admin/coupons                ← 쿠폰 & 크레딧 관리
│   ├── 쿠폰 발행 (템플릿 생성)
│   ├── 발급 이력 조회
│   ├── EXCEL 쿠폰 일괄 업로드
│   └── 크레딧 타입별 통계
│
└── /admin/photos                 ← 사진 & AI 관리
    ├── 폴더 목록 (상태별 필터)
    ├── 폴더별 사진 조회
    ├── AI 보정 작업 모니터링
    └── 사진 전송 상태 확인
```

---

### 3-3. 관리자 페이지 파일 구조

```
app/admin/
├── layout.tsx                    ← RBAC 가드 + 사이드바 레이아웃
├── page.tsx                      ← 대시보드
├── loading.tsx                   ← 스켈레톤
│
├── tours/
│   ├── page.tsx                  ← 투어 목록
│   └── [id]/page.tsx             ← 투어 상세/수정
│
├── spots/
│   └── page.tsx                  ← 스팟 & 포즈 관리
│
├── reservations/
│   ├── page.tsx                  ← 예약 목록
│   └── [id]/page.tsx             ← 예약 상세
│
├── orders/
│   └── page.tsx                  ← 주문 & 결제
│
├── users/
│   ├── page.tsx                  ← 유저 목록
│   └── [id]/page.tsx             ← 유저 상세
│
├── content/
│   ├── banners/page.tsx          ← 배너 관리
│   ├── events/page.tsx           ← 이벤트 관리
│   ├── reviews/page.tsx          ← 리뷰 관리
│   └── retouchers/page.tsx       ← 리터처 관리
│
├── coupons/
│   └── page.tsx                  ← 쿠폰 & 크레딧
│
└── photos/
    └── page.tsx                  ← 사진 & AI
```

---

### 3-4. 관리자 전용 API 라우트 구조

```
app/api/admin/
├── stats/route.ts                ← 대시보드 KPI 집계
│
├── reward-events/
│   ├── route.ts                  ← GET(목록), POST(생성)
│   └── [id]/route.ts             ← PATCH(수정), DELETE(삭제)
│
├── banners/
│   ├── route.ts                  ← GET(목록), POST(생성)
│   └── [id]/route.ts             ← PATCH(수정), DELETE(삭제)
│
├── retouchers/
│   ├── route.ts                  ← GET(전체 목록), POST(등록)
│   ├── [id]/route.ts             ← PATCH(수정), DELETE(삭제)
│   └── [id]/samples/route.ts     ← POST(샘플 추가), DELETE(샘플 삭제)
│
├── users/
│   ├── route.ts                  ← GET(목록 + 검색)
│   └── [id]/
│       ├── route.ts              ← PATCH(역할 변경)
│       └── credits/route.ts      ← POST(크레딧 지급/차감)
│
├── reviews/
│   ├── route.ts                  ← GET(전체 목록)
│   └── [id]/route.ts             ← PATCH(승인 토글), DELETE(삭제)
│
├── reservations/
│   ├── route.ts                  ← GET(전체 목록 + 필터)
│   └── [id]/route.ts             ← PATCH(상태 변경), DELETE(취소)
│
└── orders/
    ├── route.ts                  ← GET(목록 + 필터)
    └── [id]/refund/route.ts      ← POST(환불 처리)
```

---

### 3-5. 데이터 소스별 통신 정리

| 관리 영역 | 읽기 (Read) | 쓰기 (Write) | 비고 |
|-----------|------------|-------------|------|
| 투어/스케줄 | Java Backend API | Java Backend API | api.lifeshot.me |
| 스팟/포즈/페르소나 | Bubble Data API | Bubble Data API | BUBBLE_API_TOKEN 필요 |
| 예약 (pose_reservation) | Bubble Data API | Bubble Data API | |
| 리뷰 | Bubble Data API | Bubble Data API | |
| 이벤트 (신규) | Bubble Data API | Bubble Data API | 테이블 신규 생성 필요 |
| 배너 (신규) | Bubble Data API | Bubble Data API | 테이블 신규 생성 필요 |
| 주문/결제 | Java Backend API | Stripe API | |
| 유저/크레딧 | Java Backend API | Java Backend API | |
| 리터처 | Java Backend API | Java Backend API | 테이블 확장 필요 |
| 사진/폴더/AI | Java Backend API | Java + Bubble Workflow | |
| EXCEL 쿠폰 | Bubble Data API | Bubble Data API | |

---

### 3-6. 구현 우선순위 (권장)

| 단계 | 범위 | 예상 기간 |
|------|------|----------|
| **Phase 1** | Admin 레이아웃 + RBAC 가드 + 대시보드 | 1주 |
| **Phase 2** | 콘텐츠 관리 (배너, 이벤트, 리뷰) — 하드코딩 탈출 | 1~2주 |
| **Phase 3** | 예약/주문 관리 (목록, 상태 변경, 환불) | 1~2주 |
| **Phase 4** | 유저/쿠폰/크레딧 관리 | 1주 |
| **Phase 5** | 투어/스팟/포즈 관리 (가장 복잡) | 2주 |
| **Phase 6** | 사진/AI/리터처 관리 + 통계 대시보드 고도화 | 1~2주 |
