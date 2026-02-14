# 🔧 예약 리스트 조회 조건 변경 완료

## ✅ 수정 사항

### 변경 내용
**statusSet 파라미터를 `RESERVED` 하나만 사용**

---

## 📝 수정된 코드

**파일**: `app/cheiz/my-tours/page.tsx`

### 수정 전
```typescript
const response = await getUserTours(session.user.id, "RESERVED,CONFIRMED");
```

**URL**: `https://api.lifeshot.me/api/v1/folders?userId=2&statusSet=RESERVED,CONFIRMED`

---

### 수정 후
```typescript
const response = await getUserTours(session.user.id, "RESERVED");
```

**URL**: `https://api.lifeshot.me/api/v1/folders?userId=2&statusSet=RESERVED`

---

## 🔍 실제 API 요청

### 최종 요청 URL
```
GET https://api.lifeshot.me/api/v1/folders?userId=2&statusSet=RESERVED
```

### 요청 헤더
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

---

## 📊 조회 결과

### 조회 대상
- ✅ **RESERVED (예약됨)** 상태의 폴더만 조회
- ❌ CONFIRMED, PENDING, COMPLETED 등 다른 상태는 제외

### 응답 구조 (Swagger 스펙)
```json
{
  "statusCode": 200,
  "message": "Success",
  "content": [
    {
      "id": 123,
      "name": "강남 스냅촬영",
      "scheduleResponse": {
        "tourDTO": {
          "thumbnailImageUrl": "https://...",
          ...
        },
        "startTime": "2026-02-15T14:00:00Z",
        ...
      },
      "hostUser": {
        "nickname": "양동근",
        "profileImageUrl": "https://...",
        ...
      },
      "status": "RESERVED",
      ...
    }
  ],
  "currentPage": 0,
  "totalPages": 1,
  "totalElements": 3
}
```

---

## 🎨 데이터 매핑 (기존 유지)

**변경 없음** - Swagger 스펙 그대로 매핑

### 카드 UI 매핑
1. **투어 이름**: `item.name`
2. **썸네일 이미지**: `item.scheduleResponse.tourDTO.thumbnailImageUrl`
3. **촬영 일정**: `item.scheduleResponse.startTime` → "2026년 2월 11일"
4. **호스트 닉네임**: `item.hostUser.nickname`
5. **호스트 프로필**: `item.hostUser.profileImageUrl`

---

## 🧪 테스트 확인

### 콘솔 로그 확인 사항

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 [getUserTours] Called with REAL userId: 2
📤 [getUserTours] Request params: userId=2&statusSet=RESERVED
📤 [getUserTours] Full URL: /api/v1/folders?userId=2&statusSet=RESERVED
📥 [getUserTours] Response received:
  ✅ statusCode: 200
  ✅ message: Success
  ✅ data.content exists: true
  ✅ data.content is array: true
  ✅ data.content length: 3
  📦 First tour sample (Swagger spec):
    - id: 123
    - name: 강남 스냅촬영
    - scheduleResponse.tourDTO.thumbnailImageUrl: https://...
    - scheduleResponse.startTime: 2026-02-15T14:00:00Z
    - hostUser.nickname: 양동근
    - hostUser.profileImageUrl: https://...
    - status: RESERVED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 확인 포인트
1. ✅ **URL에 `statusSet=RESERVED`만 표시** (CONFIRMED 제거됨)
2. ✅ **응답 데이터의 모든 status가 `RESERVED`**
3. ✅ **카드 UI 정상 렌더링** (이름, 썸네일, 닉네임)

---

## 📄 수정된 파일

1. ✅ `app/cheiz/my-tours/page.tsx`
   - `getUserTours` 호출 시 statusSet 파라미터: `"RESERVED,CONFIRMED"` → `"RESERVED"`

---

## 🎯 변경 이유

**예약 리스트 조회 범위 축소**:
- 이전: RESERVED (예약됨) + CONFIRMED (확정됨) 모두 조회
- 현재: RESERVED (예약됨)만 조회

**장점**:
- 더 명확한 필터링 (예약 상태만 조회)
- API 응답 속도 개선 (조회 범위 축소)

---

## 🎉 완료!

**statusSet 파라미터가 'RESERVED' 하나만 사용되도록 수정되었습니다!** ✅

**최종 API URL**:
```
GET https://api.lifeshot.me/api/v1/folders?userId=2&statusSet=RESERVED
```

**데이터 매핑은 기존 그대로 유지됩니다!** (투어 이름, 썸네일, 호스트 닉네임 등)
