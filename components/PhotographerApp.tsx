"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CameraScanner, type ScanMode } from "@/components/CameraScanner";
import type { PoseGuideItem } from "@/lib/bubble-api";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import imageCompression from "browser-image-compression";

const SESSION_KEY = "chiiz_session_count";

// ==================== 이미지 압축 유틸리티 ====================

async function compressImage(dataUrl: string): Promise<string> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const file = new File([blob], "photo.jpg", { type: blob.type || "image/jpeg" });

  const compressed = await imageCompression(file, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1280,
    useWebWorker: true,
    fileType: "image/jpeg",
  });

  console.log(
    `📸 [압축] 원본=${(file.size / 1024 / 1024).toFixed(2)}MB → ` +
    `결과=${(compressed.size / 1024 / 1024).toFixed(2)}MB`
  );

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("압축 이미지 변환 실패"));
    reader.readAsDataURL(compressed);
  });
}

// ==================== ID 정제 유틸리티 ====================

function extractReservationId(raw: string): string {
  if (!raw) return raw;
  const paramMatch = raw.match(/reservation_id=(\d+x\d+)/);
  if (paramMatch) return paramMatch[1];
  const idMatch = raw.match(/(\d{13,}x\d{13,})/);
  if (idMatch) return idMatch[1];
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

// ==================== 이미지 슬라이더 모달 ====================

function ImageSliderModal({
  images,
  initialIndex,
  onClose,
}: {
  images: { url: string; label: string }[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [direction, setDirection] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const goToSlide = useCallback(
    (newIndex: number, dir: number) => {
      if (newIndex < 0 || newIndex >= images.length) return;
      setDirection(dir);
      setCurrentIndex(newIndex);
    },
    [images.length]
  );

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const threshold = 50;
      if (info.offset.x < -threshold && currentIndex < images.length - 1) {
        goToSlide(currentIndex + 1, 1);
      } else if (info.offset.x > threshold && currentIndex > 0) {
        goToSlide(currentIndex - 1, -1);
      }
    },
    [currentIndex, images.length, goToSlide]
  );

  // 키보드 조작
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goToSlide(currentIndex - 1, -1);
      if (e.key === "ArrowRight") goToSlide(currentIndex + 1, 1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentIndex, goToSlide, onClose]);

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -300 : 300, opacity: 0 }),
  };

  return (
    <div
      className="fixed inset-0 bg-black/95 z-[10000] flex flex-col"
      onClick={onClose}
    >
      {/* 헤더: 카운터 + 닫기 */}
      <div className="flex items-center justify-between px-5 py-4 shrink-0">
        <span className="text-white/70 text-sm font-semibold">
          {currentIndex + 1} / {images.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white text-xl"
        >
          ✕
        </button>
      </div>

      {/* 슬라이더 영역 */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden px-4"
        onClick={(e) => e.stopPropagation()}
      >
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.3}
            onDragEnd={handleDragEnd}
            className="w-full max-w-[90vw] max-h-[70vh] flex items-center justify-center"
          >
            <img
              src={images[currentIndex].url}
              alt={images[currentIndex].label}
              className="max-w-full max-h-[70vh] object-contain rounded-xl select-none"
              draggable={false}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 라벨 */}
      <div className="text-center py-3 shrink-0">
        <span className="text-white font-semibold text-base">
          {images[currentIndex].label}
        </span>
      </div>

      {/* 좌우 화살표 (데스크톱 대비) */}
      {currentIndex > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); goToSlide(currentIndex - 1, -1); }}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 text-white text-2xl flex items-center justify-center"
        >
          ‹
        </button>
      )}
      {currentIndex < images.length - 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); goToSlide(currentIndex + 1, 1); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 text-white text-2xl flex items-center justify-center"
        >
          ›
        </button>
      )}
    </div>
  );
}

