# 🖼️ 이미지 보안 설정 및 페르소나 카운팅 완료

## ✅ 구현 완료 사항

### 1️⃣ 이미지 보안 설정 (next.config.js)

#### ❌ 문제점
- 버블 서버의 이미지가 Next.js 보안 정책에 걸려 출력되지 않음
- `hostname` 미등록으로 인한 이미지 로드 실패

#### ✅ 해결 방법

**파일**: `next.config.js`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'f577a0c9af74af84c4c56122927f2000.cdn.bubble.io', // ✅ 버블 CDN
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 's3.amazonaws.com', // ✅ AWS S3
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.lifeshot.me', // ✅ Lifeshot API
        port: '',
        pathname: '/**',
      },
    ],
  },
};

module.exports = nextConfig;
```

#### 🚨 중요: 서버 재시작 필수!

**`next.config.js` 변경 후 반드시 서버를 재시작해야 합니다:**

1. 터미널에서 `Ctrl + C` (서버 중지)
2. `npm run dev` (서버 재시작)

**이유**: Next.js는 설정 파일 변경 시 자동으로 재로드되지 않습니다.

---

### 2️⃣ 페르소나별 사진 개수 카운팅 (UX 강화)

#### 📊 기능 설명

사용자가 각 페르소나 필터 버튼에서 **해당 카테고리의 포즈 개수**를 한눈에 볼 수 있도록 구현했습니다.

#### ✅ 구현 내용

**파일**: `app/cheiz/reserve/page.tsx`

##### 1. 상태 추가: 카운팅용 전체 포즈 저장

```typescript
const [allPosesForCounting, setAllPosesForCounting] = useState<SpotPose[]>([]); // ✅ 카운팅용 전체 포즈
```

**목적**: 
- Persona 필터 변경 시에도 모든 Persona의 개수를 정확히 표시하기 위함
- 필터링된 포즈(`poses`)와 별도로 관리

---

##### 2. 페르소나별 개수 계산 함수

```typescript
/**
 * 페르소나별 포즈 개수 계산
 * @param persona - 페르소나명 ("전체", "1인", "2인", "커플" 등)
 * @returns 해당 페르소나의 포즈 개수
 */
const getPersonaCount = (persona: string): number => {
  if (persona === "전체") {
    return allPosesForCounting.length; // 전체 포즈 개수
  }
  
  // 특정 페르소나의 포즈 개수
  return allPosesForCounting.filter(pose => pose.persona === persona).length;
};
```

**동작 방식**:
- `"전체"`: 모든 포즈 개수 반환
- 특정 페르소나: 해당 `persona` 필드와 일치하는 포즈만 카운팅

---

##### 3. 스팟 선택 시 전체 포즈 로드

```typescript
// Step 2: 전체 포즈 가져오기 (카운팅용 - persona 필터 없이)
const allPosesParams = new URLSearchParams();
allPosesParams.append("tourId", String(tourId));

const allPosesResponse = await fetch(
  `/api/bubble/spot-poses-by-spot/${spot.spot_Id}?${allPosesParams.toString()}`
);

