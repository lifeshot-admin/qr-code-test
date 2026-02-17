"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CameraScanner, type ScanMode } from "@/components/CameraScanner";
import type { PoseGuideItem } from "@/lib/bubble-api";

const SESSION_KEY = "chiiz_session_count";

/**
 * Canvas API를 사용한 이미지 압축 유틸리티
 * - 최대 너비: MAX_WIDTH px 기준으로 비율 유지 축소
 * - JPEG 품질: 0.7 (약 70%)
 * - 목표 크기: TARGET_SIZE_MB 이하
 * - 목표 초과 시 품질을 단계적으로 낮춰 재시도
 */
const MAX_WIDTH = 2000;
const INITIAL_QUALITY = 0.7;
const TARGET_SIZE_BYTES = 3 * 1024 * 1024; // 3MB

async function compressImage(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;

        // 최대 너비 기준으로 비율 유지 축소
        if (width > MAX_WIDTH) {
          const ratio = MAX_WIDTH / width;
          width = MAX_WIDTH;
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context 생성 실패"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        // 품질을 단계적으로 낮추며 목표 크기 이하로 압축
        let quality = INITIAL_QUALITY;
        let result = canvas.toDataURL("image/jpeg", quality);

        while (result.length > TARGET_SIZE_BYTES * 1.37 && quality > 0.1) {
          // base64는 원본 대비 ~37% 더 크므로 1.37 배수로 비교
          quality -= 0.1;
          result = canvas.toDataURL("image/jpeg", quality);
        }

        console.log(
          `📸 [압축] ${img.width}x${img.height} → ${width}x${height}, ` +
          `품질=${quality.toFixed(1)}, 크기≈${(result.length / 1024 / 1024).toFixed(2)}MB`
        );
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("이미지 로드 실패"));
    img.src = dataUrl;
  });
}

/**
 * reservation ID 정제: URL이나 오염된 문자열에서 순수 Bubble ID만 추출
 * Bubble ID 패턴: 숫자x숫자 (예: 1770970192790x949294031157361000)
 * 
 * 처리 가능 입력:
 *  - "https://...?reservation_id=1770970192790x949294031157361000"
 *  - "1770970192790x949294031157361000" (이미 깨끗한 ID)
 *  - "MANUAL_1770970192790x949294031157361000"
 */
function extractReservationId(raw: string): string {
  if (!raw) return raw;
  // 1) reservation_id= 파라미터에서 추출
  const paramMatch = raw.match(/reservation_id=(\d+x\d+)/);
  if (paramMatch) return paramMatch[1];
  // 2) 베어 Bubble ID 패턴 추출
  const idMatch = raw.match(/(\d{13,}x\d{13,})/);
  if (idMatch) return idMatch[1];
  // 3) MANUAL_ 접두사 제거
  return raw.replace(/^MANUAL_/, "");
}

function getSessionCount(): number {
  if (typeof window === "undefined") return 0;
  return parseInt(localStorage.getItem(SESSION_KEY) || "0", 10);
}

function incrementSessionCount(): void {
  const n = getSessionCount() + 1;
  localStorage.setItem(SESSION_KEY, String(n));
}

