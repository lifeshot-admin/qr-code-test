# 🔍 빠른 디버깅 가이드 - 타임스탬프 로그 읽는 법

## 📖 로그 구조

### 타임스탬프 형식
```
[HH:mm:ss] [태그] 메시지
```

예시:
```
[07:25:30] 🏰 [BUBBLE KINGDOM] Starting reservation process
[07:25:31] ✅ [STEP 1] pose_reservation created!
```

---

## 🎯 핵심 로그 패턴

### 1. 파라미터 검증 (시작)
```
[07:25:30] 🏰 [BUBBLE KINGDOM] Starting reservation process
[07:25:30] 📦 [Parameters Validation]
[07:25:30]   📁 Folder ID (출입증): 11093 ✅
[07:25:30]   🎫 Tour ID: 30 ✅
[07:25:30]   👤 User ID: user123 ✅
[07:25:30]   📸 Total Poses: 10 ✅
```

✅ **정상**: 모든 파라미터에 ✅ 표시
❌ **비정상**: 값이 `undefined` 또는 `null`

---

### 2. STEP 1: Master Record (pose_reservation)

#### 성공 케이스
```
[07:25:30] 🏰 [STEP 1] Creating pose_reservation...
[07:25:30] 🔍 [FALLBACK] Trying endpoint: pose_reservation
[07:25:30] 📦 [BUBBLE API] Response status (pose_reservation): 404
[07:25:30] ⚠️ [FALLBACK] pose_reservation not found (404), trying next...
[07:25:30] 🔍 [FALLBACK] Trying endpoint: pose-reservation
[07:25:31] 📦 [BUBBLE API] Response status (pose-reservation): 200
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[07:25:31] ✨✨✨ [Endpoint Found] Real name is: pose-reservation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[07:25:31] ✅✅✅ [STEP 1] pose_reservation created!
[07:25:31] 🆔 Bubble Reservation ID: 1703xxx
```

#### 실패 케이스
```
[07:25:30] 🏰 [STEP 1] Creating pose_reservation...
[07:25:30] 🔍 [FALLBACK] Trying endpoint: pose_reservation
[07:25:30] ⚠️ [FALLBACK] pose_reservation not found (404), trying next...
[07:25:30] 🔍 [FALLBACK] Trying endpoint: pose-reservation
[07:25:30] ⚠️ [FALLBACK] pose-reservation not found (404), trying next...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[07:25:30] ❌❌❌ [FALLBACK FAILED] All endpoints failed!
[07:25:30] 🔍 Tried: pose_reservation, pose-reservation
```

**해결 방법**: 버블에서 `pose_reservation` 또는 `pose-reservation` 테이블의 API Slug 확인

---

### 3. STEP 2: Detail Records (reserved_pose)

#### 성공 케이스
```
[07:25:32] 🏰 [STEP 2] Creating reserved_pose records...
[07:25:32] 📸 [STEP 2] Total poses to save: 10
[07:25:32]   🔍 [FALLBACK] Trying endpoint: reserved_pose
[07:25:32]   📦 [BUBBLE API] Response status (reserved_pose): 404
[07:25:32]   ⚠️ [FALLBACK] reserved_pose not found (404), trying next...
[07:25:32]   🔍 [FALLBACK] Trying endpoint: reserved-pose
[07:25:32]   📦 [BUBBLE API] Response status (reserved-pose): 200
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[07:25:32]   ✨✨✨ [Endpoint Found] Real name is: reserved-pose
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[07:25:32]   ✅ [1/10] Created: 1704xxx
[07:25:33]   ✅ [2/10] Created: 1705xxx
[07:25:33]   ✅ [3/10] Created: 1706xxx
...
[07:25:35]   ✅ [10/10] Created: 1713xxx
[07:25:35] ✅✅✅ [BUBBLE] reserved_pose creation completed
[07:25:35]   Success: 10/10
[07:25:35]   Failed: 0/10
[07:25:35]   Used endpoint: reserved-pose
```

#### 부분 실패 케이스
```
[07:25:32] 🏰 [STEP 2] Creating reserved_pose records...
[07:25:32]   ✅ [1/10] Created: 1704xxx
[07:25:33]   ✅ [2/10] Created: 1705xxx
[07:25:33]   ❌ [3/10] Failed: Network error
[07:25:33]   ✅ [4/10] Created: 1706xxx
...
[07:25:35] ✅✅✅ [BUBBLE] reserved_pose creation completed
[07:25:35]   Success: 9/10
[07:25:35]   Failed: 1/10
[07:25:35] ⚠️ [WARNING] Some poses failed to save
```

**해결 방법**: 
- `Success` 수가 `Total poses`보다 적으면 일부 실패
- `Failed` 이유를 로그에서 확인 (Network error, 400, 401 등)

---

### 4. STEP 3: QR Code 생성

#### 성공 케이스
```
[07:25:35] 📱 [STEP 3] Generating QR code...
[07:25:35] 📱 [QR CODE GENERATION]
[07:25:35] 🔗 QR Data URL: http://localhost:3000/photographer/scan?reservation_id=1703xxx
[07:25:35] ✅ [QR CODE] Generated successfully
[07:25:35] 🎉 [SUCCESS] Showing success modal
[07:25:36] 🗑️ [STORE] Cleared after successful reservation
```