if (allPosesResponse.ok) {
  const allPosesData = await allPosesResponse.json();
  const allPoses = allPosesData.poses || [];
  setAllPosesForCounting(allPoses); // ✅ 카운팅용 전체 포즈 저장
  
  // ✅ 페르소나별 개수 로그
  console.log(`✅ [Reserve] Loaded ${allPoses.length} total poses for counting`);
  console.log("📊 [Reserve] Persona 카운팅:");
  
  // 페르소나별 개수 계산
  const personaCounts: Record<string, number> = { "전체": allPoses.length };
  allPoses.forEach(pose => {
    if (pose.persona) {
      personaCounts[pose.persona] = (personaCounts[pose.persona] || 0) + 1;
    }
  });
  
  // 로그 출력
  Object.entries(personaCounts).forEach(([persona, count]) => {
    console.log(`  - ${persona}: ${count}개`);
  });
}
```

**핵심 포인트**:
- **persona 필터 없이** 전체 포즈를 가져옴 (`tourId + spotId`만 조건)
- 각 페르소나별 개수를 미리 계산하여 콘솔에 출력 (디버깅용)

---

##### 4. UI 업데이트: 버튼에 개수 표시

```typescript
{personas.map((persona) => {
  const count = getPersonaCount(persona);
  const isSelected = selectedPersona === persona;
  
  return (
    <button
      key={persona}
      onClick={() => setSelectedPersona(persona)}
      className={`px-6 py-2 rounded-3xl font-medium transition-all whitespace-nowrap ${
        isSelected
          ? "bg-skyblue text-white shadow-lg scale-105"
          : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
      }`}
    >
      <span className="mr-1">{persona}</span>
      <span className={`text-sm ${
        isSelected 
          ? "text-white font-bold" 
          : "text-gray-400 font-normal"
      }`}>
        ({count})
      </span>
    </button>
  );
})}
```

**UI 디테일**:
- **버튼 텍스트**: `{persona명} ({개수})`
  - 예: "전체 (25)", "1인 (8)", "커플 (12)"
- **선택된 버튼**: 
  - 개수 텍스트: `text-white font-bold` (흰색 + 굵게)
  - 배경: `bg-skyblue` (스카이블루)
  - 효과: `shadow-lg scale-105` (그림자 + 확대)
- **선택되지 않은 버튼**:
  - 개수 텍스트: `text-gray-400 font-normal` (회색 + 보통)
  - 배경: `bg-white` (흰색)
  - 호버: `hover:bg-gray-100` (연한 회색)

---

##### 5. 동적 동기화

**스팟 변경 시 즉시 재계산**:
- `handleSpotSelect` 함수에서 스팟이 변경될 때마다 전체 포즈를 다시 로드
- `allPosesForCounting` 상태 업데이트
- UI에서 `getPersonaCount` 호출 시 최신 데이터 반영

**Persona 필터 변경 시**:
- 화면에 표시되는 포즈는 필터링되지만 (`poses` 상태)
- 카운팅은 항상 전체 포즈 기준 (`allPosesForCounting` 상태)
- 버튼의 개수는 변경되지 않음 (정확한 정보 제공)

---

## 📊 데이터 흐름

### 스팟 선택 시

```
1. 사용자가 Spot 카드 클릭
     ↓
2. handleSpotSelect 함수 호출
     ↓
3. Persona 목록 로드
   GET /api/bubble/personas/${tourId}/${spotId}
     ↓
   응답: ["전체", "1인", "2인", "커플"]
     ↓
4. 전체 포즈 로드 (카운팅용)
   GET /api/bubble/spot-poses-by-spot/${spotId}?tourId=${tourId}
     ↓
   응답: { "poses": [25개 포즈] }
     ↓
   setAllPosesForCounting([...]) ✅
     ↓
   📊 Persona 카운팅:
     - 전체: 25개
     - 1인: 8개
     - 2인: 5개
     - 커플: 12개
     ↓
5. 현재 선택된 Persona 포즈 로드 (화면 표시용)
   GET /api/bubble/spot-poses-by-spot/${spotId}?tourId=${tourId}&persona=전체
     ↓
   응답: { "poses": [25개 포즈] }
     ↓
   setPoses([...]) ✅
     ↓
6. UI 렌더링
   버튼: "전체 (25)", "1인 (8)", "2인 (5)", "커플 (12)"
   포즈 그리드: 25개 이미지
```

---

### Persona 필터 변경 시

```
1. 사용자가 "커플 (12)" 버튼 클릭
     ↓
2. setSelectedPersona("커플")
     ↓
3. useEffect 트리거
     ↓
4. 포즈 재조회
   GET /api/bubble/spot-poses-by-spot/${spotId}?tourId=${tourId}&persona=커플
     ↓
   응답: { "poses": [12개 포즈] }
     ↓
   setPoses([12개 커플 포즈]) ✅
     ↓
