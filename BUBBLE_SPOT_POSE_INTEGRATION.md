# 🛠️ [Bubble API] SPOT & Spot_pose 통합 연동 완료

## ✅ 구현 완료 사항

### 1️⃣ 데이터 소스 및 필터 조건 (Bubble Data API)

#### ✅ SPOT 테이블 연동

**DB 구조** (image_a98057.png 기반):
- `spot_Id`: number
- `spot_name`: text
- `thumbnail`: image
- `Tour_ID`: number (⚠️ 대문자!)
- `min_count_limit`: number

**조회 API**:
```
GET .../api/1.1/obj/SPOT
```

**필터 조건**:
```json
{
  "constraints": [
    {
      "key": "Tour_ID",
      "constraint_type": "equals",
      "value": 123
    }
  ]
}
```

**구현 위치**: `lib/bubble-api.ts` → `getSpotsByTourId(tourId: number)`

---

#### ✅ Spot_pose 테이블 연동

**DB 구조** (image_a98075.png 기반):
- `image`: image
- `persona`: text
- `spot_Id`: number (⚠️ 언더스코어 + 대문자 I)
- `tour_Id`: number (⚠️ 소문자 i!)

**조회 API**:
```
GET .../api/1.1/obj/Spot_pose
```

**필터 조건 (복합)**:
```json
{
  "constraints": [
    {
      "key": "tour_Id",
      "constraint_type": "equals",
      "value": 123
    },
    {
      "key": "spot_Id",
      "constraint_type": "equals",
      "value": 456
    },
    {
      "key": "persona",
      "constraint_type": "equals",
      "value": "커플"
    }
  ]
}
```

**구현 위치**:
- `lib/bubble-api.ts` → `getSpotPosesByTourId(tourId: number)`
- `lib/bubble-api.ts` → `getSpotPosesBySpotId(spotId: number, persona?: string)`
- `lib/bubble-api.ts` → `getSpotPosesByFilters(tourId: number, spotId: number, persona?: string)`

---

### 2️⃣ UI 상태 관리 및 데이터 계층화

**파일**: `app/cheiz/reserve/page.tsx`

#### ✅ 상태 필드

```typescript
const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null); // 선택된 스팟
const [personas, setPersonas] = useState<string[]>(["전체"]); // ✅ 동적 로드
const [selectedPersona, setSelectedPersona] = useState("전체"); // 선택된 페르소나
const [poses, setPoses] = useState<SpotPose[]>([]); // 포즈 목록
const [selectedPoses, setSelectedPoses] = useState<Set<string>>(new Set()); // 선택된 포즈들
```

#### ✅ 스팟 선택 UI

```typescript
// SPOT 리스트 출력 (spot_name)
{spots.map((spot) => (
  <motion.div
    key={spot._id}
    onClick={() => handleSpotSelect(spot)} // ✅ 클릭 시 spot_Id 저장
    className="bg-white rounded-3xl shadow-lg overflow-hidden cursor-pointer"
  >
    {spot.thumbnail && (
      <Image src={normalizeImageUrl(spot.thumbnail)} alt={spot.spot_name} />
    )}
    <div className="p-6">
      <h4 className="text-xl font-bold">{spot.spot_name}</h4>
    </div>
  </motion.div>
))}
```

#### ✅ 페르소나 필터 UI (동적 로드)

```typescript
// ✅ Step 1: Spot 선택 시 Persona 목록 동적 로드
const handleSpotSelect = async (spot: Spot) => {
  // 1. Persona 목록 로드
  const personaResponse = await fetch(
    `/api/bubble/personas/${tourId}/${spot.spot_Id}`
  );
  
  const personaData = await personaResponse.json();
  const loadedPersonas = personaData.personas || ["전체"];
  setPersonas(loadedPersonas); // ✅ 동적으로 설정
  
  // 2. 포즈 목록 로드
  // ...
};

// ✅ Persona 필터 버튼 렌더링
{personas.map((persona) => (
  <button
    key={persona}
    onClick={() => setSelectedPersona(persona)}
    className={selectedPersona === persona ? "bg-skyblue" : "bg-white"}
  >
    {persona}
  </button>
))}
```

**핵심 로직**:
1. **Spot 선택** → `GET /api/bubble/personas/${tourId}/${spotId}` 호출
2. **응답에서 personas 추출** → `["전체", "1인", "2인", "커플"]`
3. **중복 제거된 persona 값들**을 필터 버튼으로 렌더링

---

### 3️⃣ 최종 이미지 렌더링 로직

