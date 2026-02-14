# 🚀 버블 왕국 통합 가이드 (빠른 시작)

## 📋 필수 작업 (형님이 해야 할 것)

### 1. folderId 전달하기

#### my-tours 페이지에서
```typescript
// 투어 목록에서 포즈 선택하기 버튼 클릭 시
router.push(`/cheiz/reserve/spots?tour_id=${tourId}&folder_id=${folderId}`);

// 또는
<Link href={`/cheiz/reserve/spots?tour_id=${tour.id}&folder_id=${tour.folderId}`}>
  포즈 선택하기
</Link>
```

**중요**: folderId를 URL에 포함시켜야 합니다!

---

## 🧪 테스트 방법

### 1. folderId 확인

브라우저 개발자 도구 콘솔에서:
```
📁 [FOLDER ID] Obtained from URL: 123
```

이 로그가 보여야 합니다.

### 2. 예약 프로세스 확인

콘솔에서 다음 순서로 로그 확인:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏰 [BUBBLE KINGDOM] Starting reservation process
📁 Folder ID (출입증): 123
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏰 [STEP 1] Creating pose_reservation...
✅ [STEP 1] pose_reservation created!
🆔 Bubble Reservation ID: 1703xxx

🏰 [STEP 2] Creating reserved_pose records...
📸 [STEP 2] Total poses to save: 10

✅✅✅ [BUBBLE KINGDOM] Reservation completed!
🆔 Reservation ID: 1703xxx
📸 Poses created: 10
```

### 3. 버블 DB 확인

버블 대시보드에서:
1. pose_reservation 테이블 확인
2. reserved_pose 테이블 확인
3. folder_Id가 제대로 저장되었는지 확인

---

## 🐛 문제 발생 시

### "Folder ID를 확인할 수 없습니다" 에러

#### 원인
```
folderId가 URL에 없거나, Zustand store에 없음
```

#### 해결
```typescript
// URL 확인
console.log("URL:", window.location.href);
// 출력: /cheiz/reserve/review?tour_id=123&folder_id=456

// Store 확인
console.log("Store folderId:", useReservationStore.getState().folderId);
```

### 버블 API 에러

#### 확인 사항
1. 환경 변수 설정 확인
2. 버블 API 토큰 유효성 확인
3. 테이블 이름 확인 (pose_reservation, reserved_pose)

---

## 📱 QR 코드 테스트

### 1. 예약 완료 후 QR 확인

모달에 QR 코드가 표시되어야 합니다.

### 2. QR 데이터 확인

콘솔에서:
```
📱 [QR CODE GENERATION]
QR Data URL: http://localhost:3000/photographer/scan?reservation_id=1703xxx
```

### 3. 포토그래퍼 스캔 페이지 (추후 구현)

```
/photographer/scan?reservation_id=1703xxx
```

이 URL로 접근하여 예약 정보 조회

---

## ✅ 체크리스트

### 배포 전
- [ ] folderId 전달 로직 구현
- [ ] 로컬 테스트 (folderId 포함)
- [ ] 버블 DB에 데이터 확인
- [ ] QR 코드 생성 확인
- [ ] 콘솔 로그 확인

### 프로덕션
- [ ] 환경 변수 설정
- [ ] 버블 API 토큰 유효성
- [ ] QR 스캔 페이지 구현
- [ ] 에러 모니터링 설정

---

## 🎯 핵심 포인트

1. **folderId는 필수**: URL 또는 props로 전달
2. **2단계 저장**: pose_reservation → reserved_pose
3. **버블 ID 사용**: QR 코드에 버블 reservation_id
4. **자바 API 없음**: 401 에러 걱정 없음

---

## 📞 문제 발생 시

콘솔 로그를 확인하고:
- 🏰 [BUBBLE KINGDOM] 로그 찾기
- ❌ 에러 메시지 확인
- 📁 folderId 값 확인

형님, 이제 버블 왕국이 완성되었습니다! 🎉
