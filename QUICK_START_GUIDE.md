# 🚀 V2 예약 시스템 빠른 시작 가이드

## 📋 구현 완료 체크리스트

### ✅ 핵심 기능

- [x] **Zustand 상태 관리**: 선택 상태 영구 보존
- [x] **라우팅 분리**: spots → poses → review
- [x] **검증 엔진**: 스팟별 + 투어 전체 검증
- [x] **리뷰 페이지**: 최종 확인 UI
- [x] **QR 코드**: 예약 완료 시 자동 생성
- [x] **인증**: 401 에러 해결 (accessToken 자동 주입)

---

## 🎯 사용자 플로우

```
1️⃣ /cheiz/reserve/spots?tour_id=123
   ↓ 스팟 선택
   
2️⃣ /cheiz/reserve/poses?tour_id=123&spot_id=456
   ↓ 포즈 선택 (페르소나 필터, 카운트 표시)
   ↓ "스팟 리스트로 돌아가기" (선택 상태 유지 ✅)
   
3️⃣ /cheiz/reserve/spots (다시)
   ↓ 다른 스팟 선택 가능
   ↓ "선택 내역 확인하기" 버튼 (검증 통과 시 활성화)
   
4️⃣ /cheiz/reserve/review?tour_id=123
   ↓ 스팟별 선택 내역 확인
   ↓ "포즈 예약하기" 버튼
   
5️⃣ 예약 완료 모달
   ✨ QR 코드 표시
   📋 예약 번호 표시
   🔗 "내 투어 보기" / "홈으로"
```

---

## 📁 주요 파일

### 1. 상태 관리 Store
```
lib/reservation-store.ts
```
- Zustand store with localStorage persistence
- Actions: addPose, removePose, isPoseSelected, etc.
- Validation helper functions

### 2. 페이지 컴포넌트
```
app/cheiz/reserve/spots/page.tsx     # 스팟 리스트
app/cheiz/reserve/poses/page.tsx     # 포즈 선택
app/cheiz/reserve/review/page.tsx    # 최종 리뷰 (신규)
```

### 3. API 라우트
```
app/api/v1/orders/route.ts           # 예약 제출 (인증 토큰 주입)
app/api/bubble/spot/[spotId]/route.ts # 스팟 정보
```

---

## 🔧 개발 환경 설정

### 1. 패키지 설치 확인
```bash
npm install zustand qrcode
npm install --save-dev @types/qrcode
```

### 2. 환경 변수 확인
```env
NEXT_PUBLIC_API_BASE_URL=https://api.lifeshot.me
BUBBLE_API_BASE_URL=...
BUBBLE_API_TOKEN=...
```

### 3. 개발 서버 실행
```bash
npm run dev
```

---

## 🧪 테스트 시나리오

### 기본 플로우 테스트

1. **스팟 선택**
   - [ ] 스팟 카드 클릭
   - [ ] 포즈 선택 페이지로 이동
   
2. **포즈 선택**
   - [ ] 페르소나 탭 클릭 (카운트 표시 확인)
   - [ ] 포즈 여러 개 선택
   - [ ] 최대 개수 초과 시 alert 확인
   - [ ] "스팟 리스트로 돌아가기" 클릭
   
3. **선택 상태 유지**
   - [ ] 스팟 리스트에서 선택 상태 확인 (✅ 또는 ⚠️)
   - [ ] "선택됨: n개" 표시 확인
   - [ ] 다른 스팟 선택하여 반복
   
4. **리뷰 페이지**
   - [ ] "선택 내역 확인하기" 버튼 클릭
   - [ ] 스팟별 선택 내역 확인
   - [ ] 검증 메시지 확인 (필요 시)
   - [ ] "포즈 예약하기" 버튼 클릭
   
5. **예약 완료**
   - [ ] QR 코드 생성 확인
   - [ ] 예약 번호 표시 확인
   - [ ] "내 투어 보기" 클릭

### 엣지 케이스 테스트

- [ ] 브라우저 새로고침 → 선택 상태 복원
- [ ] 브라우저 뒤로가기 → 정확한 내비게이션
- [ ] 최소 개수 미달 → 버튼 비활성화
- [ ] 최대 개수 초과 → alert + 추가 선택 차단
- [ ] 선택 없이 리뷰 페이지 접근 → 자동 리디렉션

---

## 🐛 문제 해결

### 1. 선택 상태가 사라짐
**해결**: Zustand store는 자동으로 localStorage에 저장됩니다.
```typescript
// 저장 키 확인
localStorage.getItem('cheiz-reservation-storage')
```