**파일**: `app/cheiz/reserve/page.tsx`

#### ✅ 포즈 조회 조건 (3가지 AND 조건)

```typescript
// Persona 필터 변경 시
const params = new URLSearchParams();
params.append("tourId", String(tourId)); // ✅ 조건 1: tour_Id 일치
if (selectedPersona !== "전체") {
  params.append("persona", selectedPersona); // ✅ 조건 3: persona 일치
}

const response = await fetch(
  `/api/bubble/spot-poses-by-spot/${selectedSpot.spot_Id}?${params.toString()}`
  // ✅ 조건 2: spot_Id 일치 (URL path)
);
```

**최종 API 호출**:
```
GET /api/bubble/spot-poses-by-spot/456?tourId=123&persona=커플
```

**Bubble API로 변환**:
```
GET .../api/1.1/obj/Spot_pose?constraints=[
  {"key":"tour_Id","constraint_type":"equals","value":123},
  {"key":"spot_Id","constraint_type":"equals","value":456},
  {"key":"persona","constraint_type":"equals","value":"커플"}
]
```

#### ✅ 이미지 렌더링

```typescript
{poses.map((pose) => (
  <motion.div
    key={pose._id}
    onClick={() => togglePoseSelection(pose._id)}
    className={selectedPoses.has(pose._id) ? "ring-4 ring-skyblue" : ""}
  >
    {pose.image && (
      <Image
        src={normalizeImageUrl(pose.image) || pose.image} // ✅ https: 접두사 추가
        alt={`Pose ${pose._id}`}
        fill
        className="object-cover"
      />
    )}
    {pose.persona && (
      <div className="absolute top-2 right-2 bg-white px-3 py-1 rounded-full">
        {pose.persona}
      </div>
    )}
  </motion.div>
))}
```

---

### 4️⃣ 코드 구현 시 주의사항

#### ✅ 타입 변환 (Number 타입 보장)

**파일**: `lib/bubble-api.ts`

```typescript
export async function getSpotsByTourId(tourId: number): Promise<Spot[]> {
  const constraints = [
    { 
      key: "Tour_ID", // ✅ 대문자!
      constraint_type: "equals", 
      value: tourId // ✅ number 타입
    },
  ];
  // ...
}

export async function getSpotPosesByFilters(
  tourId: number,
  spotId: number,
  persona?: string
): Promise<SpotPose[]> {
  const constraints: Array<{
    key: string;
    constraint_type: string;
    value: number | string;
  }> = [
    { key: "tour_Id", constraint_type: "equals", value: tourId }, // ✅ number
    { key: "spot_Id", constraint_type: "equals", value: spotId }, // ✅ number
  ];
  
  if (persona && persona !== "전체") {
    constraints.push({
      key: "persona",
      constraint_type: "equals",
      value: persona, // ✅ string
    });
  }
  // ...
}
```

#### ✅ 이미지 경로 정규화 (https: 접두사 추가)

**파일**: `app/cheiz/reserve/page.tsx`

```typescript
/**
 * 이미지 URL 정규화 (Bubble API에서 https: 접두사가 생략될 수 있음)
 */
function normalizeImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  
  // 이미 완전한 URL이면 그대로 반환
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // //로 시작하면 https: 추가
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  
  // 상대 경로는 그대로 반환
  return url;
}
```

**사용**:
```typescript
<Image src={normalizeImageUrl(pose.image) || pose.image} />
```

---

## 📋 추가된/수정된 파일

### 새로 생성한 파일

1. ✅ `app/api/bubble/personas/[tourId]/[spotId]/route.ts`
   - tourId + spotId로 persona 중복 제거 목록 조회
   - "전체" 옵션 자동 추가

### 수정한 파일

1. ✅ `lib/bubble-api.ts`
   - `getSpotPosesByTourId(tourId)` 추가
   - `getSpotPosesByFilters(tourId, spotId, persona?)` 추가
   - `getPersonasByTourAndSpot(tourId, spotId)` 추가

2. ✅ `app/api/bubble/spot-poses-by-spot/[spotId]/route.ts`
   - tourId 파라미터 지원 추가
   - `getSpotPosesByFilters` 사용

3. ✅ `app/cheiz/reserve/page.tsx`
   - `personas` 상태 추가 (동적 로드)
   - `normalizeImageUrl` 함수 추가
   - `handleSpotSelect`: Persona 동적 로드 + tourId 조건 추가
   - Persona 필터 변경 시 tourId 조건 포함
   - 이미지 렌더링 시 URL 정규화
   - 디버깅 로그 강화

