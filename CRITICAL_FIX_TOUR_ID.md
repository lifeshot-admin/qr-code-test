# 🚨 [CRITICAL FIX] Tour ID 매핑 오류 수정 완료

## ❌ 문제점

### 1️⃣ 필드명 매핑 오류
**버블 DB 필드명**: `tour_Id` (소문자 t, 소문자 d)  
**기존 코드**: `Tour_ID` (대문자 T, 대문자 D) ❌

### 2️⃣ 값 매핑 오류
**전달되던 값**: `11093` (Folder ID) ❌  
**필요한 값**: `30` (진짜 Tour ID) ✅  

**원인**:
```typescript
// ❌ 잘못된 코드 (기존)
router.push(`/cheiz/reserve?tour_id=${tour.id}`);
// tour.id = 11093 (Folder ID)
```

**올바른 경로**:
```typescript
// ✅ 수정된 코드
const realTourId = tour.scheduleResponse.tourDTO.id; // 30
router.push(`/cheiz/reserve?tour_id=${realTourId}`);
```

---

## ✅ 수정 완료

### 1️⃣ 필드명 수정: `Tour_ID` → `tour_Id`

#### 파일: `lib/bubble-api.ts`

**타입 정의 수정**:
```typescript
// ❌ 기존
export type Spot = {
  Tour_ID?: number;  // 대문자
};

// ✅ 수정
export type Spot = {
  tour_Id?: number;  // ✅ 소문자 t, 소문자 d
};
```

**`getSpotsByTourId` 함수 수정**:
```typescript
// ❌ 기존
const constraints = [
  { key: "Tour_ID", constraint_type: "equals", value: tourId },
];

// ✅ 수정
const constraints = [
  { key: "tour_Id", constraint_type: "equals", value: tourId }, // ✅ 소문자!
];
```

---

### 2️⃣ 값 매핑 수정: Folder ID → Tour ID

#### 파일: `app/cheiz/my-tours/page.tsx`

**진짜 Tour ID 추출**:
```typescript
// ✅ scheduleResponse.tourDTO.id에서 진짜 Tour ID 추출
const realTourId = tour.scheduleResponse.tourDTO.id; // 예: 30

console.log(`🎴 [Tour Card ${index}] SWAGGER MAPPING:`, {
  folderId: tour.id, // ❌ Folder ID (11093) - 사용 금지!
  realTourId: realTourId, // ✅ 진짜 Tour ID (30)
  name: tourName,
  // ...
});
```

**클릭 시 진짜 Tour ID 전달**:
```typescript
onClick={() => {
  if (!isPast) {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎯 [Card Click] 포즈 선택 페이지로 이동:");
    console.log("  ❌ Folder ID (사용 금지!):", tour.id);
    console.log("  ✅ 진짜 Tour ID:", realTourId);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    router.push(`/cheiz/reserve?tour_id=${realTourId}`); // ✅ 진짜 Tour ID
  }
}}
```

---

### 3️⃣ 디버깅 로그 추가

모든 버블 API 호출 전에 **🚨 [CRITICAL CHECK]** 로그를 추가하여 tourId 값을 명확히 확인할 수 있도록 수정했습니다.

#### 추가된 로그 위치:

1. **`lib/bubble-api.ts`**:
   - `getSpotsByTourId(tourId)`
   - `getSpotPosesByFilters(tourId, spotId, persona?)`
   - `getPersonasByTourAndSpot(tourId, spotId)`

2. **`app/api/bubble/spots/[tourId]/route.ts`**:
   - API 라우트 진입 시
   - `parseInt` 후

3. **`app/api/bubble/personas/[tourId]/[spotId]/route.ts`**:
   - API 라우트 진입 시
   - `parseInt` 후

4. **`app/api/bubble/spot-poses-by-spot/[spotId]/route.ts`**:
   - API 라우트 진입 시
   - tourId 쿼리 파라미터 확인

#### 로그 형식:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 [CRITICAL CHECK] getSpotsByTourId 호출:
  ✅ Sending tourId: 30
  ✅ tourId type: number
  ⚠️ 이 값이 11093이면 잘못됨! 30처럼 작은 숫자여야 함!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 [Bubble API] Final URL: .../api/1.1/obj/SPOT?constraints=[...]
