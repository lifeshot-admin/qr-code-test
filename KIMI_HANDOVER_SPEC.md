# Cheiz 프로젝트 - 로직 중심 기술 명세서 (Kimi 인수인계용)

> **문서 목적**: UI/UX 디자이너 Kimi가 현재 시스템의 기능과 데이터 흐름을 완벽히 파악하고, 새로운 디자인을 입힐 수 있도록 작성된 **로직 중심의 기술 명세서**입니다.
>
> **보안 안내**: 실제 API URL, API Key, 외부 도메인 주소는 모두 `[HIDDEN_API]`, `[HIDDEN_KEY]`로 치환되어 있습니다.
>
> **최종 갱신일**: 2026-02-14

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [사용자 역할 (User Roles)](#2-사용자-역할-user-roles)
3. [화면 흐름 (Screen Flow)](#3-화면-흐름-screen-flow)
4. [데이터 흐름 (Data Lifecycle)](#4-데이터-흐름-data-lifecycle)
5. [핵심: "QR이 곧 진실" 로직](#5-핵심-qr이-곧-진실-로직)
6. [API 구조 (Backend Gateway)](#6-api-구조-backend-gateway)
7. [핵심 소스코드 구조 (Code Architecture)](#7-핵심-소스코드-구조-code-architecture)
8. [컴포넌트 역할 및 Props](#8-컴포넌트-역할-및-props)
9. [상태 관리 (State Management)](#9-상태-관리-state-management)
10. [UX/UI 제약 사항](#10-uxui-제약-사항)
11. [화면별 상세 명세](#11-화면별-상세-명세)

---

## 1. 프로젝트 개요

### 서비스 요약

Cheiz(치즈)는 **관광지 포토 투어 예약 서비스**입니다. 고객은 투어를 선택하고, 촬영할 스팟(장소)과 포즈를 큐레이션한 뒤, 예약을 확정하면 **QR 코드**를 받습니다. 현장에서 포토그래퍼가 이 QR을 스캔하면 해당 고객의 포즈 가이드가 즉시 나타나, 효율적이고 맞춤형 촬영이 이루어집니다.

### 기술 스택

| 구분 | 기술 |
|------|------|
| **프레임워크** | Next.js 14 (App Router) |
| **언어** | TypeScript |
| **스타일** | Tailwind CSS |
| **상태 관리** | Zustand (localStorage 영속성) |
| **인증** | NextAuth.js (Credentials, Google, Kakao) |
| **외부 백엔드** | Bubble.io Data API, Java 기반 자체 백엔드 |
| **QR 생성** | qrcode 라이브러리 |
| **QR 스캔** | BarcodeDetector API / jsQR (폴백) |
| **애니메이션** | Framer Motion |
| **이미지 처리** | Canvas API (브라우저 내 압축) |

### 주요 사용자 흐름 (한 줄 요약)

```
고객: 로그인 → 투어 선택 → 스팟 선택 → 포즈 큐레이션 → 예약 확정 → QR 생성
포토그래퍼: QR 스캔 → 인증 사진 촬영 → 포즈 가이드 확인 → 촬영 완료
```

---

## 2. 사용자 역할 (User Roles)

| 역할 | 접근 경로 | 설명 |
|------|-----------|------|
| **고객 (User)** | `/cheiz/*` | 투어 탐색, 포즈 선택, 예약, QR 확인 |
| **포토그래퍼 (Photographer / ROLE_SNAP)** | `/photographer/*` | QR 스캔, 인증 사진 촬영, 포즈 가이드 확인 |

### 접근 제어 (Middleware)

- **공개 경로**: `/`, `/auth/signin`, `/auth/signup`, `/auth/error`
- **인증 필요**: 로그인하지 않은 사용자는 모두 `/auth/signin`으로 리다이렉트
- **역할 기반 분기**:
  - `/photographer` → `Photographer` 또는 `ROLE_SNAP` 역할만 허용, 그 외 `/cheiz?error=access_denied`로 리다이렉트
  - `/cheiz` → `User`, `Photographer`, `ROLE_SNAP` 역할 허용

---

## 3. 화면 흐름 (Screen Flow)

### 3.1 전체 흐름도

```
┌──────────────────────────────────────────────────────────────────┐
│                         Landing (/)                              │
│                    ┌───────────┬───────────┐                     │
│                    ▼           ▼                                  │
│            [Cheiz 메인]   [포토그래퍼 앱]                         │
│            /cheiz          /photographer                         │
└──────────────────────────────────────────────────────────────────┘

┌─── 고객 흐름 (Customer Flow) ───────────────────────────────────┐
│                                                                  │
│  /auth/signin ─── 로그인(이메일/Google/Kakao) ──┐                │
│        ▲                                        ▼                │
│  /auth/signup ─── 회원가입(5단계) ──────────────┘                │
│                                                                  │
│  /cheiz ─────────── 홈(히어로, 쿠폰조회, 리뷰, CTA) ────────────│
│    │                                                             │
│    ├── /cheiz/my-tours ─── 마이 투어 목록 ──────────────────────│
│    │       │                                                     │
│    │       ├── [QR 표시] → QR 모달                               │
│    │       ├── [포즈 수정] → /cheiz/reserve/spots?mode=edit      │
│    │       └── [포즈 예약] → /cheiz/reserve/spots                │
│    │                           │                                 │
│    │                           ▼                                 │
│    │               /cheiz/reserve/spots ─── 스팟 목록 ──────────│
│    │                           │                                 │
│    │                           ▼                                 │
│    │               /cheiz/reserve/poses ─── 포즈 선택 ──────────│
│    │                    (스팟별, 페르소나 필터)                   │
│    │                           │                                 │
│    │                           ▼                                 │
│    │               /cheiz/reserve/review ─── 최종 확인 ─────────│
│    │                           │                                 │
│    │                           ▼                                 │
│    │                    [예약 완료 + QR 생성]                     │
│    │                                                             │
│    ├── /cheiz/coupons ─── 쿠폰 목록 (현재 목업)                  │
│    ├── /cheiz/mypage ─── 마이페이지 (현재 플레이스홀더)           │
│    └── /cheiz/booking ─── 간단 예약 폼 (레거시)                  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌─── 포토그래퍼 흐름 (Photographer Flow) ─────────────────────────┐
│                                                                  │
│  /photographer ────────────────────────────────────────────────  │
│    │                                                             │
│    ├── [page=scan] ─── QR 스캔 화면 ───────────────────────────  │
│    │       │                                                     │
│    │       ▼ (QR 인식 or 수동 입력)                              │
│    │                                                             │
│    ├── [page=auth] ─── 인증 사진 촬영 ─────────────────────────  │
│    │       │                                                     │
│    │       ▼ (인증 사진 압축 → 업로드)                           │
│    │                                                             │
│    ├── [page=shoot] ── 포즈 가이드 목록 ───────────────────────  │
│    │       │            (촬영 진행)                               │
│    │       ▼                                                     │
│    │                                                             │
│    └── [page=complete] → 다시 scan으로 ────────────────────────  │
│                                                                  │
│  /photographer/scan ── QR로부터 진입 시 reservation_id 추출 후   │
│                        /photographer?page=auth&reservation=... ── │
│                        으로 리다이렉트                            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 고객 - 핵심 예약 플로우 (Step-by-Step)

| 단계 | 화면 | 사용자 액션 | 시스템 반응 |
|------|------|------------|------------|
| **1** | `/cheiz` (홈) | 로그인 후 "인생샷 가이드" 클릭 | `/cheiz/my-tours`로 이동 |
| **2** | `/cheiz/my-tours` | 예약된 투어 중 하나 선택 → "포즈 예약" | URL에 `tour_id`, `folder_id` 포함하여 `/cheiz/reserve/spots`로 이동 |
| **3** | `/cheiz/reserve/spots` | 투어에 포함된 스팟 목록 확인 → 스팟 카드 클릭 | `/cheiz/reserve/poses?tour_id=&spot_id=&folder_id=`로 이동 |
| **4** | `/cheiz/reserve/poses` | 페르소나(1인/커플/단체 등) 필터 → 원하는 포즈 탭하여 선택/해제 | Zustand Store에 선택 상태 저장, 최소/최대 개수 실시간 검증 |
| **5** | (반복) | 다른 스팟으로 돌아가 추가 포즈 선택 | 스팟별 선택 상태가 Store에 누적 |
| **6** | `/cheiz/reserve/review` | 전체 선택 내역 확인 → "포즈 예약하기" 클릭 | API 호출(마스터 예약 생성 → 개별 포즈 등록) → QR 코드 생성 → 성공 모달 |
| **7** | 성공 모달 | QR 코드 확인, "마이페이지로" 또는 "홈으로" 클릭 | 이동 |

### 3.3 포토그래퍼 - 촬영 플로우

| 단계 | 화면 | 사용자 액션 | 시스템 반응 |
|------|------|------------|------------|
| **1** | `page=scan` | 카메라로 고객 QR 스캔 (또는 수동 ID 입력) | `reservation_id` 추출 → `page=auth`로 전환 |
| **2** | `page=auth` | 고객 인증 사진 촬영 | 이미지 3MB 이하로 압축 → Bubble API로 업로드 |
| **3** | `page=shoot` | 포즈 가이드 목록 확인하며 촬영 진행 | 해당 예약의 포즈 가이드(이미지) 표시 |
| **4** | `page=shoot` | "촬영 완료" 클릭 | 예약 상태 "Completed"로 변경 → scan으로 복귀 |

---

## 4. 데이터 흐름 (Data Lifecycle)

### 4.1 예약 데이터가 만들어지는 과정

```
┌─────────────────────────────────────────────────────────────────┐
│                    데이터 생성 흐름                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Java 백엔드]                                                  │
│       │                                                         │
│       ├── 투어(Tour) 데이터 생성                                 │
│       ├── 스팟(Spot) 데이터 생성                                 │
│       ├── 스팟별 포즈(SpotPose) 데이터 생성                      │
│       └── 사용자 투어 예약 시 folder_id 발급                     │
│                ↓                                                │
│  [고객 앱 - 클라이언트]                                         │
│       │                                                         │
│       ├── getUserTours(userId) → folder_id 포함 투어 목록 취득   │
│       ├── 스팟별 포즈 탐색 및 선택                               │
│       │     → Zustand Store (spotSelections)에 저장              │
│       │                                                         │
│       └── 최종 제출 시:                                         │
│             ① POST /api/bubble/pose-reservation                 │
│                  → { folder_Id, tour_Id, user_Id }              │
│                  ← { reservation_id } (마스터 예약 ID)           │
│                                                                 │
│             ② POST /api/bubble/reserved-pose                    │
│                  → { pose_reservation_id, selected_poses: [...] }│
│                  ← { created_count, reserved_pose_ids }         │
│                                                                 │
│             ③ QR 코드 생성 (클라이언트 사이드)                   │
│                  → URL 인코딩: /photographer/scan?reservation_id=│
│                  ← QR 이미지 (Data URL)                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 상태(State) 관리 구조

고객이 선택한 데이터는 아래 계층으로 관리됩니다:

```
Zustand Store (reservation-store)
├── tourId: number              ← 현재 선택 중인 투어 ID
├── tour: Tour                  ← 투어 상세 정보 (이름, 날짜, min/max 등)
├── spots: Spot[]               ← 투어에 포함된 스팟 목록
├── folderId: string            ← Java 백엔드의 폴더 ID (투어 예약 식별자)
├── editMode: boolean           ← 수정 모드 여부
├── existingReservationId: string ← 수정 시 기존 예약 ID
├── pendingPoseIds: string[]    ← 수정 모드 진입 시 기존 선택된 포즈 ID
│
└── spotSelections: Map<spotId, SpotSelection>
    └── SpotSelection
        ├── spotId: number
        ├── spotName: string
        ├── minCountLimit: number   ← 해당 스팟의 최소 선택 수
        └── selectedPoses: Set<string>  ← 선택된 포즈 ID 집합
```

**영속성**: `localStorage` 키 `cheiz-reservation-storage`에 자동 저장되어, 페이지 새로고침이나 뒤로가기에도 선택 상태가 유지됩니다.

### 4.3 투어 데이터 흐름 (고객이 보는 데이터)

```
Java 백엔드                    Next.js API              클라이언트
 ┌──────────┐                  ┌───────────┐           ┌──────────┐
 │ 투어 DB   │─getUserTours()──│ api-client│──fetch()──│ my-tours │
 │ (folder,  │                 │   .ts     │           │ page.tsx │
 │  tour 등) │                 │           │           │          │
 └──────────┘                  └───────────┘           └──────────┘

Bubble.io                     Next.js API Route         클라이언트
 ┌──────────┐                  ┌───────────┐           ┌──────────┐
 │ Tour     │──getTourById()──│ /api/bubble│──fetch()──│ spots    │
 │ Spot     │──getSpotsByTour │ /tour/[id] │           │ page.tsx │
 │ SpotPose │──getSpotPoses() │ /spots/... │           │ poses    │
 │ Persona  │──getPersonas()  │ /spot-poses│           │ page.tsx │
 └──────────┘                  └───────────┘           └──────────┘
```

---

## 5. 핵심: "QR이 곧 진실" 로직

### 5.1 철학

이 시스템에서 **QR 코드가 예약의 단일 진실 공급원(Single Source of Truth)**입니다. QR 코드 안에는 `reservation_id`가 인코딩되어 있으며, 이 ID 하나만으로 다음이 가능합니다:

- 해당 고객의 **모든 포즈 선택 내역** 조회
- **인증 사진** 업로드 대상 지정
- 예약 **상태 변경** (pending → completed)

### 5.2 QR 코드 생성 과정

```
[고객 클라이언트]

1. 예약 완료 후 reservation_id 수신
         ↓
2. QR 대상 URL 조립:
   `${window.location.origin}/photographer/scan?reservation_id=${reservationId}`
         ↓
3. QRCode.toDataURL() 호출
   - 크기: 300 × 300 px
   - 배경색: 하늘색 (#87CEEB)
   - 전경색: 검정 (#000000)
         ↓
4. Data URL (base64 PNG) → 화면에 이미지로 표시
```

### 5.3 QR 코드 소비 과정

```
[포토그래퍼 앱]

1. 카메라로 QR 스캔 (BarcodeDetector API 또는 jsQR 폴백)
         ↓
2. 스캔된 텍스트에서 reservation_id 추출
   - URL 파라미터 `reservation_id=` 값
   - 또는 `숫자x숫자` 형식의 베어 ID
   - 또는 `MANUAL_` 접두사 (수동 입력)
         ↓
3. /photographer/scan?reservation_id=XXX 로 리다이렉트
         ↓
4. scan 페이지가 ID를 읽고 → /photographer?page=auth&reservation=XXX 로 전환
         ↓
5. 포토그래퍼 앱이 reservation_id로:
   - 인증 사진 업로드 (POST /api/bubble/auth-photo)
   - 포즈 가이드 조회 (GET /api/bubble/pose-guides/[reservationId])
   - 촬영 완료 처리 (PATCH /api/bubble/reservation/[id])
```

### 5.4 QR 내 데이터 구조

QR 코드에 인코딩되는 문자열은 **순수 URL**입니다:

```
https://[서비스도메인]/photographer/scan?reservation_id=1737506814831x495384178753994750
```

- `reservation_id` 형식: Bubble.io의 유니크 ID (`타임스탬프x랜덤넘버`)
- QR 자체에는 포즈 정보가 담기지 않음 → **ID로 서버에서 실시간 조회**

### 5.5 수정(Edit) 모드의 데이터 흐름

```
마이투어 → "포즈 수정" 클릭
    │
    ├── 기존 예약의 reserved_pose ID들을 pendingPoseIds로 Store에 저장
    ├── editMode = true, existingReservationId = 기존 ID
    │
    ▼ spots 페이지
    ├── 각 스팟별로 spot-poses-by-spot API 조회
    ├── pendingPoseIds와 매칭하여 기존 선택 상태 복원
    │
    ▼ review 페이지에서 최종 제출 시
    ├── ① 기존 예약 DELETE (cancel-reservation)
    ├── ② 새 예약 CREATE (pose-reservation → reserved-pose)
    └── ③ 새 QR 코드 생성 (reservation_id가 변경됨!)
```

> **디자인 참고**: 수정 후에는 **QR 코드가 변경**됩니다. 고객에게 이 점을 명확히 안내하는 UX가 필요합니다.

---

## 6. API 구조 (Backend Gateway)

모든 API는 `/api/bubble/` 경로 아래에서 **Bubble.io Data API**와 통신하는 프록시 역할을 합니다.

### 6.1 API 목록 및 역할

| API 경로 | 메서드 | 용도 | 요청 | 응답 |
|----------|--------|------|------|------|
| `/api/bubble/tour/[id]` | GET | 투어 상세 조회 | path: tourId (숫자) | `{ tour: {...} }` |
| `/api/bubble/spots/[tourId]` | GET | 투어별 스팟 목록 | path: tourId (숫자) | `{ spots: [...] }` |
| `/api/bubble/spot/[spotId]` | GET | 스팟 단일 조회 | path: spotId (숫자) | `{ spot: {...} }` |
| `/api/bubble/spot-poses` | GET | 전체 포즈 목록 | 없음 | `[...]` |
| `/api/bubble/spot-poses-by-spot/[spotId]` | GET | 스팟별 포즈 목록 | path: spotId, query: tourId?, persona? | `{ poses: [...] }` |
| `/api/bubble/personas/[tourId]/[spotId]` | GET | 페르소나 목록 | path: tourId, spotId | `{ personas: ["전체", ...] }` |
| `/api/bubble/categories` | GET | 포즈 카테고리 | 없음 | `[...]` |
| `/api/bubble/pose-reservation` | POST | **마스터 예약 생성** | `{ folder_Id, tour_Id, user_Id }` | `{ reservation_id, data }` |
| `/api/bubble/reserved-pose` | POST | **개별 포즈 등록** | `{ pose_reservation_id, selected_poses: [{spot_pose_id}] }` | `{ created_count, reserved_pose_ids }` |
| `/api/bubble/reservation/[id]` | GET | 예약 조회 | path: id | 예약 객체 |
| `/api/bubble/reservation/[id]` | PATCH | 예약 상태 변경 | `{ status }` | 업데이트 결과 |
| `/api/bubble/pose-reservation-by-folder` | GET | 폴더ID로 예약 조회 | query: folder_id | `{ has_reservation, reservation, pose_count, reserved_poses }` |
| `/api/bubble/cancel-reservation` | DELETE | **예약 취소** (하위 포즈 삭제 후 마스터 삭제) | `{ reservation_id }` | `{ deleted_poses, master_deleted }` |
| `/api/bubble/pose-guides/[reservationId]` | GET | 포즈 가이드 (촬영용) | path: reservationId | `[{reservedPoseId, spotPoseId, imageUrl}]` |
| `/api/bubble/auth-photo` | POST | **인증 사진 업로드** | `{ pose_reservation_id, auth_photo (base64) }` | `{ success, id }` |
| `/api/bubble/reviews` | GET | 리뷰 목록 | 없음 | `{ reviews, count }` |
| `/api/bubble/search-coupon` | GET | 쿠폰 검색 | query: tour_date, phone_4_digits | `{ found, data: {code, tour_Id} }` |

### 6.2 API 호출 패턴

```
클라이언트 (React)
    │
    ▼ fetch("/api/bubble/...")
Next.js API Route (서버 사이드)
    │
    ├── 환경변수에서 [HIDDEN_KEY] 로드
    ├── [HIDDEN_API] 로 요청 조립
    │
    ▼ fetch("[HIDDEN_API]/obj/...")
Bubble.io Data API
    │
    ▼ 응답
Next.js API Route
    │
    ├── 응답 가공 (필드 정규화, 에러 처리)
    │
    ▼ JSON 응답
클라이언트
```

> **핵심**: 클라이언트는 Bubble.io를 직접 호출하지 않습니다. 모든 요청은 `/api/bubble/` 프록시를 통해 이루어지며, API 토큰은 서버 사이드에서만 사용됩니다.

### 6.3 Java 백엔드 API (api-client.ts)

고객 인증 및 투어 관리는 별도의 Java 기반 백엔드 `[HIDDEN_API]`에서 처리합니다:

| 함수명 | 용도 |
|--------|------|
| `checkEmail(email)` | 이메일 존재 확인 |
| `sendVerificationCode(email)` | 이메일 인증코드 발송 |
| `verifyEmailCode(email, code)` | 인증코드 확인 |
| `checkNickname(nickname)` | 닉네임 중복 확인 |
| `signup(payload)` | 회원가입 |
| `uploadProfileImage(file, token)` | 프로필 이미지 업로드 |
| `getTermsPolicies(lang)` | 약관 목록 조회 |
| `submitAllTermsAgreements(agreements)` | 약관 동의 일괄 제출 |
| `getUserTours(userId, status)` | 사용자 투어 목록 (folder_id 포함) |

---

## 7. 핵심 소스코드 구조 (Code Architecture)

### 7.1 디렉토리 구조

```
AI/
├── app/
│   ├── page.tsx                    ← 랜딩 (Cheiz vs 포토그래퍼 선택)
│   ├── layout.tsx                  ← 루트 레이아웃 (HTML, 메타데이터)
│   ├── providers.tsx               ← GoogleOAuth + SessionProvider
│   ├── middleware.ts               ← 역할 기반 접근 제어
│   ├── globals.css                 ← 전역 스타일
│   │
│   ├── auth/                       ← 인증 관련
│   │   ├── signin/page.tsx         ← 로그인 (이메일/Google/Kakao)
│   │   ├── signup/page.tsx         ← 회원가입 (5단계)
│   │   └── error/page.tsx          ← 인증 에러
│   │
│   ├── cheiz/                      ← 고객 앱
│   │   ├── page.tsx                ← 홈 (히어로, 쿠폰, 리뷰)
│   │   ├── layout.tsx              ← 고객 네비게이션 바
│   │   ├── providers.tsx           ← SessionProvider
│   │   ├── my-tours/page.tsx       ← 내 투어 목록 + QR 표시
│   │   ├── booking/page.tsx        ← 간단 예약 폼 (레거시)
│   │   ├── coupons/page.tsx        ← 쿠폰 목록 (목업)
│   │   ├── mypage/page.tsx         ← 마이페이지 (플레이스홀더)
│   │   ├── pose-selector/page.tsx  ← 독립 포즈 선택기
│   │   └── reserve/
│   │       ├── page.tsx            ← 리다이렉트 전용
│   │       ├── spots/page.tsx      ← 스팟 목록 + 진행률 바
│   │       ├── poses/page.tsx      ← 포즈 선택 (페르소나 필터)
│   │       └── review/page.tsx     ← 최종 확인 + 예약 제출 + QR 생성
│   │
│   ├── photographer/               ← 포토그래퍼 앱
│   │   ├── page.tsx                ← PhotographerApp 쉘
│   │   └── scan/page.tsx           ← QR 소비 진입점
│   │
│   └── api/bubble/                 ← Bubble 프록시 API (16개 라우트)
│
├── components/
│   ├── PhotographerApp.tsx         ← 포토그래퍼 전체 플로우 + 이미지 압축
│   └── CameraScanner.tsx           ← 카메라 + QR 스캔 + 사진 캡처
│
├── lib/
│   ├── api-client.ts               ← Java 백엔드 API 클라이언트
│   ├── bubble-api.ts               ← Bubble.io API 클라이언트
│   ├── reservation-store.ts        ← Zustand 예약 상태 관리
│   └── validation-engine.ts        ← 포즈 선택 검증 로직
│
└── types/
    └── next-auth.d.ts              ← NextAuth 타입 확장
```

### 7.2 각 페이지의 핵심 역할

| 페이지 | 역할 요약 | 핵심 데이터 |
|--------|-----------|------------|
| **cheiz/page.tsx** | 서비스 홈. 히어로 섹션, 쿠폰 조회(날짜+전화번호4자리), 포즈 영감 슬라이더, 리뷰 그리드, CTA | reviews, spotPoses, couponResult |
| **cheiz/my-tours** | 투어 카드 목록. D-day, 포즈 예약 상태, QR 표시, 수정/취소 | tours(from Java), poseReservations(per folder) |
| **reserve/spots** | 스팟 카드 리스트. 진행률 바(선택/최대), 스팟별 검증 상태 | tour, spots, spotSelections(Store) |
| **reserve/poses** | 포즈 그리드. 페르소나 칩 필터, 선택 링, 최소/최대 검증 | poses, selectedPersona, Store actions |
| **reserve/review** | 선택 요약. 스팟별 포즈 썸네일, 제출 → QR 모달 | poseDetailsMap, reservationId, qrCodeUrl |
| **photographer/page** | PhotographerApp 감싸기 (Suspense) | - |
| **photographer/scan** | QR에서 들어올 때 reservation_id 전달 | reservation_id (URL param) |

---

## 8. 컴포넌트 역할 및 Props

### 8.1 CameraScanner

카메라 뷰파인더 + QR 스캔 + 사진 캡처 통합 컴포넌트입니다.

| Prop | 타입 | 설명 |
|------|------|------|
| `mode` | `"scan" \| "auth"` | 스캔 모드: QR 인식 / 인증 사진 캡처 |
| `scanMode` | `"qr" \| "manual"` | QR 스캔 or 수동 ID 입력 |
| `onScanModeChange` | `(mode) => void` | 스캔 모드 전환 콜백 |
| `onQRSuccess` | `(reservationId, rawUrl) => void` | QR 인식 성공 콜백 |
| `onManualCapture` | `(reservationId, imageDataUrl) => void` | 수동 캡처 콜백 |
| `onAuthCapture` | `(imageDataUrl) => void` | 인증 사진 캡처 콜백 |
| `statusText` | `string` | 상태 텍스트 오버레이 |
| `sessionCount` | `number` | 세션 카운트 표시 |
| `showPortraitGuide` | `boolean` | 인물 가이드 오버레이 표시 |
| `children` | `ReactNode` | 오버레이 추가 UI |

**카메라 해상도**:
- 인증 모드: 1080 × 1440 (세로형)
- 스캔 모드: 1920 × 1080 (가로형)

**QR 디코딩 전략**:
1. `BarcodeDetector` API (네이티브, 성능 우수)
2. `jsQR` 라이브러리 (폴백, ~20fps)

### 8.2 PhotographerApp

포토그래퍼의 전체 워크플로우를 관리하는 SPA 스타일 컴포넌트입니다.

**내부 페이지 관리**: URL 쿼리 `page` 파라미터로 상태 전환
- `scan` → `auth` → `shoot` → `complete` → `scan`

**이미지 압축 로직** (`compressImage` 함수):
```
입력: Data URL (카메라 캡처 원본)
  ↓
1. Image 객체로 디코딩
  ↓
2. 최대 너비 2000px로 리사이즈
  ↓
3. Canvas에 그린 후 JPEG 변환 (초기 quality: 0.7)
  ↓
4. base64 크기 확인 (3MB × 1.37 = ~4.11MB 한계)
  ↓
5. 3MB 초과 시 quality를 0.1씩 감소시키며 재시도
  ↓
출력: 3MB 이하의 base64 JPEG 문자열
```

**API 호출 순서**:
1. `POST /api/bubble/auth-photo` (압축된 base64 이미지)
2. `GET /api/bubble/pose-guides/[reservationId]` (포즈 가이드 목록)
3. `PATCH /api/bubble/reservation/[id]` (상태 → "Completed")

---

## 9. 상태 관리 (State Management)

### 9.1 Zustand Store (reservation-store)

예약 플로우 전체를 관통하는 핵심 상태 저장소입니다.

| Action | 용도 | 사용 화면 |
|--------|------|----------|
| `setTourId(id)` | 투어 설정 | my-tours |
| `setTour(tour)` | 투어 상세 저장 | spots |
| `setSpots(spots)` | 스팟 목록 저장 | spots |
| `setFolderId(id)` | 폴더 ID 설정 | my-tours |
| `setEditMode(mode, id?, poseIds?)` | 수정 모드 진입 | my-tours |
| `initializeSpotSelection(spotId, name, minCount)` | 스팟 선택 초기화 | poses |
| `addPose(spotId, poseId)` | 포즈 추가 | poses |
| `removePose(spotId, poseId)` | 포즈 제거 | poses |
| `isPoseSelected(spotId, poseId)` | 선택 여부 확인 | poses |
| `getTotalSelectedCount()` | 전체 선택 수 | spots, poses, review |
| `getSpotSelectedCount(spotId)` | 스팟별 선택 수 | poses |
| `clearSelections()` | 선택만 초기화 | my-tours (취소 시) |
| `clearAll()` | 모든 상태 초기화 | review (완료 후) |

### 9.2 검증 엔진 (validation-engine)

포즈 선택의 유효성을 실시간으로 검증합니다.

**검증 규칙**:
1. **글로벌 최대**: 전체 선택 수 ≤ `maxTotal` (투어의 max_total_poses)
2. **스팟별 최소**: 각 스팟에서 0개(미선택) 또는 ≥ `min_count_limit`개
3. **글로벌 최소**: 전체 선택 수 ≥ `minTotal` (투어의 min_total_poses)

**반환 구조**:
```
ValidationResult {
  isValid: boolean           // 모든 규칙 충족 여부
  canAddMore: boolean        // 추가 선택 가능 여부
  globalProgress: string     // "3/10" 형식
  spotValidations: Map<spotId, {
    status: "empty" | "incomplete" | "complete"
    message: string
  }>
  finalButtonEnabled: boolean   // "예약하기" 버튼 활성화
  finalButtonMessage: string    // 버튼 옆 안내 메시지
}
```

### 9.3 세션 관리

| 저장소 | 키 | 용도 |
|--------|-----|------|
| `localStorage` | `cheiz-reservation-storage` | Zustand 예약 상태 영속화 |
| `localStorage` | `chiiz_last_camera_deviceId` | 포토그래퍼 마지막 카메라 ID |
| `localStorage` | `chiiz_session_count` | 포토그래퍼 세션 카운트 |
| `sessionStorage` | `auth_token` | 인증 토큰 (NextAuth 세션 대안) |

---

## 10. UX/UI 제약 사항

### 10.1 반드시 유지해야 하는 기술적 제약

| 제약 | 이유 | 영향 범위 |
|------|------|----------|
| **인증 사진 3MB 이하 압축** | Bubble.io Data API의 base64 업로드 제한, 서버 액션 10MB 바디 제한 | 포토그래퍼 앱 (인증 사진 촬영) |
| **QR 코드 300×300px, 하늘색 배경** | 야외 촬영 환경에서의 가시성 확보 | QR 표시 모달 (고객), QR 스캔 (포토그래퍼) |
| **모바일 우선 (Mobile-First)** | 주 사용 환경이 야외 모바일 기기 | 전체 고객/포토그래퍼 앱 |
| **카메라 전체화면 (포토그래퍼)** | 야외에서 빠른 스캔/촬영을 위한 몰입형 UI | PhotographerApp, CameraScanner |
| **localStorage 기반 상태 영속성** | 예약 도중 이탈/새로고침 시 데이터 보존 | 전체 예약 플로우 |
| **포즈 선택 최소/최대 검증** | 비즈니스 로직 - 투어별 포즈 수 제한 | reserve/poses, reserve/review |
| **수정 시 기존 예약 삭제 후 재생성** | Bubble.io에서 부분 수정이 불가하여 DELETE → CREATE 방식 | reserve/review (수정 모드) |
| **QR에 reservation_id만 인코딩** | 오프라인에서도 작동 가능하도록 최소한의 데이터만 QR에 포함 | QR 생성/소비 전 과정 |

### 10.2 모바일 야외 가시성 고려 사항

| 요소 | 현재 구현 | 디자인 변경 시 주의점 |
|------|----------|---------------------|
| **QR 배경색** | 하늘색 (#87CEEB) | 햇빛 아래에서 식별 가능한 고대비 유지 필요 |
| **포토그래퍼 앱 배경** | 검정 (#000) | 카메라 뷰파인더 주변을 어둡게 하여 피사체 집중 |
| **카메라 컨트롤** | 네이티브 컨트롤 숨김 (CSS) | 최소한의 커스텀 UI로 빠른 조작 보장 |
| **터치 하이라이트** | 비활성화 (`-webkit-tap-highlight-color: transparent`) | 의도치 않은 하이라이트 방지 |
| **포토그래퍼 레이아웃** | `position: fixed, overflow: hidden` | 스크롤 없는 전체 화면 고정 레이아웃 |

### 10.3 인증 관련 제약

| 제약 | 설명 |
|------|------|
| **회원가입 5단계** | 약관동의 → 이메일인증 → 비밀번호 → 닉네임 → 프로필(선택). 단계 건너뛰기 불가 |
| **이메일 인증 재발송 제한** | 최대 횟수 제한 + 쿨다운 타이머 |
| **비밀번호 강도 표시** | 실시간 강도 측정 UI 필요 |
| **OAuth 로그인** | Google (ID Token 방식), Kakao (리다이렉트 방식) |
| **역할별 접근 제어** | middleware에서 처리, 디자인에서는 역할에 따른 메뉴/CTA 분기 필요 |

### 10.4 현재 미완성/목업 상태인 기능

| 기능 | 상태 | 참고 |
|------|------|------|
| `/cheiz/coupons` | 목업 데이터 (실제 API 미연결) | 쿠폰 목록 화면 |
| `/cheiz/mypage` | 플레이스홀더 (예약 목록 TODO) | 마이페이지 |
| `/cheiz/pose-selector` | 선택 완료 시 동작 없음 (TODO) | 독립 포즈 선택기 |
| `/cheiz/booking` | 레거시 폼 | 메인 플로우에서 사용하지 않음 |

---

## 11. 화면별 상세 명세

### 11.1 랜딩 페이지 (`/`)

**목적**: 서비스 진입점. Cheiz 고객 앱과 포토그래퍼 앱 분기.

**UI 요소**:
- 두 개의 링크 카드: "Cheiz 메인" / "포토그래퍼 앱"

**상태**: 없음 (정적)

---

### 11.2 로그인 (`/auth/signin`)

**목적**: 이메일/비밀번호, Google, Kakao 로그인

**UI 요소 & 흐름**:
- **Phase 1 (이메일 입력)**: 이메일 필드 → 이메일 존재 확인 API → 있으면 Phase 2, 없으면 회원가입으로 안내
- **Phase 2 (비밀번호 입력)**: 비밀번호 필드 → 로그인 시도 → 성공 시 callbackUrl로 이동
- **소셜 로그인**: Kakao (리다이렉트), Google (ID Token)
- **에러 처리**: 토스트 스타일 에러 메시지
- **화면 전환**: AnimatePresence 애니메이션

---

### 11.3 회원가입 (`/auth/signup`)

**목적**: 5단계 회원가입

**단계별 UI**:

| 단계 | 화면 요소 | 핵심 로직 |
|------|----------|----------|
| 1. 약관 동의 | 필수/선택 약관 체크박스, "보기" 링크 | 약관 목록 API 조회, 필수 전체 동의 시 진행 |
| 2. 이메일 인증 | 6자리 인증코드 입력 (자동 제출) | 인증코드 발송/확인 API, 재발송 쿨다운 |
| 3. 비밀번호 | 비밀번호 + 확인 필드, 강도 표시 | 실시간 강도 측정, 일치 확인 |
| 4. 닉네임 | 닉네임 필드 + 중복 확인 | 닉네임 중복 API |
| 5. 프로필 | 프로필 이미지 업로드 (선택) | 이미지 파일 선택 → 미리보기 |

**최종 제출**: signup API → 성공 시 자동 로그인 → 메인으로 이동

---

### 11.4 Cheiz 홈 (`/cheiz`)

**목적**: 서비스 홈. 히어로, 쿠폰 조회, 포즈 영감, 리뷰

**UI 섹션**:
1. **히어로**: 서비스 소개 + CTA
2. **3개 액션 카드**: 쿠폰 조회 / 인생샷 가이드 / 1:1 문의(카카오)
3. **포즈 영감 슬라이더**: 전체 SpotPose에서 이미지 랜덤 표시
4. **리뷰 그리드**: 서비스 리뷰 목록
5. **CTA**: 로그인/비로그인 분기

**쿠폰 조회 모달**:
- 입력: 투어 날짜 (date picker) + 전화번호 뒷자리 4자리
- 조회 → 쿠폰 코드 표시 + 복사 기능

**데이터 로딩**: 페이지 마운트 시 reviews, spotPoses 동시 fetch

---

### 11.5 마이 투어 (`/cheiz/my-tours`)

**목적**: 예약된 투어 목록, 포즈 예약 상태, QR 관리

**UI 요소**:
- **브레드크럼**: 홈 ← 마이페이지
- **투어 카드**: 썸네일, D-day, 날짜, 호스트, 포즈 예약 상태
- **카드별 액션 버튼**:
  - 포즈 미예약: "포즈 예약하기" → spots 이동
  - 포즈 예약됨: "QR코드 표시하기", "포즈 수정", "예약 취소"
- **QR 모달**: QR 이미지 + reservation_id 표시

**데이터 흐름**:
1. `getUserTours(userId, "RESERVED")` → 투어 목록
2. 각 투어의 `folder_id`로 `pose-reservation-by-folder` 조회 → 포즈 예약 상태
3. QR 표시: `reservation_id`로 QR 이미지 생성

---

### 11.6 스팟 선택 (`/cheiz/reserve/spots`)

**목적**: 투어에 포함된 스팟(촬영 장소) 목록, 포즈 선택 진행률

**UI 요소**:
- **프로그레스 바**: `선택된 포즈 수 / 최대 포즈 수`
- **스팟 카드**: 썸네일, 이름, 검증 상태(아이콘/카운트)
- **하단 고정 버튼**: "선택 내역 확인하기" (folderId 있고 검증 통과 시 활성)

**쿼리 파라미터**: `tour_id`, `folder_id`, `mode=edit` (수정 모드)

**수정 모드**: 기존 선택된 포즈를 Store에서 복원하여 스팟 카드에 반영

---

### 11.7 포즈 선택 (`/cheiz/reserve/poses`)

**목적**: 특정 스팟의 포즈 그리드에서 포즈를 선택/해제

**UI 요소**:
- **브레드크럼**: ← 스팟 선택 | 포즈 선택
- **페르소나 필터 칩**: "전체", "1인", "커플", "단체" 등 (동적 로드)
- **포즈 그리드**: 이미지 카드, 선택 시 링(ring) 효과
- **하단 고정 바**: 이 스팟 선택 수, 전체 선택/최소 진행률, "스팟 선택으로 돌아가기"

**선택 로직**:
- 터치/클릭 → `addPose()` 또는 `removePose()` (토글)
- 글로벌 최대 초과 시 추가 불가
- 스팟별 최소 미만으로 내려갈 수 없음 (0으로 리셋만 가능)

**쿼리 파라미터**: `tour_id`, `spot_id`, `folder_id`

---

### 11.8 최종 확인 & 예약 (`/cheiz/reserve/review`)

**목적**: 선택 요약 표시, 최종 제출, QR 생성

**UI 요소**:
- **스팟별 요약**: 스팟 이름, 선택 수, 포즈 썸네일 그리드
- **이미지 라이트박스**: 포즈 이미지 터치 → 확대 보기
- **검증 메시지**: 최소 미달 시 경고
- **하단 고정 버튼**: "포즈 예약하기" (검증 통과 시 활성)
- **성공 모달**: QR 코드 이미지, reservation_id, "마이페이지로" / "홈으로" 버튼

**제출 흐름**:
```
"포즈 예약하기" 클릭
    ↓
[수정 모드?] → 기존 예약 DELETE
    ↓
POST /pose-reservation (마스터 생성)
    ↓ reservation_id 수신
POST /reserved-pose (개별 포즈 등록)
    ↓ 성공
QR 코드 생성 (클라이언트)
    ↓
성공 모달 표시
    ↓
clearAll() → Store 초기화
```

---

### 11.9 포토그래퍼 앱 (`/photographer`)

**목적**: 현장 촬영 워크플로우 (단일 페이지 앱)

**내부 화면**:

| 페이지 | UI 요소 | 핵심 기능 |
|--------|---------|----------|
| **scan** | 전체화면 카메라 + QR 오버레이 + 수동 전환 | QR 디코딩 → reservation_id 추출 |
| **auth** | 전체화면 카메라 + 인물 가이드 오버레이 + 캡처 버튼 | 인증 사진 촬영 → 3MB 압축 → 업로드 |
| **shoot** | 포즈 가이드 리스트 (이미지 + 정보) + "촬영 완료" | 가이드 확인, 완료 시 상태 변경 |
| **complete** | 완료 메시지 → 자동으로 scan 복귀 | 세션 카운트 증가 |

**이미지 압축 제약**:
- 최대 너비: 2000px
- 초기 JPEG quality: 0.7
- 목표 크기: 3MB 이하 (base64 기준 ~4.11MB)
- 초과 시: quality를 0.1씩 감소시켜 반복 압축

**카메라 설정**:
- 인증 모드: 1080×1440 (세로)
- 스캔 모드: 1920×1080 (가로)
- 이전 카메라 ID `localStorage`에 저장하여 재접속 시 자동 선택

---

## 부록: 데이터 모델 (추상화)

### 핵심 엔티티 관계

```
Tour (투어)
 ├── 1:N → Spot (촬영 스팟/장소)
 │           └── 1:N → SpotPose (스팟별 포즈)
 │                       ├── persona (페르소나: 1인, 커플 등)
 │                       └── image_url (포즈 가이드 이미지)
 │
 ├── min_total_poses (최소 선택 포즈 수)
 ├── max_total_poses (최대 선택 포즈 수)
 │
 └── folder_id (Java 백엔드 투어 폴더 ID)

PoseReservation (포즈 예약 - 마스터)
 ├── folder_Id → 연결된 투어 폴더
 ├── tour_Id → 연결된 투어
 ├── user_Id → 예약자
 ├── status → "pending" | "Completed"
 ├── auth_photo → 인증 사진 (base64)
 │
 └── 1:N → ReservedPose (예약된 개별 포즈)
              └── spot_pose_Id → 선택된 SpotPose
```

### QR 코드 ↔ 데이터 매핑

```
QR Code
  └── reservation_id (PoseReservation의 유니크 ID)
       │
       ├── → PoseReservation (마스터 정보)
       │      ├── folder_Id, tour_Id, user_Id
       │      └── auth_photo, status
       │
       └── → ReservedPose[] (선택된 포즈들)
              └── spot_pose_Id → SpotPose (이미지, 설명 등)
```

---

> **이 문서를 통해 Kimi가 파악해야 할 핵심:**
>
> 1. 고객은 `투어 → 스팟 → 포즈` 계층 구조에서 포즈를 큐레이션합니다.
> 2. 예약 완료 시 **QR 코드**가 생성되며, 이것이 현장 촬영의 유일한 식별자입니다.
> 3. 포토그래퍼는 QR 스캔 한 번으로 해당 고객의 모든 포즈 가이드에 접근합니다.
> 4. 상태는 Zustand + localStorage로 관리되어 중간 이탈에도 데이터가 보존됩니다.
> 5. 이미지 압축(3MB)과 야외 가시성은 변경 불가능한 기술적 제약입니다.
> 6. 수정 시 QR 코드가 바뀌므로, 이에 대한 UX 안내가 필수입니다.