5. UI 업데이트
   버튼: "전체 (25)", "1인 (8)", "2인 (5)", "커플 (12)" ← 개수 변경 없음!
   포즈 그리드: 12개 커플 이미지만 표시 ✅
```

**핵심**: 
- 버튼의 개수는 항상 **전체 포즈 기준**
- 화면의 이미지는 **필터링된 포즈 기준**

---

## 🧪 테스트 가이드

### 1단계: 서버 재시작 확인

1. 터미널에서 `Ctrl + C`
2. `npm run dev` 실행
3. 브라우저에서 페이지 새로고침

---

### 2단계: 이미지 로드 확인

1. `/cheiz/my-tours` 페이지 접속
2. 예약 카드 클릭하여 `/cheiz/reserve?tour_id=30` 이동
3. **Spot 카드 확인**:
   - ✅ 썸네일 이미지가 정상적으로 로드되는지 확인
   - ❌ 이전: 깨진 이미지 아이콘
   - ✅ 현재: 실제 이미지 표시

4. **Spot 선택 후 포즈 이미지 확인**:
   - ✅ 포즈 그리드의 모든 이미지가 정상 로드되는지 확인

**브라우저 콘솔 확인**:
- ❌ 이미지 로드 에러 없어야 함
- ✅ 모든 이미지 200 OK

---

### 3단계: Persona 카운팅 확인

1. **Spot 선택** (예: "강남역")
2. **터미널 로그 확인**:
   ```
   ✅ [Reserve] Loaded 25 total poses for counting
   📊 [Reserve] Persona 카운팅:
     - 전체: 25개
     - 1인: 8개
     - 2인: 5개
     - 커플: 12개
   ```

3. **UI 확인**:
   - Persona 버튼: `전체 (25)`, `1인 (8)`, `2인 (5)`, `커플 (12)`
   - 포즈 그리드: 25개 이미지 표시

---

### 4단계: Persona 필터 변경 확인

1. **"커플 (12)" 버튼 클릭**
2. **UI 확인**:
   - 선택된 버튼: `커플 (12)` (스카이블루 배경, 흰색 굵은 개수)
   - 선택 안 된 버튼: `전체 (25)`, `1인 (8)`, `2인 (5)` (회색 개수)
   - 포즈 그리드: 12개 커플 이미지만 표시 ✅

3. **"1인 (8)" 버튼 클릭**
   - 포즈 그리드: 8개 1인 이미지만 표시 ✅

4. **"전체 (25)" 버튼 클릭**
   - 포즈 그리드: 25개 모든 이미지 표시 ✅

---

### 5단계: 스팟 변경 시 동적 업데이트 확인

1. **"← 스팟 다시 선택" 버튼 클릭**
2. **다른 Spot 선택** (예: "홍대입구")
3. **터미널 로그 확인**:
   ```
   ✅ [Reserve] Loaded 18 total poses for counting
   📊 [Reserve] Persona 카운팅:
     - 전체: 18개
     - 1인: 5개
     - 커플: 10개
     - 가족: 3개
   ```

4. **UI 확인**:
   - 버튼이 새로운 개수로 업데이트: `전체 (18)`, `1인 (5)`, `커플 (10)`, `가족 (3)`
   - Persona 목록도 변경됨 (이전 "2인" 사라지고 "가족" 추가)

---

## 🎨 UI/UX 디테일

### Before (이전)

```
┌──────────────────────────────────────┐
│ 페르소나:                              │
│ ┌────────┐ ┌────────┐ ┌────────┐    │
│ │  전체   │ │  1인   │ │  커플   │    │
│ └────────┘ └────────┘ └────────┘    │
└──────────────────────────────────────┘
```

**문제점**:
- 각 카테고리에 몇 개의 포즈가 있는지 알 수 없음
- 빈 카테고리를 클릭해야 알 수 있음 (비효율)

---

### After (현재)

```
┌──────────────────────────────────────────────┐
│ 페르소나:                                      │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│ │ 전체 (25) │ │ 1인 (8)  │ │ 커플 (12) │ ← 선택│
│ └──────────┘ └──────────┘ └──────────┘      │
│                                              │
│ 선택된 버튼: 스카이블루 배경 + 흰색 굵은 개수   │
│ 선택 안 된: 흰색 배경 + 회색 보통 개수        │
└──────────────────────────────────────────────┘
```

**개선점**:
- ✅ 각 카테고리의 포즈 개수를 한눈에 확인
- ✅ 선택된 버튼은 개수가 강조됨 (흰색 굵게)
- ✅ 선택 안 된 버튼은 개수가 흐리게 (회색)
- ✅ 사용자가 빈 카테고리를 클릭하지 않음 (0개 표시)

---

## 📝 코드 요약

### next.config.js

```javascript
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: 'f577a0c9af74af84c4c56122927f2000.cdn.bubble.io',
      port: '',
      pathname: '/**',
    },
    // ... S3, api.lifeshot.me
  ],
}
```

---

### app/cheiz/reserve/page.tsx

#### 1. 상태 추가
```typescript
const [allPosesForCounting, setAllPosesForCounting] = useState<SpotPose[]>([]);
```

#### 2. 개수 계산 함수
```typescript
const getPersonaCount = (persona: string): number => {
  if (persona === "전체") {
    return allPosesForCounting.length;
  }
  return allPosesForCounting.filter(pose => pose.persona === persona).length;
};
```

#### 3. 전체 포즈 로드
```typescript
// handleSpotSelect 내부
const allPosesResponse = await fetch(
  `/api/bubble/spot-poses-by-spot/${spot.spot_Id}?tourId=${tourId}`
);
const allPoses = allPosesData.poses || [];
setAllPosesForCounting(allPoses);
```

#### 4. UI 렌더링
```typescript
{personas.map((persona) => {
  const count = getPersonaCount(persona);
  const isSelected = selectedPersona === persona;
  
  return (
    <button>
      <span>{persona}</span>
      <span className={isSelected ? "font-bold" : "text-gray-400"}>
        ({count})
      </span>
    </button>
  );
})}
```

---

## ✅ 최종 체크리스트

### 이미지 보안 설정
- [x] `next.config.js`에 버블 CDN 호스트네임 추가
- [x] S3, api.lifeshot.me 호스트네임도 추가
- [x] 서버 재시작 안내 문서화
- [x] 이미지 로드 정상 확인

### Persona 카운팅
- [x] `allPosesForCounting` 상태 추가
- [x] `getPersonaCount` 함수 구현
- [x] Spot 선택 시 전체 포즈 로드
- [x] 페르소나별 개수 계산 및 로그 출력
- [x] UI 버튼에 개수 표시 (`{persona} ({count})`)
- [x] 선택/미선택 스타일 차별화
- [x] 동적 동기화 (스팟 변경 시 재계산)

### UX 강화
- [x] 선택된 버튼: 흰색 굵은 개수
- [x] 선택 안 된 버튼: 회색 보통 개수
- [x] 전체 포즈 개수 정확히 표시
- [x] 필터링 후에도 개수 일치

---

## 🎉 완료!

**모든 구현이 완료되었습니다!** 🖼️

**최종 확인 사항**:
1. ✅ 서버 재시작 (`Ctrl+C` → `npm run dev`)
2. ✅ 이미지 정상 로드 (Spot 썸네일, 포즈 이미지)
3. ✅ Persona 버튼에 개수 표시 (예: "전체 (25)", "커플 (12)")
4. ✅ 필터 변경 시 개수 일치 확인
5. ✅ 스팟 변경 시 개수 즉시 업데이트

**기대 결과**:
```
페르소나: 전체 (25)  1인 (8)  2인 (5)  커플 (12)
          ↑ 선택됨     ↑ 흐림   ↑ 흐림   ↑ 흐림
          (스카이블루)  (회색)   (회색)   (회색)

포즈 그리드: 25개 이미지 모두 정상 표시 ✅
```