export function PhotographerApp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = searchParams.get("page") || "scan";
  const reservationParam = searchParams.get("reservation");

  const [reservationId, setReservationId] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<ScanMode>("qr");
  const [authPhotoDataUrl, setAuthPhotoDataUrl] = useState<string | null>(null);
  const [poseGuides, setPoseGuides] = useState<PoseGuideItem[]>([]);
  const [poseLoading, setPoseLoading] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [shootStarted, setShootStarted] = useState(false);

  // QR 인식 확인 모달 상태
  const [showQrConfirmModal, setShowQrConfirmModal] = useState(false);
  const [qrReservationInfo, setQrReservationInfo] = useState<{
    id: string;
    nickname: string;
    tourName: string;
    tourThumbnail: string;
    scheduleTime: string;
  } | null>(null);
  const [qrInfoLoading, setQrInfoLoading] = useState(false);

  useEffect(() => {
    setSessionCount(getSessionCount());
  }, []);

  useEffect(() => {
    if (reservationParam) setReservationId(reservationParam);
    if (page === "scan") {
      setReservationId(null);
      setAuthPhotoDataUrl(null);
      setShootStarted(false);
    }
  }, [page, reservationParam]);

  // ==================== 라우팅 헬퍼 (경로: /photographer) ====================

  const goTo = useCallback(
    (nextPage: string, reservation?: string) => {
      const q = new URLSearchParams();
      q.set("page", nextPage);
      if (reservation) q.set("reservation", reservation);
      router.push(`/photographer?${q.toString()}`);
    },
    [router]
  );

  // ==================== QR 스캔 성공 → 예약 정보 확인 모달 ====================

  const handleQRSuccess = useCallback(
    async (id: string, _rawUrl: string) => {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🚀 [QR 스캔 성공]");
      console.log(`📋 원본 QR 데이터: ${_rawUrl}`);
      console.log(`📋 추출된 pose_reservation_id: ${id}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      setReservationId(id);
      setQrInfoLoading(true);
      setShowQrConfirmModal(true);

      // 예약 정보 조회 시도 (실패해도 모달은 표시)
      try {
        const res = await fetch(`/api/bubble/reservation/${id}`);
        if (res.ok) {
          const data = await res.json();
          const info = data.data || data;
          setQrReservationInfo({
            id,
            nickname: info.nickname || info.user_nickname || info._user_nickname || "고객님",
            tourName: info.tour_name || info.tourName || "투어",
            tourThumbnail: info.tour_thumbnail || info.tourThumbnail || "",
            scheduleTime: info.schedule_time || info.tour_date || info.scheduleTime || "",
          });
        } else {
          setQrReservationInfo({ id, nickname: "고객님", tourName: "투어", tourThumbnail: "", scheduleTime: "" });
        }
      } catch {
        setQrReservationInfo({ id, nickname: "고객님", tourName: "투어", tourThumbnail: "", scheduleTime: "" });
      } finally {
        setQrInfoLoading(false);
      }
    },
    []
  );

  // QR 확인 모달 → 인증사진 촬영 진행
  const confirmQrAndProceed = useCallback(() => {
    setShowQrConfirmModal(false);
    if (reservationId) {
      goTo("auth", reservationId);
    }
  }, [reservationId, goTo]);

  // QR 확인 모달 → 취소 (다시 스캔)
  const cancelQrConfirm = useCallback(() => {
    setShowQrConfirmModal(false);
    setQrReservationInfo(null);
    setReservationId(null);
  }, []);

  const handleManualCapture = useCallback(
    (id: string, _imageDataUrl: string) => {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🚀 [수동 캡처 성공]");
      console.log(`📋 추출된 ID: ${id}`);
      console.log(`📷 이미지 크기: ${(_imageDataUrl.length / 1024 / 1024).toFixed(2)}MB`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      setReservationId(id);
      navigator.vibrate?.(200);
      setTimeout(() => goTo("auth", id), 100);
    },
    [goTo]
  );

  // ==================== 인증사진 촬영 ====================

  const handleAuthCapture = useCallback((imageDataUrl: string) => {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📸 [인증사진 촬영 완료]");
    console.log(`📋 데이터 헤더: ${imageDataUrl.substring(0, 50)}...`);
    console.log(`📋 원본 크기: ${(imageDataUrl.length / 1024 / 1024).toFixed(2)}MB`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    setAuthPhotoDataUrl(imageDataUrl);
    setShowUploadModal(true);
  }, []);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showRetakeModal, setShowRetakeModal] = useState(false);

  const confirmUpload = useCallback(async () => {
    setShowUploadModal(false);
    if (!reservationId || !authPhotoDataUrl) {
      console.warn("⚠️ [업로드 중단] reservationId 또는 authPhotoDataUrl 없음");
      return;
    }

    // ✅ ID 정제: URL이 섞여있으면 순수 Bubble ID만 추출
    const cleanId = extractReservationId(reservationId);

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🚀 [인증사진 업로드 시작]");
    console.log(`📋 원본 reservationId: ${reservationId}`);
    console.log(`📋 정제된 pose_reservation_id: ${cleanId}`);
    console.log(`📷 원본 이미지 크기: ${(authPhotoDataUrl.length / 1024 / 1024).toFixed(2)}MB`);

    try {
      // 서버 전송 전 Canvas API로 이미지 압축 (3MB 이하, JPEG 0.7, 최대 2000px)
      console.log("🔄 [압축 시작] Canvas API 압축 진행 중...");
      const compressedPhoto = await compressImage(authPhotoDataUrl);
      console.log(`✅ [압축 완료] 압축 후 크기: ${(compressedPhoto.length / 1024 / 1024).toFixed(2)}MB`);
      console.log(`📋 base64 헤더: ${compressedPhoto.substring(0, 50)}...`);

      // ✅ pose_reservation_id는 URL 경로용, body에는 auth_photo만
      const payload = JSON.stringify({
        pose_reservation_id: cleanId,
        auth_photo: compressedPhoto,
      });
      console.log(`📦 [전송 페이로드] 총 크기: ${(payload.length / 1024 / 1024).toFixed(2)}MB`);
      console.log("🌐 [요청] POST /api/bubble/auth-photo 전송 중...");

      const res = await fetch("/api/bubble/auth-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });

      console.log(`📡 [응답] HTTP ${res.status} ${res.statusText}`);

      if (!res.ok) {
        const errorBody = await res.text();
        console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.error("❌ [업로드 실패] 서버 응답 에러");
        console.error(`📋 HTTP 상태: ${res.status}`);
        console.error(`📋 응답 내용: ${errorBody}`);
        console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        throw new Error(`인증사진 업로드 실패 (HTTP ${res.status}): ${errorBody}`);
      }

      const responseData = await res.json();
      console.log("✅ [업로드 성공]", responseData);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      goTo("shoot", reservationId);
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.error("❌ [업로드 에러] catch 블록 진입");
      console.error(`📋 에러 메시지: ${errMsg}`);
      console.error(`📋 에러 스택:`, err?.stack || "(스택 없음)");
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      // 사용자에게 구체적 에러 메시지 표시
      if (errMsg.includes("502") || errMsg.includes("Bubble")) {
        alert("Bubble API 서버 연결 실패.\n환경 변수(BUBBLE_API_TOKEN, BUBBLE_API_BASE_URL)를 확인해주세요.");
      } else if (errMsg.includes("413") || errMsg.includes("too large")) {
        alert("이미지 파일이 너무 큽니다.\n다시 촬영해 주세요.");
      } else if (errMsg.includes("500")) {
        alert(`서버 내부 오류가 발생했습니다.\n(${errMsg.substring(0, 80)})`);
      } else {
        alert(`저장에 실패했습니다.\n${errMsg.substring(0, 100)}`);
      }
      setShowUploadModal(true);
    }
  }, [reservationId, authPhotoDataUrl, goTo]);

  const rejectUpload = useCallback(() => {
    setShowUploadModal(false);
    setAuthPhotoDataUrl(null);
  }, []);

  // ==================== 포즈 가이드 로드 ====================

  useEffect(() => {
    if (page === "shoot" && reservationId) {
      console.log(`🎯 [포즈 가이드] 로딩 시작 → reservationId: ${reservationId}`);
      setPoseLoading(true);
      fetch(`/api/bubble/pose-guides/${reservationId}`)
        .then((r) => {
          console.log(`📡 [포즈 가이드] 응답 HTTP ${r.status}`);
          return r.json();
        })
        .then((list: PoseGuideItem[]) => {
          const poses = Array.isArray(list) ? list : [];
          console.log(`✅ [포즈 가이드] ${poses.length}개 로드 완료`);
          setPoseGuides(poses);
        })
        .catch((err) => {
          console.error(`❌ [포즈 가이드] 로드 실패:`, err?.message || err);
          setPoseGuides([]);
        })
        .finally(() => setPoseLoading(false));
    }
  }, [page, reservationId]);

  // ==================== 인증사진 재촬영 ====================

  const confirmRetake = useCallback(() => {
    setShowRetakeModal(false);
    setAuthPhotoDataUrl(null);
    if (reservationId) goTo("auth", reservationId);
  }, [reservationId, goTo]);

  // ==================== 촬영 완료 ====================

  const completeSession = useCallback(async () => {
    if (typeof window === "undefined" || !reservationId) return;
    if (!window.confirm("촬영을 완료하고 다음 고객으로 넘어갈까요?")) return;

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🏁 [촬영 완료] 세션 종료 처리 시작");
    console.log(`📋 reservationId: ${reservationId}`);

    try {
      const res = await fetch(`/api/bubble/reservation/${reservationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Completed" }),
      });
      console.log(`📡 [촬영 완료] PATCH 응답: HTTP ${res.status}`);
      if (!res.ok) {
        const errorBody = await res.text();
        console.error(`❌ [촬영 완료] 상태 업데이트 실패: ${errorBody}`);
        throw new Error("상태 업데이트 실패");
      }
      incrementSessionCount();
      setSessionCount(getSessionCount());
      console.log("✅ [촬영 완료] 세션 정상 종료, 스캔 화면으로 이동");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      setReservationId(null);
      setAuthPhotoDataUrl(null);
      setPoseGuides([]);
      setShootStarted(false);
      goTo("scan");
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.error("❌ [촬영 완료] 에러 발생");
      console.error(`📋 에러: ${errMsg}`);
      console.error(`📋 스택:`, err?.stack || "(스택 없음)");
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      alert(`촬영 완료 저장에 실패했습니다.\n${errMsg.substring(0, 100)}`);
    }
  }, [reservationId, goTo]);

  // ==================== 모달 ====================

  const modals = (
    <>
      {/* QR 인식 확인 모달 */}
      {showQrConfirmModal && (
        <div className="fixed inset-0 bg-black/95 z-[9999] flex items-center justify-center flex-col p-5">
          <div className="bg-surface p-6 rounded-2xl max-w-[90%] w-full text-center">
            {qrInfoLoading ? (
              <div className="py-8 flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-white text-sm">예약 정보 확인 중...</p>
              </div>
            ) : (
              <>
                <div className="text-5xl mb-4">✅</div>
                <h3 className="text-xl font-bold text-white mb-2">
                  {qrReservationInfo?.nickname || "고객"}님이<br />인식되었습니다
                </h3>

                {/* 투어 정보 */}
                <div className="bg-white/10 rounded-xl p-4 mt-4 mb-5">
                  {qrReservationInfo?.tourThumbnail && (
                    <img
                      src={qrReservationInfo.tourThumbnail}
                      alt="투어 썸네일"
                      className="w-full h-32 object-cover rounded-lg mb-3"
                    />
                  )}
                  {qrReservationInfo?.tourName && (
                    <p className="text-white font-semibold text-sm mb-1">{qrReservationInfo.tourName}</p>
                  )}
                  {qrReservationInfo?.scheduleTime && (
                    <p className="text-muted text-xs">{qrReservationInfo.scheduleTime}</p>
                  )}
                  <p className="text-muted text-xs mt-1 font-mono break-all">
                    ID: {qrReservationInfo?.id?.substring(0, 20)}...
                  </p>
                </div>

                {/* 버튼: 취소(좌) | 인증사진 촬영(우) */}
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={cancelQrConfirm}
                    className="flex-1 py-3.5 rounded-xl font-semibold text-base bg-border text-white"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={confirmQrAndProceed}
                    className="flex-1 py-3.5 rounded-xl font-semibold text-base bg-accent text-white"
                  >
                    📸 인증사진 촬영
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 bg-black/95 z-[9999] flex items-center justify-center flex-col p-5">
          <div className="bg-surface p-6 rounded-2xl max-w-[90%] text-center">
            <h3 className="text-xl font-bold text-white mb-5">
              이 사진을 인증사진으로
              <br />
              업로드 하시겠습니까?
            </h3>
            {authPhotoDataUrl && (
              <img
                src={authPhotoDataUrl}
                alt="미리보기"
                className="max-w-full max-h-[300px] rounded-xl my-5 mx-auto"
              />
            )}
            <div className="flex gap-2.5 mt-4">
              <button
                type="button"
                onClick={rejectUpload}
                className="flex-1 py-3.5 rounded-xl font-semibold text-base bg-border text-white"
              >
                다시 촬영
              </button>
              <button
                type="button"
                onClick={confirmUpload}
                className="flex-1 py-3.5 rounded-xl font-semibold text-base bg-accent text-white"
              >
                네, 업로드
              </button>
            </div>
          </div>
        </div>
      )}
      {showRetakeModal && (
        <div className="fixed inset-0 bg-black/95 z-[9999] flex items-center justify-center flex-col p-5">
          <div className="bg-surface p-6 rounded-2xl max-w-[90%] text-center">
            <h3 className="text-xl font-bold text-white mb-5">
              인증사진을 다시 촬영하시겠습니까?
            </h3>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowRetakeModal(false)}
                className="flex-1 py-3.5 rounded-xl font-semibold text-base bg-border text-white"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmRetake}
                className="flex-1 py-3.5 rounded-xl font-semibold text-base bg-accent text-white"
              >
                네, 다시 촬영
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // ==================== RENDER: QR 스캔 ====================

  if (page === "scan") {
    return (
      <>
        <CameraScanner
          mode="scan"
          scanMode={scanMode}
          onScanModeChange={setScanMode}
          onQRSuccess={handleQRSuccess}
          onManualCapture={handleManualCapture}
          sessionCount={sessionCount}
        />
        {modals}
      </>
    );
  }

  // ==================== RENDER: Step 1 - 인증사진 촬영 ====================

  if (page === "auth") {
    return (
      <>
        <CameraScanner
          mode="auth"
          onAuthCapture={handleAuthCapture}
          showPortraitGuide
        >
          <button
            type="button"
            onClick={() => goTo("scan")}
            className="w-full py-4 rounded-[14px] text-[17px] font-bold bg-border text-primary"
          >
            ← 스캔으로 돌아가기
          </button>
        </CameraScanner>
        {modals}
      </>
    );
  }

  // ==================== RENDER: Step 2 - 포즈 리스트 + 촬영 시작 ====================

  if (page === "shoot") {
    return (
      <>
        <div className="h-screen flex flex-col bg-[#F2F2F7]">
          <div className="flex-1 overflow-y-auto px-5 py-5 pb-32">
            {/* 인증사진 */}
            <div className="bg-white rounded-2xl p-5 mb-5 text-center">
              <h2 className="text-[17px] font-bold text-black mb-4">📸 Step 1: 고객 인증사진</h2>
              {authPhotoDataUrl ? (
                <img
                  src={authPhotoDataUrl}
                  alt="인증사진"
                  className="w-[200px] h-[260px] rounded-xl object-cover border-[3px] border-primary mx-auto cursor-pointer"
                  onClick={() => setShowRetakeModal(true)}
                />
              ) : (
                <div className="w-[200px] h-[260px] rounded-xl bg-gray-200 flex items-center justify-center mx-auto">
                  <span className="text-gray-400 text-sm">사진 없음</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowRetakeModal(true)}
                className="w-full mt-4 py-3 bg-accent text-white rounded-xl font-semibold"
              >
                인증사진 다시 촬영하기
              </button>
            </div>

            {/* 포즈 리스트 */}
            <div className="bg-white rounded-2xl p-5">
              <h2 className="text-[17px] font-bold text-black mb-4">🎯 Step 2: 고객 선택 포즈</h2>

              {/* 로딩 상태 */}
              {poseLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
                  <span className="ml-3 text-gray-500 text-sm">포즈 불러오는 중...</span>
                </div>
              ) : (
                <>
                  <div className="bg-[#F5F5F5] py-3 px-4 rounded-xl mb-4 flex justify-between items-center">
                    <span className="text-sm font-semibold text-[#007AFF]">전체 포즈</span>
                    <span className="text-xl font-bold text-[#007AFF]">{poseGuides?.length || 0}개</span>
                  </div>

                  {(poseGuides?.length || 0) === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <p className="text-4xl mb-3">📭</p>
                      <p className="text-sm">선택된 포즈가 없습니다.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {poseGuides.map((pose, index) => (
                        <div
                          key={pose?.reservedPoseId || index}
                          className="relative rounded-xl overflow-hidden bg-black aspect-[3/4]"
                        >
                          {pose?.imageUrl ? (
                            <img
                              src={pose.imageUrl}
                              alt={`포즈 ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-800">
                              <span className="text-gray-500 text-sm">이미지 없음</span>
                            </div>
                          )}
                          <div className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center text-sm font-bold">
                            {index + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 하단 고정 버튼 */}
          <div className="fixed bottom-0 left-0 right-0 p-5 pt-8 bg-gradient-to-t from-white to-transparent space-y-2.5">
            {!shootStarted ? (
              <button
                type="button"
                onClick={() => setShootStarted(true)}
                disabled={poseLoading || (poseGuides?.length || 0) === 0}
                className="w-full py-4 bg-[#007AFF] text-white rounded-[14px] text-[17px] font-bold disabled:opacity-50"
              >
                📸 촬영 시작
              </button>
            ) : (
              <button
                type="button"
                onClick={completeSession}
                className="w-full py-4 bg-[#34C759] text-white rounded-[14px] text-[17px] font-bold"
              >
                ✅ 촬영 완료 - 다음 고객으로
              </button>
            )}
          </div>
        </div>
        {modals}
      </>
    );
  }

  // ==================== RENDER: 기존 confirm 페이지 (레거시 호환) ====================

  if (page === "confirm") {
    return (
      <>
        <div className="h-screen flex flex-col bg-surface">
          <div className="flex-1 flex flex-col items-center justify-center px-5 py-10">
            <div className="text-6xl mb-5 animate-pop">✅</div>
            <h1 className="text-2xl font-bold text-white mb-8">QR 코드 인식 완료</h1>
            <div className="w-full max-w-[400px] p-5 bg-primary/10 border-2 border-primary rounded-2xl mb-10">
              <div className="text-[13px] text-muted mb-2">인식된 예약 ID</div>
              <div className="text-lg font-bold text-primary break-all font-mono">
                {reservationId ?? "-"}
              </div>
            </div>
            <div className="flex flex-col gap-2.5 w-full max-w-[400px]">
              <button
                type="button"
                onClick={() => reservationId && goTo("auth", reservationId)}
                className="w-full py-4 rounded-[14px] text-[17px] font-bold bg-primary text-black"
              >
                ✓ 확인 - 인증사진 촬영하기
              </button>
              <button
                type="button"
                onClick={() => goTo("scan")}
                className="w-full py-4 rounded-[14px] text-[17px] font-bold bg-border text-white"
              >
                ↻ 다시 스캔하기
              </button>
            </div>
          </div>
        </div>
        {modals}
      </>
    );
  }

  // ==================== RENDER: 기본 (알 수 없는 페이지) ====================

  return (
    <div className="h-screen flex items-center justify-center bg-black">
      <button
        type="button"
        onClick={() => goTo("scan")}
        className="py-3 px-6 bg-primary text-black rounded-xl font-semibold"
      >
        스캔 화면으로
      </button>
    </div>
  );
}