---

## 🔍 전체 데이터 흐름

### 1. 스팟 선택

```
사용자 클릭: Spot 카드
     ↓
handleSpotSelect(spot) 호출
     ↓
Step 1: GET /api/bubble/personas/${tourId}/${spotId}
     ↓
응답: { "personas": ["전체", "1인", "2인", "커플"] }
     ↓
setPersonas(["전체", "1인", "2인", "커플"])
     ↓
Step 2: GET /api/bubble/spot-poses-by-spot/${spotId}?tourId=${tourId}
     ↓
응답: { "poses": [...] }
     ↓
setPoses([...])
```

---

### 2. 페르소나 필터 변경

```
사용자 클릭: "커플" 버튼
     ↓
setSelectedPersona("커플")
     ↓
useEffect 트리거
     ↓
GET /api/bubble/spot-poses-by-spot/${spotId}?tourId=${tourId}&persona=커플
     ↓
Bubble API: constraints=[
  {"key":"tour_Id","value":123},
  {"key":"spot_Id","value":456},
  {"key":"persona","value":"커플"}
]
     ↓
응답: { "poses": [...] } (3가지 조건 모두 만족하는 포즈만)
     ↓
setPoses([...])
```

---

### 3. 최종 이미지 렌더링

```
poses 배열 순회
     ↓
각 pose에 대해:
  ✅ tour_Id === tourId (API 필터로 보장됨)
  ✅ spot_Id === selectedSpot.spot_Id (API 필터로 보장됨)
  ✅ persona === selectedPersona (API 필터로 보장됨)
     ↓
이미지 URL 정규화:
  pose.image = "//s3.amazonaws.com/..."
     ↓
  normalizeImageUrl(pose.image)
     ↓
  "https://s3.amazonaws.com/..." (✅ https: 접두사 추가)
     ↓
<Image src={normalizedUrl} />
```

---

## 📝 핵심 구현 코드

### lib/bubble-api.ts (새로 추가된 함수들)

#### 1. tourId로 Spot_pose 조회
```typescript
export async function getSpotPosesByTourId(tourId: number): Promise<SpotPose[]> {
  const constraints = [
    { key: "tour_Id", constraint_type: "equals", value: tourId },
  ];
  
  const url = `${BASE}/Spot_pose`;
  const params = new URLSearchParams();
  params.append("constraints", JSON.stringify(constraints));
  
  const res = await fetch(`${url}?${params.toString()}`, {
    method: "GET",
    headers: headers(),
  });
  
  const json: BubbleListResponse<SpotPose> = await res.json();
  return json?.response?.results ?? [];
}
```

#### 2. 복합 필터 조회 (tourId + spotId + persona)
```typescript
export async function getSpotPosesByFilters(
  tourId: number,
  spotId: number,
  persona?: string
): Promise<SpotPose[]> {
  const constraints: Array<{
    key: string;
    constraint_type: string;
    value: number | string;
  }> = [
    { key: "tour_Id", constraint_type: "equals", value: tourId },
    { key: "spot_Id", constraint_type: "equals", value: spotId },
  ];
  
  if (persona && persona !== "전체") {
    constraints.push({
      key: "persona",
      constraint_type: "equals",
      value: persona,
    });
  }
  
  const url = `${BASE}/Spot_pose`;
  const params = new URLSearchParams();
  params.append("constraints", JSON.stringify(constraints));
  
  const res = await fetch(`${url}?${params.toString()}`, {
    method: "GET",
    headers: headers(),
  });
  
  const json: BubbleListResponse<SpotPose> = await res.json();
  return json?.response?.results ?? [];
}
```

#### 3. Persona 중복 제거
```typescript
export async function getPersonasByTourAndSpot(
  tourId: number,
  spotId: number
): Promise<string[]> {
  const allPoses = await getSpotPosesByFilters(tourId, spotId);
  
  // persona 중복 제거
  const uniquePersonas = Array.from(
    new Set(
      allPoses
        .map((pose) => pose.persona)
        .filter((p): p is string => !!p)
    )
  );
  
  console.log(`📋 [Bubble] Found ${uniquePersonas.length} unique personas:`, uniquePersonas);
  
  return uniquePersonas;
}
```

---

### app/cheiz/reserve/page.tsx (핵심 로직)

#### 1. 이미지 URL 정규화
```typescript
function normalizeImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url; // 이미 완전한 URL
  }
  
  if (url.startsWith('//')) {
    return `https:${url}`; // ✅ https: 접두사 추가
  }
  
  return url;
}
```

