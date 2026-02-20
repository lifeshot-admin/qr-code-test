# Cheiz 결제 & 예약 API 연동 명세서

> **대상**: 프론트엔드 개발자  
> **범위**: `[결제하기]` 버튼 클릭 이후의 모든 API 플로우  
> **기준일**: 2026-02-19

---

## 전체 플로우 요약

### 페이지 1: 투어 예약 결제 (`/cheiz/reserve/checkout?tour_id={id}`)

```
┌─────────────────────────────────────────────────────────────────┐
│  [결제하기] 버튼 클릭                                            │
│  └─ finalAmount 확인                                            │
│      │                                                          │
│      ├── 0원 (크레딧 전액) ──── performFreeReservation() ───┐   │
│      │   ① POST /api/backend/create-folder     (Java 폴더) │   │
│      │   ② POST /api/bubble/pose-reservation   (Bubble 예약)│   │
│      │   ③ POST /api/bubble/reserved-pose      (포즈 저장)  │   │
│      │   → /cheiz/reserve/success 이동                      │   │
│      │      ④ QR 코드 생성 (클라이언트)                      │   │
│      │      ⑤ POST /api/bubble/notifications   (알림 생성)   │   │
│      │                                                      │   │
│      └── 유료 ──────────────────────────────────────────┐   │   │
│          ① POST /api/stripe/create-checkout (Stripe 세션)│  │   │
│          → Stripe 결제 페이지 리다이렉트                  │  │   │
│          → /cheiz/reserve/checkout/success 복귀          │  │   │
│             ② POST /api/backend/create-folder            │  │   │
│             ③ POST /api/bubble/pose-reservation          │  │   │
│             ④ POST /api/bubble/reserved-pose             │  │   │
│             ⑤ QR 코드 생성 (클라이언트)                   │  │   │
│             ⑥ POST /api/bubble/notifications             │  │   │
└─────────────────────────────────────────────────────────────────┘
```

### 페이지 2: 사진 구매/리딤 (`/cheiz/folder/{folderId}/redeem`)

