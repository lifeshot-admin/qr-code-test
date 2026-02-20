# API Flow Documentation

## Table of Contents
1. [Reservation Checkout Success Page](#task-1-reservation-checkout-success-page)
2. [Photo Redeem/Purchase Page](#task-2-photo-redeempurchase-page)
3. [Reservation Success Page (Alternative Flow)](#task-3-reservation-success-page-alternative-flow)
4. [API Route Details](#task-4-api-route-details)

---

## Task 1: Reservation Checkout Success Page

**File**: `Turborepo/apps/b2c-web/app/cheiz/reserve/checkout/success/page.tsx`

**Page Purpose**: Users land here after completing Stripe checkout for a reservation. This page processes the reservation, creates folders, generates QR codes, and creates notifications.

### Complete API Flow Sequence

#### **STEP 0: Create Backend Folder** (Lines 86-130)

**Trigger**: Page loads, user session authenticated, `tourId` exists, `getTotalSelectedCount() > 0`

**API Call**:
- **Method**: `POST`
- **Endpoint**: `/api/backend/create-folder`
- **Request Body**:
  ```typescript
  {
    scheduleId: number | null,        // From store or tourId fallback
    name: string,                     // tour.tour_name || "촬영 예약"
    hostUserId: string,               // session.user.id
    personCount: number               // guestCount.adults || 1
  }
  ```
- **Example Request**:
  ```json
  {
    "scheduleId": 123,
    "name": "교토 투어 예약",
    "hostUserId": "user_abc123",
    "personCount": 2
  }
  ```
- **Response**:
  ```typescript
  {
    success: boolean,
    folderId: number,                 // New folder ID
    raw: any                          // Full backend response
  }
  ```
- **Success Action**: 
  - Sets `finalFolderId` from response
  - Continues to STEP 1
- **Failure Action**: 
  - Throws error: "백엔드 예약 폴더 생성 실패"
  - Sets phase to "error"
  - Shows error message to user

---

#### **STEP 0.5: Cancel Existing Reservation** (Lines 135-146) - Conditional

**Trigger**: Only if `editMode === true` and `existingReservationId` exists

**API Call**:
- **Method**: `PATCH`
- **Endpoint**: `/api/bubble/cancel-reservation`
- **Request Body**:
  ```typescript
  {
    reservation_id: string             // existingReservationId
  }
  ```
- **Response**: No specific response structure (non-critical)
- **Success Action**: Logs success, continues
- **Failure Action**: Logs warning, continues anyway (non-blocking)

---

#### **STEP 1: Create Pose Reservation** (Lines 148-176)

**Trigger**: After STEP 0 succeeds (folder created)

**API Call**:
- **Method**: `POST`
- **Endpoint**: `/api/bubble/pose-reservation`
- **Request Body**:
  ```typescript
  {
    folder_Id: number,                // finalFolderId from STEP 0
    tour_Id: number,                  // effectiveTourId
    user_Id: string,                  // userId
    user_nickname: string             // session.user.nickname || session.user.name || ""
  }
  ```
- **Example Request**:
  ```json
  {
    "folder_Id": 456,
    "tour_Id": 123,
    "user_Id": "user_abc123",
    "user_nickname": "홍길동"
  }
  ```
- **Response**:
  ```typescript
  {
    success: boolean,
    reservation_id: string,            // Bubble reservation ID
    reservation_code: string,           // 6-digit code (e.g., "123456")
    data: any                          // Full Bubble response
  }
  ```
- **Success Action**: 
  - Stores `bubbleReservationId` and `bubbleReservationCode`
  - Sets `reservationCode` state
  - Continues to STEP 2
- **Failure Action**: 
  - Throws error: "Failed to create reservation"
  - Sets phase to "error"

---

#### **STEP 2: Create Reserved Poses** (Lines 178-206)

**Trigger**: After STEP 1 succeeds, if `selectedPoses.length > 0`

**API Call**:
- **Method**: `POST`
- **Endpoint**: `/api/bubble/reserved-pose`
- **Request Body**:
  ```typescript
  {
    pose_reservation_id: string,       // bubbleReservationId from STEP 1
    selected_poses: Array<{
      spot_pose_id: string | number,
      spot_id: number,
      spot_name: string
    }>
  }
  ```
- **Example Request**:
  ```json
  {
    "pose_reservation_id": "bubble_res_789",
    "selected_poses": [
      {
        "spot_pose_id": "pose_001",
        "spot_id": 1,
        "spot_name": "교토 타워"
      },
      {
        "spot_pose_id": "pose_002",
        "spot_id": 2,
        "spot_name": "후시미 이나리"
      }
    ]
  }
  ```
- **Response**:
  ```typescript
  {
    success: boolean,
    created_count: number,
    failed_count: number,
    reserved_pose_ids: string[]        // Array of created IDs
  }
  ```
- **Success Action**: Logs success, continues to STEP 3
- **Failure Action**: 
  - Throws error: "reserved_pose 저장 실패"
  - Sets phase to "error"

---

#### **STEP 3: Generate QR Code** (Lines 208-217)

**Trigger**: After STEP 2 completes (client-side, no API call)

**Action**: 
- Generates QR code using `QRCode.toDataURL()`
- QR data: `${window.location.origin}/photographer/scan?reservation_id=${bubbleReservationId}`
- Sets `qrCodeUrl` state
- Sets `reservationId` state

---

#### **STEP 4: Create Payment Complete Notification** (Lines 219-236)

**Trigger**: After QR generation (non-blocking)

**API Call**:
- **Method**: `POST`
- **Endpoint**: `/api/bubble/notifications`
- **Request Body**:
  ```typescript
  {
    user_Id: number,                  // Number(userId)
    type: "PAYMENT_COMPLETE",
    title: string,                     // "결제가 완료되었습니다"
    body: string,                      // tour.tour_name || "투어 결제"
    link_id: number | null,            // finalFolderId (if exists)
    is_read: false
  }
  ```
- **Example Request**:
  ```json
  {
    "user_Id": 12345,
    "type": "PAYMENT_COMPLETE",
    "title": "결제가 완료되었습니다",
    "body": "교토 투어 예약",
    "link_id": 456,
    "is_read": false
  }
  ```
- **Response**:
  ```typescript
  {
    success: boolean,
    id: string | null                  // Notification ID
  }
  ```
- **Success Action**: Logs success (non-blocking)
- **Failure Action**: Logs warning, continues anyway (non-critical)

---

#### **Final Steps** (Lines 238-254)

**Actions**:
1. If `editMode`, calls `setEditMode(false, null, [])`
2. Sets phase to "success"
3. After 2 seconds, calls `clearAll()` to reset store
4. Displays success UI with QR code and reservation code

---

### Complete Flow Summary

```
User lands on page
  ↓
[STEP 0] POST /api/backend/create-folder
  ↓ (success)
[STEP 0.5] PATCH /api/bubble/cancel-reservation (if editMode)
  ↓
[STEP 1] POST /api/bubble/pose-reservation
  ↓ (success)
[STEP 2] POST /api/bubble/reserved-pose
  ↓ (success)
[STEP 3] Generate QR Code (client-side)
  ↓
[STEP 4] POST /api/bubble/notifications (PAYMENT_COMPLETE)
  ↓
Display success page with QR code
```

---

## Task 2: Photo Redeem/Purchase Page

**File**: `Turborepo/apps/b2c-web/app/cheiz/folder/[folderId]/redeem/page.tsx`

**Page Purpose**: Users purchase photos and/or retouching services. Handles credit discounts, creates orders, processes payments (Stripe or credit-only), and triggers album creation.

### Initial Data Loading (On Page Load)

#### **Load Credits** (Lines 94-110)

**Trigger**: Component mounts, `N` or `M` changes

**API Call**:
- **Method**: `GET`
- **Endpoint**: `/api/backend/wallet`
- **Request**: No body (uses session auth)
- **Response**:
  ```typescript
  {
    success: boolean,
    photoCredits: number,              // Available photo credits
    retouchCredits: number,             // Available retouch credits
    aiCredits: number                  // Available AI credits
  }
  ```
- **Success Action**: Sets credits state, initializes steppers to 0
- **Failure Action**: Silently fails, credits remain 0

---

#### **Load Retoucher** (Lines 113-122) - Conditional

**Trigger**: Component mounts, only if `retoucherId` exists in URL params

**API Call**:
- **Method**: `GET`
- **Endpoint**: `/api/backend/retouchers`
- **Request**: No body (uses session auth)
- **Response**:
  ```typescript
  {
    success: boolean,
    retoucher: {
      id: number,
      name: string,
      avatar: string | null,
      description: string,
      rating: number,
      pricePerPhoto: number
    }
  }
  ```
- **Success Action**: Sets retoucher state
- **Failure Action**: Silently fails

---

#### **Load Folder Photos** (Lines 125-140)

**Trigger**: Component mounts, `folderId` exists

**API Call**:
- **Method**: `GET`
- **Endpoint**: `/api/backend/folder-photos?folderId={folderId}`
- **Query Params**:
  ```typescript
  {
    folderId: string                   // From URL params
  }
  ```
- **Response**:
  ```typescript
  {
    success: boolean,
    photos: Array<{
      id: string | number,
      url: string,
      thumbnailUrl: string,
      aiUrl?: string                   // AI retouched version
    }>
  }
  ```
- **Success Action**: Sets `allPhotos` state for thumbnails
- **Failure Action**: Silently fails

---

### Payment Flow (When User Clicks Payment Button)

**Trigger**: User clicks "결제하기" button (line 744)

#### **STEP A: Create Photo Order** (Lines 172-206)

**API Call**:
- **Method**: `POST`
- **Endpoint**: `/api/backend/orders`
- **Request Body**:
  ```typescript
  {
    folderId: number | string,         // From URL params
    rawPhotoIds: number[],             // Photo IDs to purchase
    detailPhotoIds: number[],          // Retouch photo IDs
    colorPhotoIds: number[],           // Empty array
    issuedCouponIds: number[],         // Empty array
    retoucherId: number | null,        // From URL params (if retouching)
    credit?: {                         // Optional credit usage
      PHOTO?: number,                  // Photo credits to use
      RETOUCH?: number                 // Retouch credits to use
    }
  }
  ```
- **Example Request**:
  ```json
  {
    "folderId": 456,
    "rawPhotoIds": [101, 102, 103],
    "detailPhotoIds": [101, 102],
    "colorPhotoIds": [],
    "issuedCouponIds": [],
    "retoucherId": 5,
    "credit": {
      "PHOTO": 2,
      "RETOUCH": 1
    }
  }
  ```
- **Response**:
  ```typescript
  {
    success: boolean,
    orderId: number,                   // Photo order ID
    totalPayment: number,             // Final amount after credits
    data: any                         // Full backend response
  }
  ```
- **Success Action**: 
  - Stores `photoOrderId` and `backendPayment`
  - Calculates `actualPayment` (0 if credits cover all)
  - Continues to STEP B or FREE path
- **Failure Action**: 
  - Throws error: "ORDER_FAIL"
  - Shows error message: "주문 생성에 실패했습니다..."

---

#### **STEP B (Path 1): Free Payment (Credits Cover All)** (Lines 221-244)

**Trigger**: `actualPayment <= 0` (credits fully cover cost)

**API Call**:
- **Method**: `POST`
- **Endpoint**: `/api/backend/payments/complete`
- **Request Body**:
  ```typescript
  {
    photoOrderId: number              // From STEP A
  }
  ```
- **Example Request**:
  ```json
  {
    "photoOrderId": 789
  }
  ```
- **Response**:
  ```typescript
  {
    success: boolean,
    orderId: number,
    data: any
  }
  ```
- **Success Action**: 
  - Sets completion state (`done = true`)
  - Stores order details
  - Shows success screen
  - **Triggers album creation on backend**
- **Failure Action**: 
  - Throws error: "FREE_FAIL"
  - Shows error message: "크레딧 결제 처리에 실패했습니다..."

---

#### **STEP B (Path 2): Stripe Checkout** (Lines 247-272)

**Trigger**: `actualPayment > 0` (requires payment)

**API Call**:
- **Method**: `POST`
- **Endpoint**: `/api/backend/payments/checkout`
- **Request Body**:
  ```typescript
  {
    photoOrderId: number,
    amount: number,                    // actualPayment (in KRW)
    folderId: string | number,
    n: number,                         // Number of photos
    m: number,                         // Number of retouch photos
    origin: string                     // window.location.origin
  }
  ```
- **Example Request**:
  ```json
  {
    "photoOrderId": 789,
    "amount": 5000,
    "folderId": 456,
    "n": 3,
    "m": 2,
    "origin": "https://example.com"
  }
  ```
- **Response**:
  ```typescript
  {
    success: boolean,
    url: string,                        // Stripe Checkout URL
    sessionId: string                   // Stripe session ID
  }
  ```
- **Success Action**: 
  - Redirects user to Stripe Checkout (`window.location.href = checkoutData.url`)
  - User completes payment on Stripe
  - Stripe redirects back to redeem page with `checkout_success=true&session_id=...`
- **Failure Action**: 
  - Throws error: "PAY_FAIL"
  - Shows error message: "결제 정보를 불러오지 못했습니다..."

---

#### **STEP C: Verify Checkout (After Stripe Return)** (Lines 297-357)

**Trigger**: User returns from Stripe with `checkout_success=true&session_id=...` in URL

**API Call**:
- **Method**: `POST`
- **Endpoint**: `/api/backend/payments/verify-checkout`
- **Request Body**:
  ```typescript
  {
    sessionId: string                   // Stripe session ID from URL
  }
  ```
- **Example Request**:
  ```json
  {
    "sessionId": "cs_test_a1b2c3d4..."
  }
  ```
- **Response**:
  ```typescript
  {
    success: boolean,
    orderId: number,                   // photoOrderId
    paymentStatus: string,             // "paid"
    amountTotal: number                // Amount paid
  }
  ```
- **Success Action**: 
  - Sets completion state (`done = true`)
  - Stores order details
  - Cleans URL (removes query params)
  - Shows success screen
  - **Triggers album creation on backend**
- **Failure Action**: 
  - Sets error message
  - Shows error to user

---

### Payment Flow Summary

```
User clicks "결제하기"
  ↓
[STEP A] POST /api/backend/orders (create order with credits)
  ↓
Check: actualPayment <= 0?
  ├─ YES → [FREE PATH] POST /api/backend/payments/complete
  │         ↓
  │         Show success screen (album created)
  │
  └─ NO → [STRIPE PATH] POST /api/backend/payments/checkout
            ↓
            Redirect to Stripe
            ↓
            User pays on Stripe
            ↓
            Return to page with session_id
            ↓
            [STEP C] POST /api/backend/payments/verify-checkout
            ↓
            Show success screen (album created)
```

---

## Task 3: Reservation Success Page (Alternative Flow)

**File**: `Turborepo/apps/b2c-web/app/cheiz/reserve/success/page.tsx`

**Page Purpose**: Alternative success page for reservations (different from checkout success). Similar flow but uses `BOOKING_COMPLETE` notification instead of `PAYMENT_COMPLETE`.

### Key Differences from Checkout Success:

1. **Notification Type**: Uses `BOOKING_COMPLETE` instead of `PAYMENT_COMPLETE` (line 373)
2. **Pre-existing Reservation**: Can handle `preReservationId` in URL params (lines 89-118) - skips API calls if reservation already exists
3. **Flow**: Same API sequence as checkout success but different notification type

### API Flow (Same as Checkout Success, except notification):

- **STEP 0**: `POST /api/backend/create-folder`
- **STEP 1**: `POST /api/bubble/pose-reservation`
- **STEP 2**: `POST /api/bubble/reserved-pose`
- **STEP 3**: Generate QR (client-side)
- **STEP 4**: `POST /api/bubble/notifications` with `type: "BOOKING_COMPLETE"`

---

## Task 4: API Route Details

### 1. `/api/backend/create-folder` (POST)

**File**: `Turborepo/apps/b2c-web/app/api/backend/create-folder/route.ts`

**Backend Endpoint**: `POST /api/v1/folders?scheduleId={}&name={}&hostUserId={}&personCount={}`

**Request**:
- **Method**: `POST`
- **Headers**: 
  - `Content-Type: application/json`
  - `Authorization: Bearer {token}` (from session)
- **Body**:
  ```typescript
  {
    scheduleId: number,
    name: string,
    hostUserId: string,
    personCount: number
  }
  ```
- **Note**: Backend expects query params + `multipart/form-data` body with empty `photos` field

**Response**:
```typescript
{
  success: boolean,
  folderId: number,                    // Extracted from backend response
  raw: any                              // Full backend response
}
```

**Backend Response Structure** (extracted from):
- `parsed.data.id`
- `parsed.data.folderId`
- `parsed.data.folder_Id`
- `parsed.id`
- `parsed.folderId`

**Error Handling**:
- **401**: Attempts token refresh, retries once
- **Other errors**: Returns error with status code

---

### 2. `/api/backend/payments/verify-checkout` (POST)

**File**: `Turborepo/apps/b2c-web/app/api/backend/payments/verify-checkout/route.ts`

**Purpose**: Verifies Stripe checkout session and triggers backend payment completion

**Request**:
- **Method**: `POST`
- **Headers**: 
  - `Content-Type: application/json`
  - `Authorization: Bearer {token}` (from session)
- **Body**:
  ```typescript
  {
    sessionId: string                   // Stripe checkout session ID
  }
  ```

**Process**:
1. Retrieves Stripe checkout session using `stripe.checkout.sessions.retrieve(sessionId)`
2. Validates `payment_status === "paid"`
3. Extracts `photoOrderId` from session metadata
4. Calls backend: `POST /api/v1/payments/photo/{photoOrderId}`

**Response**:
```typescript
{
  success: boolean,
  orderId: number,
  paymentStatus: string,                // "paid"
  amountTotal: number                   // Amount in KRW (cents)
}
```

**Error Handling**:
- **400**: Payment not completed or missing `photoOrderId`
- **Other**: Returns backend error

---

### 3. `/api/backend/transfer-photo` (POST)

**File**: `Turborepo/apps/b2c-web/app/api/backend/transfer-photo/route.ts`

**Purpose**: Transfers a single photo from source URL to target folder (used for photo migration)

**Request**:
- **Method**: `POST`
- **Headers**: 
  - `Content-Type: application/json`
  - `Authorization: Bearer {token}` (from session or header)
- **Body**:
  ```typescript
  {
    sourceOriginalUrl: string,          // Source photo URL
    targetFolderId: number,             // Destination folder ID
    photoId?: number                    // Reference photo ID
  }
  ```

**Process**:
1. Downloads photo from `sourceOriginalUrl` (60s timeout)
2. Uploads to backend: `POST /api/v1/folders/{targetFolderId}/photos`
3. Uses `FormData` with key `photos` (array format)

**Response**:
```typescript
{
  success: boolean,
  photoId: number,                     // Original photo ID
  uploadedId: number                    // New photo ID in folder
}
```

**Error Handling**:
- **401**: Attempts token refresh, retries once
- **502**: Download or upload failed
- **500**: General error

---

### 4. `/api/backend/albums` (GET)

**File**: `Turborepo/apps/b2c-web/app/api/backend/albums/route.ts`

**Backend Endpoint**: `GET /api/v1/albums?userId={userId}`

**Request**:
- **Method**: `GET`
- **Headers**: 
  - `Authorization: Bearer {token}` (from session)
  - `Accept-Language: {lang}` (from session)
- **Query Params**:
  ```typescript
  {
    userId: string                      // From session
  }
  ```

**Response**:
```typescript
{
  success: boolean,
  albums: any[],                        // Array of album objects
  count: number,                        // albums.length
  raw: any                             // Full backend response
}
```

**Backend Response Structure** (extracted from):
- `parsed.data.content` (array)
- `parsed.content` (array)
- `parsed.data` (array)
- `parsed` (array)

**Error Handling**:
- **401**: Unauthorized
- **Other**: Returns backend error

---

### 5. `/api/backend/wallet` (GET)

**File**: `Turborepo/apps/b2c-web/app/api/backend/wallet/route.ts`

**Purpose**: Retrieves user's credit balance

**Request**:
- **Method**: `GET`
- **Headers**: 
  - `Authorization: Bearer {token}` (from session)

**Response**:
```typescript
{
  success: boolean,
  photoCredits: number,                // Available photo credits
  retouchCredits: number,              // Available retouch credits
  aiCredits: number                    // Available AI credits
}
```

**Backend Endpoint**: `GET /api/v1/wallet` (inferred from usage)

---

### 6. `/api/backend/orders` (POST)

**File**: `Turborepo/apps/b2c-web/app/api/backend/orders/route.ts`

**Backend Endpoint**: `POST /api/v1/orders/photo`

**Request**:
- **Method**: `POST`
- **Headers**: 
  - `Content-Type: application/json`
  - `Authorization: Bearer {token}` (from session)
  - `Accept-Language: {lang}` (from session)
- **Body**:
  ```typescript
  {
    folderId: number,
    rawPhotoIds: number[],             // Photo IDs to purchase
    detailPhotoIds: number[],          // Retouch photo IDs
    colorPhotoIds: number[],           // Empty array
    issuedCouponIds: number[],         // Empty array
    retoucherId: number | null,
    credit?: {                          // Optional
      PHOTO?: number,
      RETOUCH?: number
    }
  }
  ```

**Response**:
```typescript
{
  success: boolean,
  orderId: number,                     // Photo order ID
  totalPayment: number,                // Final amount after credits
  data: any                            // Full backend response
}
```

**Error Handling**:
- **401**: Unauthorized
- **Other**: Returns backend error with status code

---

### 7. `/api/backend/payments/checkout` (POST)

**File**: `Turborepo/apps/b2c-web/app/api/backend/payments/checkout/route.ts`

**Purpose**: Creates Stripe checkout session

**Request**:
- **Method**: `POST`
- **Headers**: 
  - `Content-Type: application/json`
- **Body**:
  ```typescript
  {
    photoOrderId: number,
    amount: number,                    // In KRW
    folderId: string | number,
    n: number,                         // Number of photos
    m: number,                         // Number of retouch photos
    origin: string                     // window.location.origin
  }
  ```

**Process**:
1. Creates Stripe checkout session with:
   - Product name: `Cheiz 사진 앨범 ({n}장 + 리터칭 {m}장)`
   - Amount: `amount` (KRW)
   - Success URL: `${origin}/cheiz/folder/${folderId}/redeem?checkout_success=true&session_id={CHECKOUT_SESSION_ID}&orderId=${photoOrderId}&n=${n}&m=${m}&paid=${amount}`
   - Cancel URL: `${origin}/cheiz/folder/${folderId}/redeem?checkout_cancelled=true&orderId=${photoOrderId}&n=${n}&m=${m}`
   - Metadata: `{ photoOrderId, folderId }`

**Response**:
```typescript
{
  success: boolean,
  url: string,                         // Stripe checkout URL
  sessionId: string                    // Stripe session ID
}
```

**Error Handling**:
- **401**: Unauthorized
- **400**: Missing required fields
- **500**: Stripe error

---

### 8. `/api/backend/payments/complete` (POST)

**File**: `Turborepo/apps/b2c-web/app/api/backend/payments/complete/route.ts`

**Backend Endpoint**: `POST /api/v1/payments/photo/{photoOrderId}`

**Purpose**: Completes 0-amount payment (credit-only) and triggers album creation

**Request**:
- **Method**: `POST`
- **Headers**: 
  - `Content-Type: application/json`
  - `Authorization: Bearer {token}` (from session)
  - `Accept-Language: {lang}` (from session)
- **Body**:
  ```typescript
  {
    photoOrderId: number
  }
  ```

**Response**:
```typescript
{
  success: boolean,
  orderId: number,
  data: any                            // Backend response (may be empty)
}
```

**Note**: Backend may return 204 (No Content) which is treated as success

**Error Handling**:
- **401**: Unauthorized
- **400**: Missing `photoOrderId`
- **Other**: Returns backend error

---

### 9. `/api/bubble/pose-reservation` (POST)

**File**: `Turborepo/apps/b2c-web/app/api/bubble/pose-reservation/route.ts`

**Bubble Endpoint**: `POST /version-test/api/1.1/obj/pose_reservation`

**Request**:
- **Method**: `POST`
- **Headers**: 
  - `Content-Type: application/json`
  - `Authorization: Bearer {BUBBLE_API_TOKEN}`
- **Body**:
  ```typescript
  {
    folder_Id: number,
    tour_Id: number,
    user_Id: number,
    user_nickname?: string,
    persona?: string                   // JSON stringified persona object
  }
  ```

**Process**:
1. Generates 6-digit reservation code (100000-999999)
2. Creates Bubble record with `status: "pending"` and `Id: reservationCode`

**Response**:
```typescript
{
  success: boolean,
  reservation_id: string,               // Bubble record ID
  reservation_code: string,             // 6-digit code
  data: any                             // Full Bubble response
}
```

**Error Handling**:
- **400**: Missing required fields
- **500**: Bubble API error or server config error

---

### 10. `/api/bubble/reserved-pose` (POST)

**File**: `Turborepo/apps/b2c-web/app/api/bubble/reserved-pose/route.ts`

**Bubble Endpoint**: `POST /version-test/api/1.1/obj/reserved_pose` (or `reserved-pose` with fallback)

**Request**:
- **Method**: `POST`
- **Headers**: 
  - `Content-Type: application/json`
  - `Authorization: Bearer {BUBBLE_API_TOKEN}`
- **Body**:
  ```typescript
  {
    pose_reservation_id: string,
    selected_poses: Array<{
      spot_pose_id: string | number,
      spot_id: number,
      spot_name: string
    }>
  }
  ```

**Process**:
1. Loops through `selected_poses`
2. For each pose, creates Bubble record with:
   - `pose_reservation_Id: pose_reservation_id`
   - `spot_pose_Id: pose.spot_pose_id`
3. Tries `reserved_pose` first, falls back to `reserved-pose` if 404

**Response**:
```typescript
{
  success: boolean,
  created_count: number,
  failed_count: number,
  reserved_pose_ids: string[]            // Array of created IDs
}
```

**Error Handling**:
- **400**: Invalid payload
- **404**: Endpoint not found (tries fallback)
- **500**: Server error

---

### 11. `/api/bubble/notifications` (POST)

**File**: `Turborepo/apps/b2c-web/app/api/bubble/notifications/route.ts`

**Bubble Endpoint**: `POST /version-test/api/1.1/obj/notification`

**Request**:
- **Method**: `POST`
- **Headers**: 
  - `Content-Type: application/json`
  - `Authorization: Bearer {BUBBLE_API_TOKEN}`
- **Body**:
  ```typescript
  {
    user_Id: number,
    type: string,                        // "PAYMENT_COMPLETE" or "BOOKING_COMPLETE"
    title: string,
    body: string,
    link_id: number | null,
    is_read: false
  }
  ```
- **Note**: `created_at` and `updated_at` are stripped if present

**Response**:
```typescript
{
  success: boolean,
  id: string | null                     // Notification ID (may be null)
}
```

**Error Handling**:
- **500**: Bubble API error or server error

---

### 12. `/api/backend/folder-photos` (GET)

**File**: `Turborepo/apps/b2c-web/app/api/backend/folder-photos/route.ts`

**Backend Endpoint**: `GET /api/v1/folders/{folderId}/photos`

**Request**:
- **Method**: `GET`
- **Headers**: 
  - `Authorization: Bearer {token}` (from session)
  - `Accept-Language: {lang}` (from session)
- **Query Params**:
  ```typescript
  {
    folderId: string                     // From URL
  }
  ```

**Process**:
1. Fetches photos from `/api/v1/folders/{folderId}/photos`
2. Fetches AI photos from `/api/v1/ai/photos?folderId={folderId}`
3. Merges AI URLs into photo objects

**Response**:
```typescript
{
  success: boolean,
  photos: Array<{
    id: string | number,
    url: string,
    thumbnailUrl: string,
    aiUrl?: string                      // AI retouched version
  }>
}
```

**Error Handling**:
- **400**: Missing `folderId`
- **401**: Unauthorized
- **500**: Server error

---

## Summary Tables

### Reservation Checkout Success Flow

| Step | API Endpoint | Method | Purpose | Critical |
|------|-------------|--------|---------|----------|
| 0 | `/api/backend/create-folder` | POST | Create backend folder | ✅ Yes |
| 0.5 | `/api/bubble/cancel-reservation` | PATCH | Cancel existing (edit mode) | ❌ No |
| 1 | `/api/bubble/pose-reservation` | POST | Create reservation record | ✅ Yes |
| 2 | `/api/bubble/reserved-pose` | POST | Save selected poses | ✅ Yes |
| 3 | QR Generation | Client | Generate QR code | ✅ Yes |
| 4 | `/api/bubble/notifications` | POST | Create PAYMENT_COMPLETE notification | ❌ No |

### Photo Redeem/Purchase Flow

| Step | API Endpoint | Method | Purpose | Critical |
|------|-------------|--------|---------|----------|
| Init | `/api/backend/wallet` | GET | Load credits | ❌ No |
| Init | `/api/backend/retouchers` | GET | Load retoucher info | ❌ No |
| Init | `/api/backend/folder-photos` | GET | Load photo thumbnails | ❌ No |
| A | `/api/backend/orders` | POST | Create order with credits | ✅ Yes |
| B1 | `/api/backend/payments/complete` | POST | Complete free payment | ✅ Yes |
| B2 | `/api/backend/payments/checkout` | POST | Create Stripe session | ✅ Yes |
| C | `/api/backend/payments/verify-checkout` | POST | Verify Stripe payment | ✅ Yes |

---

## Error Handling Patterns

### Common Error Responses

All APIs follow similar error response structure:
```typescript
{
  success: false,
  error: string,                        // Human-readable error message
  code?: string,                       // Error code (optional)
  detail?: any                         // Additional error details
}
```

### Token Refresh Pattern

Several APIs implement automatic token refresh on 401:
1. Detect 401 response
2. Extract `refreshToken` from session
3. Call `/api/v1/auth/token/refresh`
4. Retry original request with new token
5. If refresh fails, return 401 to client

### Non-Critical Operations

Some operations are non-blocking:
- Notification creation failures are logged but don't stop flow
- Photo thumbnail loading failures are silently ignored
- Retoucher loading failures are silently ignored

---

## Notes

1. **Backend Base URL**: `process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.lifeshot.me"`

2. **Bubble Base URL**: `process.env.BUBBLE_API_BASE_URL` with automatic `/version-test/api/1.1` path injection

3. **Authentication**: Most APIs use `getServerSession(authOptions)` to extract `accessToken` from session

4. **Language**: User language preference (`Accept-Language` header) is passed from session to backend APIs

5. **Album Creation**: Triggered automatically by backend when payment is completed via:
   - `POST /api/v1/payments/photo/{photoOrderId}` (called by verify-checkout or complete endpoints)

6. **QR Code Format**: `${window.location.origin}/photographer/scan?reservation_id={bubbleReservationId}`

7. **Reservation Code**: 6-digit random number (100000-999999) generated by Bubble API