#### 2. Spot 선택 시 동적 Persona 로드
```typescript
const handleSpotSelect = async (spot: Spot) => {
  setSelectedSpot(spot);
  
  // ✅ Step 1: 동적으로 Persona 목록 로드
  const personaResponse = await fetch(
    `/api/bubble/personas/${tourId}/${spot.spot_Id}`
  );
  
  const personaData = await personaResponse.json();
  const loadedPersonas = personaData.personas || ["전체"];
  setPersonas(loadedPersonas);
  
  // ✅ Step 2: 포즈 목록 가져오기 (tourId + spotId)
  const params = new URLSearchParams();
  params.append("tourId", String(tourId));
  
  const response = await fetch(
    `/api/bubble/spot-poses-by-spot/${spot.spot_Id}?${params.toString()}`
  );
  
  const data = await response.json();
  setPoses(data.poses || []);
};
```

#### 3. Persona 필터 변경 시
```typescript
useEffect(() => {
  if (selectedSpot && selectedSpot.spot_Id && tourId) {
    const params = new URLSearchParams();
    params.append("tourId", String(tourId)); // ✅ tour_Id 조건
    if (selectedPersona !== "전체") {
      params.append("persona", selectedPersona); // ✅ persona 조건
    }

    const response = await fetch(
      `/api/bubble/spot-poses-by-spot/${selectedSpot.spot_Id}?${params.toString()}`
      // ✅ spot_Id 조건
    );
    
    const data = await response.json();
    setPoses(data.poses || []);
  }
}, [selectedPersona]);
```

---

## 🧪 테스트 가이드

### 1. 예약 리스트에서 선택

1. `/cheiz/my-tours` 페이지에서 예약 카드 클릭
2. `/cheiz/reserve?tour_id=123` 페이지로 이동
3. **콘솔 확인**:
   ```
   📋 [Reserve] Tour ID: 123
   ```

---

### 2. SPOT 목록 확인

**콘솔**:
```
📋 [Bubble API] Fetching spots for tour 123
✅ [Bubble API] Found 5 spots
```

**UI**: 5개의 스팟 카드 표시 (spot_name, thumbnail)

---

### 3. Spot 선택

1. 스팟 카드 클릭 (예: "강남역")
2. **콘솔 확인**:
   ```
   📋 [Reserve] Fetching personas for tour 123, spot 456
   ✅ [Reserve] Loaded 4 personas: ["전체", "1인", "2인", "커플"]
   
   📋 [Reserve] Fetching poses with filters: tourId=123, spotId=456, persona=전체
   ✅ [Reserve] Loaded 15 poses
   ```
3. **UI**: 
   - Persona 필터 버튼: ["전체", "1인", "2인", "커플"]
   - 포즈 그리드: 15개 이미지

---

### 4. Persona 필터 변경

1. "커플" 버튼 클릭
2. **콘솔 확인**:
   ```
   📋 [Reserve] Refetching poses with persona filter: 커플
   
   [Bubble API] GET Request
   📍 Targeting Bubble Test DB: .../Spot_pose?constraints=[...]
   Constraints:
     - tour_Id = 123
     - spot_Id = 456
     - persona = "커플"
   
   ✅ [Reserve] Loaded 8 poses for persona 커플
   ```
3. **UI**: 8개의 "커플" 포즈만 표시

---

### 5. 이미지 정규화 확인

**콘솔**:
```
🔍 [Image] Original URL: //s3.amazonaws.com/appforest.../image.jpg
✅ [Image] Normalized URL: https://s3.amazonaws.com/appforest.../image.jpg
```

---

## 📊 API 체인 정리