📍 [Bubble API] Constraints: [{"key":"tour_Id","constraint_type":"equals","value":30}]
...
✅ [Bubble API] getSpotsByTourId 결과: 5개
```

---

## 📋 수정된 파일 목록

### 1️⃣ 코어 로직
- ✅ `lib/bubble-api.ts`
  - `Spot` 타입: `Tour_ID` → `tour_Id`
  - `getSpotsByTourId`: 필드명 수정 + 로그 추가
  - `getSpotPosesByFilters`: 로그 추가
  - `getPersonasByTourAndSpot`: 로그 추가

### 2️⃣ UI 페이지
- ✅ `app/cheiz/my-tours/page.tsx`
  - `realTourId` 추출: `tour.scheduleResponse.tourDTO.id`
  - 클릭 시 `realTourId` 전달
  - 상세 로그 추가

### 3️⃣ API 라우트
- ✅ `app/api/bubble/spots/[tourId]/route.ts`
  - 로그 추가 (진입 시 + parseInt 후)
- ✅ `app/api/bubble/personas/[tourId]/[spotId]/route.ts`
  - 로그 추가 (진입 시 + parseInt 후)
- ✅ `app/api/bubble/spot-poses-by-spot/[spotId]/route.ts`
  - 로그 추가 (진입 시 + tourId 쿼리 확인)

---

## 🔍 데이터 흐름 (수정 후)

### Before (❌ 잘못된 흐름):
```
1. 예약 리스트 조회
   getUserTours() → response.data.content[0]
     ↓
2. Tour 카드 클릭
   tour.id = 11093 (❌ Folder ID)
     ↓
3. URL 전달
   /cheiz/reserve?tour_id=11093 (❌ 잘못됨!)
     ↓
4. SPOT 조회
   GET /api/bubble/spots/11093
     ↓
5. Bubble API
   GET .../SPOT?constraints=[{"key":"Tour_ID","value":11093}]
   (❌ 필드명 잘못 + 값 잘못)
     ↓
6. 결과
   0개 (데이터 없음)
```

---

### After (✅ 올바른 흐름):
```
1. 예약 리스트 조회
   getUserTours() → response.data.content[0]
     ↓
2. Tour 정보 추출
   tour.id = 11093 (Folder ID, 사용 안 함)
   tour.scheduleResponse.tourDTO.id = 30 (✅ 진짜 Tour ID)
     ↓
3. Tour 카드 클릭
   realTourId = 30
     ↓
4. URL 전달
   /cheiz/reserve?tour_id=30 (✅ 올바름!)
     ↓
5. SPOT 조회
   GET /api/bubble/spots/30
     ↓
   🚨 [CRITICAL CHECK] Sending tourId: 30 (로그)
     ↓
6. Bubble API
   GET .../SPOT?constraints=[{"key":"tour_Id","value":30}]
   (✅ 필드명 올바름 + 값 올바름)
     ↓
7. 결과
   5개 SPOT 조회 성공!
```

---

## 🧪 테스트 가이드

### 1단계: 예약 리스트에서 확인
1. `/cheiz/my-tours` 페이지 접속
2. **브라우저 콘솔 확인**:
   ```
   🎴 [Tour Card 0] SWAGGER MAPPING: {
     folderId: 11093,    // ❌ Folder ID (사용 금지!)
     realTourId: 30,     // ✅ 진짜 Tour ID
     name: "강남 투어",
     // ...
   }
   ```

### 2단계: 투어 카드 클릭
1. 투어 카드 클릭
2. **브라우저 콘솔 확인**:
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   🎯 [Card Click] 포즈 선택 페이지로 이동:
     ❌ Folder ID (사용 금지!): 11093
     ✅ 진짜 Tour ID: 30
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ```
3. **URL 확인**: `/cheiz/reserve?tour_id=30`