// ==================== 메인 컴포넌트 ====================

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
    reservationCode: string;
  } | null>(null);
  const [qrInfoLoading, setQrInfoLoading] = useState(false);

  // 이미지 슬라이더 모달 상태
  const [sliderOpen, setSliderOpen] = useState(false);
  const [sliderInitialIndex, setSliderInitialIndex] = useState(0);

  // "다음 고객으로" 확인 모달 상태
  const [showNextCustomerModal, setShowNextCustomerModal] = useState(false);
  const [nextCustomerLoading, setNextCustomerLoading] = useState(false);

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

  // ==================== 라우팅 헬퍼 ====================

  const goTo = useCallback(
    (nextPage: string, reservation?: string) => {
      const q = new URLSearchParams();
      q.set("page", nextPage);
      if (reservation) q.set("reservation", reservation);
      router.push(`/photographer?${q.toString()}`);
    },
    [router]
  );

  // ==================== QR 스캔 성공 ====================

  const handleQRSuccess = useCallback(
    async (id: string, _rawUrl: string) => {
      console.log("🚀 [QR 스캔 성공]", { raw: _rawUrl, extracted: id });
      setReservationId(id);
      setQrInfoLoading(true);
      setShowQrConfirmModal(true);

      try {
        const res = await fetch(`/api/bubble/reservation/${id}`);
        if (res.ok) {
          const data = await res.json();
          const info = data.data || data;
          setQrReservationInfo({
            id,
            nickname: info.nickname || info.user_nickname || "고객님",
            tourName: info.tour_name || info.tourName || "투어",
            tourThumbnail: info.tour_thumbnail || info.tourThumbnail || "",
            scheduleTime: info.schedule_time || info.tour_date || info.scheduleTime || "",
            reservationCode: info.Id || info.reservationCode || "",
          });
        } else {
          setQrReservationInfo({ id, nickname: "고객님", tourName: "투어", tourThumbnail: "", scheduleTime: "", reservationCode: "" });
        }
      } catch {
        setQrReservationInfo({ id, nickname: "고객님", tourName: "투어", tourThumbnail: "", scheduleTime: "", reservationCode: "" });
      } finally {
        setQrInfoLoading(false);
      }
    },
    []
  );

  const confirmQrAndProceed = useCallback(() => {
    setShowQrConfirmModal(false);
    if (reservationId) goTo("auth", reservationId);
  }, [reservationId, goTo]);

  const cancelQrConfirm = useCallback(() => {
    setShowQrConfirmModal(false);
    setQrReservationInfo(null);
    setReservationId(null);
  }, []);

  const handleManualCapture = useCallback(
    (id: string, _imageDataUrl: string) => {
      console.log("🚀 [수동 캡처 성공]", { id, sizeMB: (_imageDataUrl.length / 1024 / 1024).toFixed(2) });
      setReservationId(id);
      navigator.vibrate?.(200);
      setTimeout(() => goTo("auth", id), 100);
    },
    [goTo]
  );

  // ==================== 인증사진 촬영 ====================

  const handleAuthCapture = useCallback((imageDataUrl: string) => {
    console.log(`📸 [인증사진 촬영 완료] 크기: ${(imageDataUrl.length / 1024 / 1024).toFixed(2)}MB`);
    setAuthPhotoDataUrl(imageDataUrl);
    setShowUploadModal(true);
  }, []);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showRetakeModal, setShowRetakeModal] = useState(false);

  const confirmUpload = useCallback(async () => {
    setShowUploadModal(false);
    if (!reservationId || !authPhotoDataUrl) return;

    const cleanId = extractReservationId(reservationId);
    console.log("🚀 [인증사진 업로드 시작]", { cleanId });

    try {
      const compressedPhoto = await compressImage(authPhotoDataUrl);
      console.log(`✅ [압축 완료] ${(compressedPhoto.length / 1024 / 1024).toFixed(2)}MB`);

      const payload = JSON.stringify({
        pose_reservation_id: cleanId,
        auth_photo: compressedPhoto,
      });

      const res = await fetch("/api/bubble/auth-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`인증사진 업로드 실패 (HTTP ${res.status}): ${errorBody}`);
      }

      console.log("✅ [업로드 성공]");
      goTo("shoot", reservationId);
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.error("❌ [업로드 에러]", errMsg);
      if (errMsg.includes("502") || errMsg.includes("Bubble")) {
        alert("Bubble API 서버 연결 실패.\n환경 변수를 확인해주세요.");
      } else if (errMsg.includes("413") || errMsg.includes("too large")) {
        alert("이미지 파일이 너무 큽니다.\n다시 촬영해 주세요.");
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
      setPoseLoading(true);
      fetch(`/api/bubble/pose-guides/${reservationId}`)
        .then((r) => r.json())
        .then((list: PoseGuideItem[]) => {
          setPoseGuides(Array.isArray(list) ? list : []);
        })
        .catch(() => setPoseGuides([]))
        .finally(() => setPoseLoading(false));
    }
  }, [page, reservationId]);

  // ==================== 인증사진 재촬영 ====================

  const confirmRetake = useCallback(() => {
    setShowRetakeModal(false);
    setAuthPhotoDataUrl(null);
    if (reservationId) goTo("auth", reservationId);
  }, [reservationId, goTo]);

  // ==================== "다음 고객으로" (촬영 완료) ====================

  const handleNextCustomer = useCallback(() => {
    setShowNextCustomerModal(true);
  }, []);

  const confirmNextCustomer = useCallback(async () => {
    if (!reservationId) return;
    setNextCustomerLoading(true);

    console.log("🏁 [다음 고객으로] 세션 종료 처리", { reservationId });

    try {
      const res = await fetch(`/api/bubble/reservation/${reservationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Completed" }),
      });

      console.log(`📡 [다음 고객] PATCH 응답: HTTP ${res.status}`);

      // HTTP 2xx면 성공으로 처리 (Bubble이 빈 응답을 보내도 OK)
      if (!res.ok) {
        const errorBody = await res.text();
        console.error(`❌ [다음 고객] 상태 업데이트 HTTP 에러: ${res.status}`, errorBody);
        // 그래도 다음 고객으로 이동 (DB는 이미 반영됐을 가능성 높음)
        console.warn("⚠️ DB는 이미 업데이트됐을 수 있으므로 계속 진행합니다.");
      }

      incrementSessionCount();
      setSessionCount(getSessionCount());
      console.log("✅ [다음 고객] 세션 종료 완료 → QR 스캔으로 이동");
    } catch (err: any) {
      console.error("❌ [다음 고객] 예외 발생:", err?.message);
      // 네트워크 에러여도 다음 고객으로 진행 (UX 우선)
    } finally {
      setNextCustomerLoading(false);
      setShowNextCustomerModal(false);
      setReservationId(null);
      setAuthPhotoDataUrl(null);
      setPoseGuides([]);
      setShootStarted(false);
      goTo("scan");
    }
  }, [reservationId, goTo]);

  const cancelNextCustomer = useCallback(() => {
    setShowNextCustomerModal(false);
  }, []);

  // ==================== 포즈 이미지 슬라이더 열기 ====================

  const openSlider = useCallback((index: number) => {
    setSliderInitialIndex(index);
    setSliderOpen(true);
  }, []);

  const sliderImages = poseGuides
    .filter((p) => p?.imageUrl)
    .map((p, i) => ({
      url: p.imageUrl!,
      label: `포즈 ${i + 1}${p.spotName ? ` · ${p.spotName}` : ""}`,
    }));

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
                {qrReservationInfo?.reservationCode && (
                  <p className="text-2xl font-extrabold tracking-[0.2em] text-[#00CFFF] font-mono mt-1">
                    {qrReservationInfo.reservationCode}
                  </p>
                )}
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
                </div>
                <div className="flex gap-2.5">
                  <button type="button" onClick={cancelQrConfirm}
                    className="flex-1 py-3.5 rounded-xl font-semibold text-base bg-border text-white">
                    취소
                  </button>
                  <button type="button" onClick={confirmQrAndProceed}
                    className="flex-1 py-3.5 rounded-xl font-semibold text-base bg-accent text-white">
                    📸 인증사진 촬영
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 업로드 확인 모달 */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/95 z-[9999] flex items-center justify-center flex-col p-5">
          <div className="bg-surface p-6 rounded-2xl max-w-[90%] text-center">
            <h3 className="text-xl font-bold text-white mb-5">
              이 사진을 인증사진으로<br />업로드 하시겠습니까?
            </h3>
            {authPhotoDataUrl && (
              <img src={authPhotoDataUrl} alt="미리보기"
                className="max-w-full max-h-[300px] rounded-xl my-5 mx-auto" />
            )}
            <div className="flex gap-2.5 mt-4">
              <button type="button" onClick={rejectUpload}
                className="flex-1 py-3.5 rounded-xl font-semibold text-base bg-border text-white">
                다시 촬영
              </button>
              <button type="button" onClick={confirmUpload}
                className="flex-1 py-3.5 rounded-xl font-semibold text-base bg-accent text-white">
                네, 업로드
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 재촬영 확인 모달 */}
      {showRetakeModal && (
        <div className="fixed inset-0 bg-black/95 z-[9999] flex items-center justify-center flex-col p-5">
          <div className="bg-surface p-6 rounded-2xl max-w-[90%] text-center">
            <h3 className="text-xl font-bold text-white mb-5">
              인증사진을 다시 촬영하시겠습니까?
            </h3>
            <div className="flex gap-2.5">
              <button type="button" onClick={() => setShowRetakeModal(false)}
                className="flex-1 py-3.5 rounded-xl font-semibold text-base bg-border text-white">
                취소
              </button>
              <button type="button" onClick={confirmRetake}
                className="flex-1 py-3.5 rounded-xl font-semibold text-base bg-accent text-white">
                네, 다시 촬영
              </button>
            </div>
          </div>
        </div>
      )}

      {/* "다음 고객으로" 확인 모달 */}
      {showNextCustomerModal && (
        <div className="fixed inset-0 bg-black/95 z-[9999] flex items-center justify-center flex-col p-5">
          <div className="bg-surface p-6 rounded-2xl max-w-[90%] w-full text-center">
            <div className="text-5xl mb-4">👋</div>
            <h3 className="text-xl font-bold text-white mb-2">
              다음 고객으로 넘어갈까요?
            </h3>
            <p className="text-muted text-sm mb-6">
              현재 촬영이 완료 처리되고,<br />QR 스캐너로 돌아갑니다.
            </p>
            <div className="flex gap-2.5">
              <button type="button" onClick={cancelNextCustomer}
                disabled={nextCustomerLoading}
                className="flex-1 py-3.5 rounded-xl font-semibold text-base bg-border text-white disabled:opacity-50">
                아니오
              </button>
              <button type="button" onClick={confirmNextCustomer}
                disabled={nextCustomerLoading}
                className="flex-1 py-3.5 rounded-xl font-semibold text-base bg-[#34C759] text-white disabled:opacity-50 flex items-center justify-center gap-2">
                {nextCustomerLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    처리 중...
                  </>
                ) : (
                  "네, 다음 고객으로"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 이미지 슬라이더 모달 */}
      {sliderOpen && sliderImages.length > 0 && (
        <ImageSliderModal
          images={sliderImages}
          initialIndex={sliderInitialIndex}
          onClose={() => setSliderOpen(false)}
        />
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
          <button type="button" onClick={() => goTo("scan")}
            className="w-full py-4 rounded-[14px] text-[17px] font-bold bg-border text-primary">
            ← 스캔으로 돌아가기
          </button>
        </CameraScanner>
        {modals}
      </>
    );
  }

  // ==================== RENDER: Step 2 - 포즈 리스트 + 촬영 ====================

  if (page === "shoot") {
    return (
      <>
        <div className="h-screen flex flex-col bg-[#F2F2F7]">
          <div className="flex-1 overflow-y-auto px-5 py-5 pb-32">
            {/* 인증사진 */}
            <div className="bg-white rounded-2xl p-5 mb-5 text-center">
              <h2 className="text-[17px] font-bold text-black mb-4">📸 Step 1: 고객 인증사진</h2>
              {authPhotoDataUrl ? (
                <img src={authPhotoDataUrl} alt="인증사진"
                  className="w-[200px] h-[260px] rounded-xl object-cover border-[3px] border-primary mx-auto cursor-pointer"
                  onClick={() => setShowRetakeModal(true)} />
              ) : (
                <div className="w-[200px] h-[260px] rounded-xl bg-gray-200 flex items-center justify-center mx-auto">
                  <span className="text-gray-400 text-sm">사진 없음</span>
                </div>
              )}
              <button type="button" onClick={() => setShowRetakeModal(true)}
                className="w-full mt-4 py-3 bg-accent text-white rounded-xl font-semibold">
                인증사진 다시 촬영하기
              </button>
            </div>

            {/* 포즈 리스트 */}
            <div className="bg-white rounded-2xl p-5">
              <h2 className="text-[17px] font-bold text-black mb-4">🎯 Step 2: 고객 선택 포즈</h2>

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
                    <>
                      <p className="text-xs text-gray-400 mb-3 text-center">
                        이미지를 탭하면 크게 볼 수 있습니다
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {poseGuides.map((pose, index) => (
                          <div
                            key={pose?.reservedPoseId || index}
                            className="relative rounded-xl overflow-hidden bg-black aspect-[3/4] cursor-pointer active:scale-95 transition-transform"
                            onClick={() => {
                              if (pose?.imageUrl) {
                                const sliderIdx = sliderImages.findIndex((s) => s.url === pose.imageUrl);
                                openSlider(sliderIdx >= 0 ? sliderIdx : 0);
                              }
                            }}
                          >
                            {pose?.imageUrl ? (
                              <img src={pose.imageUrl} alt={`포즈 ${index + 1}`}
                                className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gray-800">
                                <span className="text-gray-500 text-sm">이미지 없음</span>
                              </div>
                            )}
                            <div className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center text-sm font-bold">
                              {index + 1}
                            </div>
                            {/* 확대 아이콘 */}
                            {pose?.imageUrl && (
                              <div className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center text-xs">
                                🔍
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 하단 고정 버튼 */}
          <div className="fixed bottom-0 left-0 right-0 p-5 pt-8 bg-gradient-to-t from-white to-transparent space-y-2.5">
            {!shootStarted ? (
              <button type="button" onClick={() => setShootStarted(true)}
                disabled={poseLoading || (poseGuides?.length || 0) === 0}
                className="w-full py-4 bg-[#007AFF] text-white rounded-[14px] text-[17px] font-bold disabled:opacity-50">
                📸 촬영 시작
              </button>
            ) : (
              <button type="button" onClick={handleNextCustomer}
                className="w-full py-4 bg-[#34C759] text-white rounded-[14px] text-[17px] font-bold">
                👋 다음 고객으로
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
              <button type="button" onClick={() => reservationId && goTo("auth", reservationId)}
                className="w-full py-4 rounded-[14px] text-[17px] font-bold bg-primary text-black">
                ✓ 확인 - 인증사진 촬영하기
              </button>
              <button type="button" onClick={() => goTo("scan")}
                className="w-full py-4 rounded-[14px] text-[17px] font-bold bg-border text-white">
                ↻ 다시 스캔하기
              </button>
            </div>
          </div>
        </div>
        {modals}
      </>
    );
  }

  // ==================== RENDER: 기본 ====================

  return (
    <div className="h-screen flex items-center justify-center bg-black">
      <button type="button" onClick={() => goTo("scan")}
        className="py-3 px-6 bg-primary text-black rounded-xl font-semibold">
        스캔 화면으로
      </button>
    </div>
  );
}