```
┌─────────────────────────────────────────────────────────────────┐
│  [결제하기] 버튼 클릭                                            │
│  │                                                              │
│  ├── Step A: POST /api/backend/orders          (주문서 생성)     │
│  │   └─ orderId + totalPayment 반환                             │
│  │                                                              │
│  ├── 0원 (크레딧 전액) ─────────────────────────────────┐       │
│  │   Step B: POST /api/backend/payments/complete       │       │
│  │   → 인라인 성공 화면 (앨범 자동 생성됨)               │       │
│  │                                                     │       │
│  └── 유료 ──────────────────────────────────────────┐  │       │
│      Step B: POST /api/backend/payments/checkout    │  │       │
│      → Stripe 결제 페이지 리다이렉트                 │  │       │
│      → redeem 페이지 복귀 (?checkout_success=true)  │  │       │
│         Step C: POST /api/backend/payments/verify-checkout      │
│         → 인라인 성공 화면 (앨범 자동 생성됨)                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 페이지 1 상세: 투어 예약 결제

> **소스 파일**: `app/cheiz/reserve/checkout/page.tsx`  
> **결제 분기 기준**: `finalAmount === 0` → 0원 경로, `finalAmount > 0` → Stripe 유료 경로

---

### API 1-1. Stripe Checkout 세션 생성 (유료 경로)

| 항목 | 내용 |
|------|------|
| **호출 시점** | `[결제하기]` 클릭 + `finalAmount > 0` |
| **Method** | `POST` |
| **프론트 Endpoint** | `/api/stripe/create-checkout` |
| **Java 백엔드** | 호출 없음 — Stripe SDK 직접 사용 (서버사이드) |

#### Request Body

| 필드명 | 타입 | 필수 | 설명 | 예시 |
|--------|------|------|------|------|
| `aiRetouching` | `boolean` | O | AI 보정 선택 여부 | `true` |
| `tourId` | `string \| number` | O | 투어 ID | `29` |
| `tourName` | `string` | O | 투어 이름 (Stripe 상품명에 사용) | `"교토 아라시야마 투어"` |
| `poseCount` | `number` | O | 선택한 포즈 수 | `4` |
| `folderId` | `string \| number \| null` | X | 기존 폴더 ID (없으면 null) | `null` |
| `totalAmount` | `number` | O | 총 결제 금액 (KRW, 크레딧 적용 후) | `4980` |
| `appliedCredits` | `object` | O | 적용된 크레딧 내역 | `{ aiCredits: 2 }` |

#### Response

| 필드명 | 타입 | 설명 |
|--------|------|------|
| `url` | `string` | Stripe Checkout 결제 페이지 URL |
| `sessionId` | `string` | Stripe Session ID |
| `skipPayment` | `boolean` | 서버에서 0원 판정 시 `true` (line_items 없을 때) |

#### 분기 처리

| 조건 | 동작 |
|------|------|
| `data.url` 존재 | `window.location.href = data.url` → Stripe 결제 페이지 이동 |
| `data.skipPayment === true` | `performFreeReservation()` 실행 (0원 경로와 동일) |
| 그 외 | 모달: `"결제 세션 생성에 실패했습니다."` + 카카오 문의 링크 |

#### Stripe 리다이렉트 URL

| 결과 | URL 패턴 |
|------|----------|
| 성공 | `/cheiz/reserve/success?session_id={CHECKOUT_SESSION_ID}&tour_id={tourId}&folder_id={folderId}` |
| 취소 | `/cheiz/reserve/checkout?tour_id={tourId}&folder_id={folderId}&cancelled=true` |

---

### API 1-2. Java 폴더 생성 (Step 0)

| 항목 | 내용 |
|------|------|
| **호출 시점** | 0원: `performFreeReservation()` 내 즉시 / 유료: Success 페이지 `useEffect` 자동 실행 |
| **Method** | `POST` |
| **프론트 Endpoint** | `/api/backend/create-folder` |
| **Java 백엔드** | `POST /api/v1/folders?scheduleId={}&name={}&hostUserId={}&personCount={}` |
| **Java Content-Type** | `multipart/form-data` (photos 필드 빈값) |

> **주의**: Java 백엔드에는 파라미터가 **Query String**으로 전달됩니다. Request Body가 아닙니다.

#### Request Body (프론트 → Next.js 프록시)

| 필드명 | 타입 | 필수 | 설명 | 예시 |
|--------|------|------|------|------|
| `scheduleId` | `string \| number` | O | 스케줄 ID (store에서 우선, 없으면 tourId fallback) | `29` |
| `name` | `string` | O | 예약명 (투어 제목 사용) | `"교토 아라시야마 투어"` |
| `hostUserId` | `string \| number` | O | 방장 유저 ID (세션에서 추출) | `12345` |
| `personCount` | `number` | O | 인원 수 | `2` |

#### Response

| 필드명 | 타입 | 설명 |
|--------|------|------|
| `success` | `boolean` | 성공 여부 |
| `folderId` | `number \| null` | 생성된 폴더 ID |
| `raw` | `object` | Java 백엔드 원본 응답 |

#### 에러 처리

| HTTP 코드 | 의미 | 프론트 처리 |
|-----------|------|------------|
| `200` | 성공 | `folderId` 저장 → Step 1 진행 |
| `401` | 인증 만료 | 토큰 갱신 자동 재시도 → 실패 시 재로그인 안내 |
| `409` | 중복 예약 | `"이미 예약된 스케줄이 있습니다."` 에러 throw |
| 기타 | 서버 오류 | `"백엔드 예약 폴더 생성 실패 (HTTP {status})"` 에러 throw |

#### 401 토큰 갱신 로직
프록시 라우트 내부에서 401 발생 시 `POST /api/v1/auth/token/refresh`를 호출하여 새 accessToken을 확보하고 자동 재시도합니다.

---

### API 1-3. Bubble 예약(pose_reservation) 생성 (Step 1)

| 항목 | 내용 |
|------|------|
| **호출 시점** | 폴더 생성 성공 직후 |
| **Method** | `POST` |
| **프론트 Endpoint** | `/api/bubble/pose-reservation` |
| **Bubble 테이블** | `pose_reservation` |

#### Request Body

| 필드명 | 타입 | 필수 | 설명 | 예시 |
|--------|------|------|------|------|
| `folder_Id` | `number` | O | Java에서 생성된 폴더 ID | `11796` |
| `tour_Id` | `string \| number` | O | 투어 ID | `29` |
| `user_Id` | `string \| number` | O | 유저 ID | `12345` |
| `user_nickname` | `string` | O | 유저 닉네임 | `"치이즈"` |
| `persona` | `string` | X | 페르소나 JSON (0원 경로만) | `'{"count":2,"category":"couple"}'` |

#### Response

| 필드명 | 타입 | 설명 |
|--------|------|------|
| `success` | `boolean` | 성공 여부 |
| `reservation_id` | `string` | Bubble 예약 레코드 `_id` |
| `reservation_code` | `string` | 예약 코드 (6자리 숫자) |

#### 후속 처리

| 조건 | 동작 |
|------|------|
| 성공 | `reservation_id` 저장 → Step 2 진행 |
| 실패 | 에러 throw (전체 플로우 중단) |

---

### API 1-4. Bubble 포즈 저장(reserved_pose) (Step 2)

| 항목 | 내용 |
|------|------|
| **호출 시점** | pose_reservation 생성 성공 직후 (선택 포즈 ≥ 1개) |
| **Method** | `POST` |
| **프론트 Endpoint** | `/api/bubble/reserved-pose` |
| **Bubble 테이블** | `reserved_pose` |

#### Request Body

| 필드명 | 타입 | 필수 | 설명 | 예시 |
|--------|------|------|------|------|
| `pose_reservation_id` | `string` | O | Bubble pose_reservation `_id` | `"1723456789x0"` |
| `selected_poses` | `array` | O | 선택된 포즈 배열 | 아래 참조 |

#### `selected_poses[]` 아이템

| 필드명 | 타입 | 설명 | 예시 |
|--------|------|------|------|
| `spot_pose_id` | `string` | 포즈 ID (Bubble `_id`) | `"pose_abc123"` |
| `spot_id` | `number` | 스팟 ID | `42` |
| `spot_name` | `string` | 스팟 이름 | `"아라시야마 대나무숲"` |

#### 후속 처리

| 조건 | 동작 |
|------|------|
| 포즈 ≥ 1개 & 성공 | QR 생성 → Step 3 진행 |
| 포즈 0개 | 스킵 (QR 생성으로 진행) |
| 실패 | 에러 throw |

---

### Step 3 & 4: QR 코드 생성 + 알림

#### QR 코드 (클라이언트 생성)

| 항목 | 내용 |
|------|------|
| **라이브러리** | `qrcode` (npm) |
| **데이터** | `{origin}/photographer/scan?reservation_id={bubbleReservationId}` |
| **옵션** | `width: 280, margin: 2, color: { dark: "var(--cheiz-primary)", light: "#FFFFFF" }` |

#### API 1-5. Bubble 알림 생성 (Step 5)

| 항목 | 내용 |
|------|------|
| **호출 시점** | QR 코드 생성 완료 직후 |
| **Method** | `POST` |
| **프론트 Endpoint** | `/api/bubble/notifications` |
| **Bubble 테이블** | `notification` |

#### Request Body

**0원 경로 (reserve/success 페이지):**

| 필드명 | 타입 | 필수 | 예시 |
|--------|------|------|------|
| `user_Id` | `number` | O | `12345` |
| `type` | `string` | O | `"BOOKING_COMPLETE"` |
| `title` | `string` | O | `"예약이 완료되었습니다"` |
| `body` | `string` | O | `"교토 아라시야마 투어"` (투어명) |
| `link_id` | `number \| null` | X | `11796` (folderId) |
| `is_read` | `boolean` | O | `false` |

**유료 경로 (checkout/success 페이지):**

| 필드명 | 타입 | 필수 | 예시 |
|--------|------|------|------|
| `user_Id` | `number` | O | `12345` |
| `type` | `string` | O | `"PAYMENT_COMPLETE"` |
| `title` | `string` | O | `"결제가 완료되었습니다"` |
| `body` | `string` | O | `"교토 아라시야마 투어"` |
| `link_id` | `number \| null` | X | `11796` (folderId) |
| `is_read` | `boolean` | O | `false` |

> **실패 처리**: `console.warn`만 기록. 알림 실패는 전체 플로우를 중단시키지 않습니다 (비치명적).

---

### Edit Mode 부록 (기존 예약 수정 시)

폴더 생성과 Step 1 사이에 기존 예약을 취소하는 API가 추가됩니다.

| 항목 | 내용 |
|------|------|
| **조건** | `editMode === true && existingReservationId` 존재 |
| **Method** | `PATCH` |
| **Endpoint** | `/api/bubble/cancel-reservation` |
| **Request** | `{ reservation_id: string }` |
| **실패 시** | `console.warn`만 (새 예약은 계속 진행) |

---

## 페이지 2 상세: 사진 구매/리딤

> **소스 파일**: `app/cheiz/folder/[folderId]/redeem/page.tsx`  
> **URL 파라미터**: `photos` (원본 사진 ID 목록), `retouchPhotos` (리터치 사진 ID), `retoucherId`  
> **결제 분기 기준**: `actualPayment <= 0` → 0원, `actualPayment > 0` → Stripe

---

### API 2-1. 사진 주문서 생성 (Step A)

| 항목 | 내용 |
|------|------|
| **호출 시점** | `[결제하기]` 클릭 즉시 (가장 먼저 호출) |
| **Method** | `POST` |
| **프론트 Endpoint** | `/api/backend/orders` |
| **Java 백엔드** | `POST /api/v1/orders/photo` |

#### Request Body

| 필드명 | 타입 | 필수 | 설명 | 예시 |
|--------|------|------|------|------|
| `folderId` | `number` | O | 폴더 ID (URL params에서) | `11796` |
| `rawPhotoIds` | `number[]` | O | 구매할 원본 사진 ID 배열 | `[273897, 273896, 273895]` |
| `detailPhotoIds` | `number[]` | O | 리터치할 사진 ID 배열 (없으면 `[]`) | `[]` |
| `colorPhotoIds` | `number[]` | O | 컬러 보정 사진 ID (미사용, `[]`) | `[]` |
| `issuedCouponIds` | `number[]` | O | 사용할 쿠폰 ID (현재 `[]`) | `[]` |
| `retoucherId` | `number \| null` | X | 리터처 ID (리터치 없으면 null) | `null` |
| `credit` | `object \| undefined` | X | 크레딧 사용량 | `{ "PHOTO": 3 }` |

#### `credit` 객체

| 키 | 타입 | 설명 | 예시 |
|----|------|------|------|
| `PHOTO` | `number` | 사진 다운로드 크레딧 사용량 | `3` |
| `RETOUCH` | `number` | 리터치 크레딧 사용량 | `0` |

> 크레딧 값이 0이면 해당 키를 포함하지 않습니다.

#### Response

| 필드명 | 타입 | 설명 |
|--------|------|------|
| `success` | `boolean` | 성공 여부 |
| `orderId` | `number` | 생성된 주문 ID |
| `totalPayment` | `number \| null` | 백엔드 계산 결제 금액 (원) |
| `data` | `object` | Java 백엔드 원본 응답 데이터 |

#### 금액 결정 로직 (프론트 가드)

```
creditCoversAll = (photoCreditsUse >= N) && (M === 0 || retouchCreditsUse >= M)
actualPayment = creditCoversAll ? 0 : (backendPayment ?? totalFinal)
```

> **중요**: 프론트의 크레딧 커버 판정이 백엔드 `totalPayment`보다 우선합니다.

#### 에러 처리

| 조건 | 동작 |
|------|------|
| 성공 | `orderId` 저장 → 0원/유료 분기 |
| 실패 | `"주문 생성에 실패했습니다. 잠시 후 다시 시도해 주세요."` 에러 표시 |

---

### API 2-2. 0원 결제 완료 (Step B — 크레딧 전액)

| 항목 | 내용 |
|------|------|
| **호출 시점** | 주문서 생성 성공 + `actualPayment <= 0` |
| **Method** | `POST` |
| **프론트 Endpoint** | `/api/backend/payments/complete` |
| **Java 백엔드** | `POST /api/v1/payments/photo/{photoOrderId}` |

> **핵심**: 이 API 호출이 Java 백엔드에서 **앨범 자동 생성**을 트리거합니다.

#### Request Body

| 필드명 | 타입 | 필수 | 설명 | 예시 |
|--------|------|------|------|------|
| `photoOrderId` | `number` | O | Step A에서 받은 주문 ID | `5678` |

#### Response

| 필드명 | 타입 | 설명 |
|--------|------|------|
| `success` | `boolean` | 성공 여부 |
| `orderId` | `number` | 주문 ID (echo) |
| `data` | `object \| undefined` | 백엔드 추가 데이터 |

#### 후속 처리

| 조건 | 동작 |
|------|------|
| 성공 | 인라인 성공 화면 표시 (주문번호, 원본 N장 + 리터치 M장, 결제금액 ₩0) |
| 실패 | `"크레딧 결제 처리에 실패했습니다. 잠시 후 다시 시도해 주세요."` 에러 표시 |

---

### API 2-3. Stripe Checkout 생성 (Step B — 유료)

| 항목 | 내용 |
|------|------|
| **호출 시점** | 주문서 생성 성공 + `actualPayment > 0` |
| **Method** | `POST` |
| **프론트 Endpoint** | `/api/backend/payments/checkout` |
| **백엔드** | Stripe SDK 직접 사용 (서버사이드) |

#### Request Body

| 필드명 | 타입 | 필수 | 설명 | 예시 |
|--------|------|------|------|------|
| `photoOrderId` | `number` | O | 주문 ID | `5678` |
| `amount` | `number` | O | 결제 금액 (KRW) | `3000` |
| `folderId` | `string` | O | 폴더 ID | `"11796"` |
| `n` | `number` | O | 원본 사진 수 | `3` |
| `m` | `number` | O | 리터치 사진 수 | `0` |
| `origin` | `string` | O | 현재 도메인 (리다이렉트용) | `"http://localhost:3000"` |

#### Response

| 필드명 | 타입 | 설명 |
|--------|------|------|
| `success` | `boolean` | 성공 여부 |
| `url` | `string` | Stripe Checkout URL |
| `sessionId` | `string` | Stripe Session ID |

#### Stripe 리다이렉트 URL

| 결과 | URL 패턴 |
|------|----------|
| 성공 | `/cheiz/folder/{folderId}/redeem?checkout_success=true&session_id={CHECKOUT_SESSION_ID}&orderId={id}&n={n}&m={m}&paid={amount}` |
| 취소 | `/cheiz/folder/{folderId}/redeem?checkout_cancelled=true&orderId={id}&n={n}&m={m}` |

#### Stripe Metadata (검증용)

```json
{
  "photoOrderId": "5678",
  "folderId": "11796"
}
```

---

### API 2-4. Stripe 결제 검증 (Step C)

| 항목 | 내용 |
|------|------|
| **호출 시점** | Stripe 결제 후 redeem 페이지 복귀 (`?checkout_success=true&session_id=...`) |
| **트리거** | `useEffect` — URL 파라미터 감지 시 자동 실행 |
| **Method** | `POST` |
| **프론트 Endpoint** | `/api/backend/payments/verify-checkout` |
| **내부 동작** | ① Stripe Session 조회 → ② `payment_status === "paid"` 확인 → ③ Java `POST /api/v1/payments/photo/{orderId}` 호출 |

> **핵심**: 이 API는 Stripe 검증 + Java 결제 완료를 **한 번에** 처리합니다. Java 호출이 앨범 생성을 트리거합니다.

#### Request Body

| 필드명 | 타입 | 필수 | 설명 | 예시 |
|--------|------|------|------|------|
| `sessionId` | `string` | O | Stripe Checkout Session ID | `"cs_test_a1b2c3..."` |

#### Response

| 필드명 | 타입 | 설명 |
|--------|------|------|
| `success` | `boolean` | 검증 + 완료 처리 성공 여부 |
| `orderId` | `string` | 주문 ID (Stripe metadata에서 추출) |
| `paymentStatus` | `string` | Stripe 결제 상태 (`"paid"`) |
| `amountTotal` | `number` | 결제 총액 |
| `error` | `string` | 실패 시 에러 메시지 |

#### 후속 처리

| 조건 | 동작 |
|------|------|
| 성공 | 인라인 성공 화면 표시 + `window.history.replaceState` (URL 세탁 — 새로고침 시 중복 검증 방지) |
| 실패 | `"결제 확인에 실패했습니다. 고객센터에 문의해 주세요."` 에러 표시 |
| 취소 복귀 | `"결제가 취소되었습니다. 다시 시도해 주세요."` + URL 세탁 |

---

## 부록 A: 초기 데이터 로드 API

### 페이지 1 (checkout) — 페이지 진입 시

| 순서 | API | 용도 |
|------|-----|------|
| 1 | `fetchTourDetail(tourId)` | 투어 정보 (이름, 썸네일, 장소, 가격) |
| 2 | `fetchSchedules(tourId)` | 스케줄 정보 (시작시간, 스케줄ID) |
| 3 | `GET /api/backend/wallet` | 보유 크레딧 조회 (AI, PHOTO, RETOUCH) |
| 4 | `GET /api/backend/issued-coupons` | 발급된 쿠폰 목록 |

### 페이지 2 (redeem) — 페이지 진입 시

| 순서 | API | 용도 |
|------|-----|------|
| 1 | `GET /api/backend/wallet` | 보유 크레딧 조회 (PHOTO, RETOUCH) |
| 2 | `GET /api/backend/retouchers` | 리터처 목록 (리터치 선택 시) |
| 3 | `GET /api/backend/folder-photos?folderId={id}` | 폴더 내 사진 목록 |

---

## 부록 B: Java 백엔드 엔드포인트 매핑

| 프론트 API Route | Java 백엔드 엔드포인트 | 전송 방식 |
|------------------|----------------------|----------|
| `POST /api/backend/create-folder` | `POST /api/v1/folders?scheduleId=&name=&hostUserId=&personCount=` | Query String + multipart/form-data |
| `POST /api/backend/orders` | `POST /api/v1/orders/photo` | JSON Body |
| `POST /api/backend/payments/complete` | `POST /api/v1/payments/photo/{photoOrderId}` | 빈 Body |
| `POST /api/backend/payments/verify-checkout` | Stripe SDK → `POST /api/v1/payments/photo/{photoOrderId}` | 빈 Body |
| `POST /api/backend/payments/checkout` | Stripe SDK (Java 미호출) | — |
| `POST /api/stripe/create-checkout` | Stripe SDK (Java 미호출) | — |

> **공통 인증**: 모든 Java API 호출 시 `Authorization: Bearer {accessToken}` + `Accept-Language: {userLan}` 헤더 필수

---

## 부록 C: 주의사항

### 1. 금액 계산 우선순위
```
프론트 크레딧 가드 (creditCoversAll) > 백엔드 totalPayment > 프론트 계산 totalFinal
```

### 2. 크레딧 타입 치환 규칙
| 백엔드 반환 | 프론트 표시 |
|------------|-----------|
| `SNAP`, `SNAP_DOWNLOAD` | `PHOTO` (사진 다운로드권) |
| `AI`, `AI_RETOUCH` | `AI` (AI 보정권) |
| `RETOUCH` | `RETOUCH` (디테일 보정권) |

### 3. 최소 결제 금액
- `finalAmount > 0 && finalAmount < 500` → 결제 차단 (`"결제 최소 금액은 500원입니다."`)
- Stripe KRW 최소 결제: 50원이지만, Cheiz 정책으로 500원 이상만 허용

### 4. 401 토큰 갱신 패턴
`/api/backend/create-folder` 프록시에서 401 발생 시:
1. `POST /api/v1/auth/token/refresh` 호출 (refreshToken 사용)
2. 새 accessToken으로 자동 재시도
3. 재시도도 실패 시 `"인증이 만료되었습니다. 다시 로그인해주세요."` 반환

### 5. 비치명적 실패 (플로우 계속 진행)
| API | 실패 시 동작 |
|-----|-------------|
| `POST /api/bubble/notifications` | `console.warn`만 기록 |
| `PATCH /api/bubble/cancel-reservation` (edit mode) | `console.warn`만 기록 |

### 6. URL 히스토리 세탁
결제 성공/취소 후 URL 파라미터를 `window.history.replaceState`로 제거하여:
- 새로고침 시 중복 결제 검증/완료 처리 방지
- 뒤로가기 시 Stripe 결제 페이지로 다시 이동 방지