### 2. 401 MISSING_TOKEN 에러
**해결**: getServerSession이 정상 작동하는지 확인
```typescript
// app/api/v1/orders/route.ts
const session = await getServerSession();
console.log('Session:', session);
console.log('Token:', (session as any)?.accessToken);
```

### 3. QR 코드가 생성되지 않음
**해결**: qrcode 패키지 설치 확인
```bash
npm install qrcode @types/qrcode
```

### 4. 페르소나 카운트가 표시되지 않음
**해결**: getPersonaCount 함수 확인
```typescript
const getPersonaCount = (persona: string): number => {
  if (persona === "전체") return allPoses.length;
  return allPoses.filter((pose) => pose.persona === persona).length;
};
```

---

## 📊 상태 관리 구조

### Zustand Store 구조
```typescript
{
  tourId: number | null,
  tour: Tour | null,
  spots: Spot[],
  spotSelections: {
    [spotId: number]: {
      spotId: number,
      spotName: string,
      minCountLimit: number,
      selectedPoses: string[]  // pose IDs
    }
  }
}
```

### localStorage 키
```
cheiz-reservation-storage
```

### 저장되는 데이터
```json
{
  "state": {
    "tourId": 123,
    "spotSelections": {
      "456": {
        "spotId": 456,
        "spotName": "경복궁",
        "minCountLimit": 3,
        "selectedPoses": ["pose_1", "pose_2", "pose_3"]
      }
    }
  },
  "version": 0
}
```

---

## 🎨 UI/UX 가이드

### 버튼 텍스트

| 위치 | 버튼 텍스트 |
|------|------------|
| 스팟 리스트 | "선택 내역 확인하기 (n개)" |
| 포즈 선택 | "스팟 리스트로 돌아가기" |
| 리뷰 페이지 | "포즈 예약하기 (n개)" |
| 성공 모달 | "내 투어 보기" / "홈으로" |

### 색상 테마

- **Primary**: `#0EA5E9` (skyblue)
- **Success**: `#10B981` (green)
- **Warning**: `#F59E0B` (yellow/orange)
- **Error**: `#EF4444` (red)

### 아이콘

- ✅ 완료 (스팟 최소 개수 충족)
- ⚠️ 불완전 (스팟 최소 개수 미달)
- ✓ 선택됨 (포즈)
- ✨ 성공 (예약 완료)

---

## 📱 반응형 브레이크포인트

```css
/* Tailwind CSS 기준 */
sm: 640px   /* 모바일 */
md: 768px   /* 태블릿 */
lg: 1024px  /* 데스크탑 */
xl: 1280px  /* 대형 화면 */
```

### 그리드 레이아웃

| 화면 크기 | 스팟 리스트 | 포즈 갤러리 |
|-----------|-------------|-------------|
| 모바일    | 1열         | 2열         |
| 태블릿    | 2열         | 3열         |
| 데스크탑  | 3열         | 4열         |

---

## 🔐 보안 체크리스트

- [x] 세션 검증 (getServerSession)
- [x] 토큰 자동 주입 (Authorization header)
- [x] API 에러 핸들링
- [ ] CSRF 보호 (NextAuth.js 기본 제공)
- [ ] Rate limiting (추천)
- [ ] Input sanitization (추천)

---

## 🚀 배포 전 체크리스트

### 1. 환경 변수 설정
- [ ] NEXT_PUBLIC_API_BASE_URL
- [ ] BUBBLE_API_BASE_URL
- [ ] BUBBLE_API_TOKEN
- [ ] NEXTAUTH_SECRET
- [ ] NEXTAUTH_URL

### 2. 빌드 테스트
```bash
npm run build
npm run start
```

### 3. 성능 최적화
- [ ] 이미지 최적화 (Next.js Image)
- [ ] 번들 크기 확인
- [ ] Lighthouse 점수 확인

### 4. 크로스 브라우저 테스트
- [ ] Chrome
- [ ] Safari (iOS)
- [ ] Firefox
- [ ] Edge

---

## 📞 지원 및 문의

### 개발 문서
- Next.js: https://nextjs.org/docs
- Zustand: https://github.com/pmndrs/zustand
- QRCode.js: https://github.com/soldair/node-qrcode

### 주요 파일 위치
```
lib/reservation-store.ts         # 상태 관리
app/cheiz/reserve/review/page.tsx # QR 생성
app/api/v1/orders/route.ts       # 예약 API
```

---

## ✨ 완료!

V2 시스템이 완벽하게 구현되었습니다! 🎉

질문이나 문제가 있으면 위의 문제 해결 섹션을 참고하세요.