### 사용자 플로우
```
1. 예약 선택 (/cheiz/my-tours)
     ↓
2. 포즈 선택 페이지 진입 (/cheiz/reserve?tour_id=123)
     ↓
3. SPOT 목록 조회
   GET /api/bubble/spots/123
     ↓ (Bubble)
   GET .../api/1.1/obj/SPOT?constraints=[{"key":"Tour_ID","value":123}]
     ↓
4. 스팟 선택 (예: spot_Id=456)
     ↓
5-1. Persona 목록 조회
   GET /api/bubble/personas/123/456
     ↓ (Bubble)
   GET .../api/1.1/obj/Spot_pose?constraints=[
     {"key":"tour_Id","value":123},
     {"key":"spot_Id","value":456}
   ]
     ↓
   중복 제거: ["1인", "2인", "커플"]
     ↓
   반환: ["전체", "1인", "2인", "커플"]
     ↓
5-2. 포즈 목록 조회
   GET /api/bubble/spot-poses-by-spot/456?tourId=123
     ↓ (Bubble)
   GET .../api/1.1/obj/Spot_pose?constraints=[
     {"key":"tour_Id","value":123},
     {"key":"spot_Id","value":456}
   ]
     ↓
6. Persona 필터 선택 (예: "커플")
     ↓
7. 포즈 재조회
   GET /api/bubble/spot-poses-by-spot/456?tourId=123&persona=커플
     ↓ (Bubble)
   GET .../api/1.1/obj/Spot_pose?constraints=[
     {"key":"tour_Id","value":123},
     {"key":"spot_Id","value":456},
     {"key":"persona","value":"커플"}
   ]
     ↓
8. 포즈 선택 (클릭으로 선택/해제)
     ↓
9. 최종 저장
   POST /api/v1/orders
     ↓
   Body: {
     "tour_id": "123",
     "selected_pose_ids": ["pose_id_1", "pose_id_2", ...],
     "user_id": "2",
     "timestamp": "2026-02-11T..."
   }
```

---

## ✅ 최종 체크리스트

### SPOT 테이블 연동
- [x] `Tour_ID` (대문자) 필터 사용
- [x] `getSpotsByTourId(tourId)` 구현
- [x] API 라우트: `/api/bubble/spots/[tourId]`
- [x] UI: spot_name, thumbnail 표시

### Spot_pose 테이블 연동
- [x] `tour_Id` (소문자 i) 필터 사용
- [x] `spot_Id` (언더스코어) 필터 사용
- [x] `getSpotPosesByTourId(tourId)` 구현
- [x] `getSpotPosesByFilters(tourId, spotId, persona)` 구현
- [x] API 라우트: `/api/bubble/spot-poses-by-spot/[spotId]` (tourId 파라미터 추가)

### UI 상태 관리
- [x] `personas` 상태 (동적 로드)
- [x] `selectedSpot` 상태 (클릭한 스팟 저장)
- [x] `selectedPersona` 상태 (클릭한 페르소나 저장)
- [x] `selectedPoses` 상태 (선택된 포즈들 Set)

### Persona 동적 로드
- [x] Spot 선택 시 Persona 목록 로드
- [x] `getPersonasByTourAndSpot(tourId, spotId)` 구현
- [x] API 라우트: `/api/bubble/personas/[tourId]/[spotId]`
- [x] 중복 제거 로직
- [x] "전체" 옵션 자동 추가

### 최종 이미지 렌더링
- [x] 3가지 AND 조건 필터링 (tour_Id, spot_Id, persona)
- [x] Bubble API constraints 정확히 매핑
- [x] 이미지 URL 정규화 (`https:` 접두사 추가)
- [x] 선택/해제 UI (클릭 토글)

### 타입 및 필드명
- [x] `Tour_ID` (대문자) vs `tour_Id` (소문자) 구분
- [x] `spot_Id` (언더스코어) 정확히 사용
- [x] Number 타입 보장 (constraints value)

---

## 🎯 핵심 성과

### ✅ Bubble DB 구조 정확 매핑
- SPOT: `Tour_ID` (대문자)
- Spot_pose: `tour_Id` (소문자), `spot_Id` (언더스코어)

### ✅ 동적 Persona 필터링
- 선택된 tourId + spotId 조합에 따라 persona 자동 추출
- 중복 제거 후 UI에 표시

### ✅ 3가지 AND 조건 완벽 구현
- tour_Id === 현재 투어
- spot_Id === 사용자 선택 스팟
- persona === 사용자 선택 페르소나

### ✅ 이미지 처리 완벽화
- https: 접두사 자동 추가
- 완전한 URL은 그대로 유지
- 상대 경로 지원

---

## 🎉 완료!

**SPOT & Spot_pose 통합 연동이 완벽하게 구현되었습니다!** 🛠️

**테스트 방법**:
1. 예약 리스트에서 투어 선택
2. 스팟 카드 클릭
3. Persona 필터 버튼 확인 (동적 로드)
4. Persona 클릭하여 포즈 필터링 확인
5. 포즈 선택 후 최종 저장

**콘솔에서 확인**:
```
📋 [Reserve] Loaded 4 personas: ["전체", "1인", "2인", "커플"]
✅ [Reserve] Loaded 8 poses for persona 커플
```