### 3단계: SPOT 조회 확인
1. 포즈 선택 페이지 진입
2. **터미널 로그 확인**:
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   🚨 [CRITICAL CHECK] /api/bubble/spots/[tourId] 호출:
     📥 받은 tourId (string): 30
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ✅ parseInt 후 tourId (number): 30
     ✅ tourId type: number
     ⚠️ 이 값이 11093이면 잘못됨! 30처럼 작은 숫자여야 함!
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   🚨 [CRITICAL CHECK] getSpotsByTourId 호출:
     ✅ Sending tourId: 30
     ✅ tourId type: number
     ⚠️ 이 값이 11093이면 잘못됨! 30처럼 작은 숫자여야 함!
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   
   📍 [Bubble API] Final URL: https://api.lifeshot.me/version-test/api/1.1/obj/SPOT?constraints=%5B%7B%22key%22%3A%22tour_Id%22%2C%22constraint_type%22%3A%22equals%22%2C%22value%22%3A30%7D%5D
   📍 [Bubble API] Constraints: [{"key":"tour_Id","constraint_type":"equals","value":30}]
   
   [Bubble API] GET Request
   📍 Targeting Bubble Test DB: https://api.lifeshot.me/version-test/api/1.1/obj/SPOT?constraints=...
   🔑 Authorization: Bearer 09d17***
   ---
   
   ✅ [Bubble API] getSpotsByTourId 결과: 5개
   ✅ [API Route] /api/bubble/spots/30 결과: 5개
   ```

### 4단계: Spot 선택 후 Persona 로드
1. Spot 카드 클릭 (예: "강남역")
2. **터미널 로그 확인**:
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   🚨 [CRITICAL CHECK] /api/bubble/personas/[tourId]/[spotId] 호출:
     📥 받은 tourId (string): 30
     📥 받은 spotId (string): 456
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ✅ parseInt 후 tourId (number): 30
     ✅ parseInt 후 spotId (number): 456
     ⚠️ tourId가 11093이면 잘못됨! 30처럼 작은 숫자여야 함!
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   🚨 [CRITICAL CHECK] getPersonasByTourAndSpot 호출:
     ✅ Sending tourId: 30
     ✅ Sending spotId: 456
     ⚠️ tourId가 11093이면 잘못됨! 30처럼 작은 숫자여야 함!
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   
   📋 [Bubble] Found 4 unique personas for tour 30, spot 456: ["1인", "2인", "커플", "가족"]
   ✅ [Personas API] Found 4 unique personas: ["1인", "2인", "커플", "가족"]
   ```

### 5단계: 포즈 조회
1. Persona 필터 선택 (예: "커플")
2. **터미널 로그 확인**:
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   🚨 [CRITICAL CHECK] /api/bubble/spot-poses-by-spot/[spotId] 호출:
     📥 받은 spotId (string): 456
     ✅ parseInt 후 spotId (number): 456
     📥 받은 tourId query (string): 30
     📥 받은 persona query: 커플
     ✅ parseInt 후 tourId (number): 30
     ⚠️ tourId가 11093이면 잘못됨! 30처럼 작은 숫자여야 함!
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   🚨 [CRITICAL CHECK] getSpotPosesByFilters 호출:
     ✅ Sending tourId: 30
     ✅ Sending spotId: 456
     ✅ Sending persona: 커플
     ⚠️ tourId가 11093이면 잘못됨! 30처럼 작은 숫자여야 함!
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   
   📍 [Bubble API] Final URL: .../Spot_pose?constraints=[...]
   📍 [Bubble API] Constraints: [{"key":"tour_Id","value":30},{"key":"spot_Id","value":456},{"key":"persona","value":"커플"}]
   
   ✅ [Bubble API] getSpotPosesByFilters 결과: 8개
   ✅ [Spot Poses] Found 8 poses
   ```

---

## ✅ 최종 체크리스트

### 필드명 매핑
- [x] `Spot` 타입: `Tour_ID` → `tour_Id`
- [x] `getSpotsByTourId`: `key: "Tour_ID"` → `key: "tour_Id"`
- [x] Constraints JSON: `"key":"tour_Id"` (소문자)

### 값 매핑
- [x] `realTourId` 변수: `tour.scheduleResponse.tourDTO.id` 추출
- [x] URL 전달: `tour_id=${realTourId}` (Folder ID 대신 Tour ID)
- [x] 카드 클릭 로그: Folder ID vs Tour ID 명확히 구분

### 디버깅 로그
- [x] `lib/bubble-api.ts`: 3개 함수에 로그 추가
- [x] `app/api/bubble/spots/[tourId]/route.ts`: 로그 추가
- [x] `app/api/bubble/personas/[tourId]/[spotId]/route.ts`: 로그 추가
- [x] `app/api/bubble/spot-poses-by-spot/[spotId]/route.ts`: 로그 추가
- [x] 모든 로그: tourId 값 명확히 표시 + 11093 경고

---

## 🎉 완료!

**모든 수정이 완료되었습니다!** 🚨

이제 다음을 확인하십시오:
1. ✅ 예약 카드 클릭 시 **realTourId (30)**가 전달되는지
2. ✅ Bubble API 호출 시 **tour_Id (소문자)**가 사용되는지
3. ✅ 모든 로그에서 **tourId: 30** (작은 숫자)이 찍히는지

**기대 결과**:
```
SPOT 조회: 5개 ✅
Persona: ["전체", "1인", "2인", "커플", "가족"] ✅
포즈: 8개 (커플 필터 적용 시) ✅
```