---

## 🕐 시간 흐름 파악

### 정상 타임라인
```
[07:25:30] → 시작 (파라미터 검증)
[07:25:30] → STEP 1 시작
[07:25:31] → STEP 1 완료 (1초 소요)
[07:25:32] → STEP 2 시작
[07:25:35] → STEP 2 완료 (3초 소요, 10개 저장)
[07:25:35] → STEP 3 시작 (QR 생성)
[07:25:35] → STEP 3 완료
[07:25:36] → Store 초기화
```

**총 소요 시간**: 약 6초

### 느린 케이스 (10초 이상)
```
[07:25:30] → 시작
[07:25:30] → STEP 1 시작
[07:25:38] → STEP 1 완료 (8초 소요 ⚠️)
```

**원인**:
- 버블 서버 응답 느림
- 네트워크 지연
- 여러 fallback 시도

**해결 방법**: 
- 버블 서버 상태 확인
- 네트워크 안정성 확인

---

## 🚨 에러 패턴

### 1. Folder ID 누락
```
[07:25:30] 📦 [Parameters Validation]
[07:25:30]   📁 Folder ID (출입증): undefined ❌
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[07:25:30] ❌❌❌ [CRITICAL] FOLDER ID MISSING!
```

**해결**: URL에 `folder_id` 파라미터 포함 확인
```
/cheiz/reserve/review?tour_id=30&folder_id=11093
```

---

### 2. Session 없음
```
[07:25:30] ❌ [SESSION] Missing session or user ID
```

**해결**: 
1. 로그아웃 후 다시 로그인
2. 세션 만료 확인

---

### 3. Bubble API 404 (모든 fallback 실패)
```
[07:25:30] ❌❌❌ [FALLBACK FAILED] All endpoints failed!
[07:25:30] 🔍 Tried: pose_reservation, pose-reservation
```

**해결**:
1. 버블 Data → Data types → `pose_reservation` 확인
2. Settings → API → Enable Data API ✅
3. API Slug 이름 확인:
   - `pose_reservation` (언더스코어)
   - `pose-reservation` (하이픈)

---

### 4. Bubble API 401 (인증 실패)
```
[07:25:30] 📦 [BUBBLE API] Response status (pose_reservation): 401
[07:25:30] ❌ [BUBBLE API] Error: Unauthorized
```

**해결**:
1. `.env` 파일에서 `BUBBLE_API_TOKEN` 확인
2. 버블에서 새 API Token 발급

---

## 🎯 로그 읽기 팁

### 1. 시작 시간 확인
```
[07:25:30] 🏰 [BUBBLE KINGDOM] Starting reservation process
```
→ 예약 시작 시간 기록

### 2. Endpoint 찾기
```
[07:25:31] ✨✨✨ [Endpoint Found] Real name is: pose-reservation
```
→ 성공한 엔드포인트 이름 확인

### 3. 예약 ID 확인
```
[07:25:31] 🆔 Bubble Reservation ID: 1703xxx
```
→ 버블 DB에서 이 ID로 레코드 확인 가능

### 4. 성공 여부 확인
```
[07:25:35] ✅✅✅ [BUBBLE KINGDOM] Reservation completed!
```
→ 모든 단계 성공

---

## 📊 로그 분석 체크리스트

### 예약 시작 전
- [ ] Folder ID 존재 ✅
- [ ] Tour ID 존재 ✅
- [ ] User ID 존재 ✅
- [ ] Total Poses > 0 ✅

### STEP 1 확인
- [ ] Endpoint 찾기 성공 (✨ [Endpoint Found])
- [ ] Reservation ID 생성 (🆔 Bubble Reservation ID)
- [ ] 응답 시간 < 5초

### STEP 2 확인
- [ ] Endpoint 찾기 성공 (✨ [Endpoint Found])
- [ ] Success count == Total poses
- [ ] Failed count == 0

### STEP 3 확인
- [ ] QR URL 생성 (🔗 QR Data URL)
- [ ] QR 이미지 생성 성공 (✅ [QR CODE])
- [ ] Success modal 표시 (🎉 [SUCCESS])

---

## 🛠️ 디버깅 명령어

### 브라우저 콘솔에서
```javascript
// 1. Zustand Store 확인
localStorage.getItem('cheiz-reservation-storage')

// 2. Session 확인
// DevTools > Application > Cookies > next-auth.session-token

// 3. URL 파라미터 확인
window.location.href
```

### 서버 터미널에서
```bash
# 실시간 로그 확인 (Next.js 개발 서버)
npm run dev

# 환경 변수 확인
echo $BUBBLE_API_TOKEN
echo $BUBBLE_API_BASE_URL
```

---

## 🎊 완료!

이제 로그만 보면 **어디서 무엇이 잘못되었는지** 5초 안에 파악 가능합니다! 🎉

**핵심 로그 3가지**:
1. `✨✨✨ [Endpoint Found]` - Slug 이름 확인
2. `🆔 Bubble Reservation ID` - 예약 ID 확인
3. `✅✅✅ [BUBBLE KINGDOM] Reservation completed!` - 성공 확인
