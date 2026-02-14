"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

// ─── BarcodeDetector 타입 (브라우저 네이티브 API) ───
declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats: string[] }) => {
      detect: (source: HTMLVideoElement | HTMLCanvasElement | ImageData) => Promise<{ rawValue: string }[]>;
    };
  }
}

// ─── localStorage 키 ───
const CAMERA_DEVICE_KEY = "chiiz_last_camera_deviceId";

export type ScanMode = "qr" | "manual";

export type CameraScannerProps = {
  mode: "scan" | "auth";
  scanMode?: ScanMode;
  onScanModeChange?: (mode: ScanMode) => void;
  onQRSuccess?: (reservationId: string, rawUrl: string) => void;
  onManualCapture?: (reservationId: string, imageDataUrl: string) => void;
  onAuthCapture?: (imageDataUrl: string) => void;
  statusText?: string;
  sessionCount?: number;
  showPortraitGuide?: boolean;
  children?: React.ReactNode;
};

export function CameraScanner({
  mode,
  scanMode = "qr",
  onScanModeChange,
  onQRSuccess,
  onManualCapture,
  onAuthCapture,
  statusText: externalStatus,
  sessionCount = 0,
  showPortraitGuide = false,
  children,
}: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const qrGuideRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState("카메라 로딩 중...");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scanLoopRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const barcodeDetectorRef = useRef<InstanceType<NonNullable<Window["BarcodeDetector"]>> | null>(null);

  const isAuthMode = mode === "auth";
  const displayStatus = externalStatus ?? status;

  // ─── BarcodeDetector 초기화 (하드웨어 가속) ───
  useEffect(() => {
    if (typeof window !== "undefined" && window.BarcodeDetector) {
      try {
        barcodeDetectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
      } catch {
        barcodeDetectorRef.current = null;
      }
    }
  }, []);

  // ─── 카메라 초기화 (마지막 사용 카메라 기억) ───
  useEffect(() => {
    let mounted = true;

    async function initCamera() {
      const video = videoRef.current;
      if (!video) return;

      try {
        setStatus("📷 카메라 권한 요청 중...");

        // 마지막 사용 카메라 복원
        const savedDeviceId = localStorage.getItem(CAMERA_DEVICE_KEY);

        const constraints: MediaStreamConstraints = {
          video: savedDeviceId
            ? {
                deviceId: { exact: savedDeviceId },
                width: isAuthMode ? { ideal: 1080 } : { ideal: 1920 },
                height: isAuthMode ? { ideal: 1440 } : { ideal: 1080 },
              }
            : {
                facingMode: "environment",
                width: isAuthMode ? { ideal: 1080 } : { ideal: 1920 },
                height: isAuthMode ? { ideal: 1440 } : { ideal: 1080 },
              },
        };

        let mediaStream: MediaStream;
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch {
          // 저장된 카메라 실패 → fallback으로 environment 카메라
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "environment",
              width: isAuthMode ? { ideal: 1080 } : { ideal: 1920 },
              height: isAuthMode ? { ideal: 1440 } : { ideal: 1080 },
            },
          });
        }

        if (!mounted) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }

        // 카메라 deviceId 저장
        const videoTrack = mediaStream.getVideoTracks()[0];
        if (videoTrack) {
          const settings = videoTrack.getSettings();
          if (settings.deviceId) {
            localStorage.setItem(CAMERA_DEVICE_KEY, settings.deviceId);
          }
        }

        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = mediaStream;
        video.srcObject = mediaStream;
        setStream(mediaStream);

        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => {
            video.play().then(resolve).catch(resolve);
          };
        });

        if (!mounted) return;
        if (isAuthMode) {
          setStatus("📸 고객 인증사진 촬영");
        } else {
          setStatus(scanMode === "qr" ? "🔍 QR 코드를 스캔하세요" : "📸 예약화면을 촬영하세요");
        }
      } catch (err) {
        if (!mounted) return;
        const errorName = (err as DOMException)?.name || "";
        if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
          setStatus("❌ 카메라 권한이 거부되었습니다");
          setCameraError("camera_denied");
        } else if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
          setStatus("❌ 카메라를 찾을 수 없습니다");
          setCameraError("camera_not_found");
        } else {
          setStatus("❌ 카메라 초기화 실패");
          setCameraError("camera_error");
        }
      }
    }

    initCamera();
    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);
      if (scanLoopRef.current) {
        cancelAnimationFrame(scanLoopRef.current);
        scanLoopRef.current = null;
      }
    };
  }, [mode, isAuthMode, scanMode]);

  // ─── QR 인식 성공 핸들러 ───
  const handleQRSuccess = useCallback(
    (rawUrl: string) => {
      if (scanning) return;
      setScanning(true);

      // ✅ 다중 패턴으로 Bubble ID(숫자x숫자) 추출
      // 우선순위: reservation_id= 파라미터 > f접두사 패턴 > 베어 ID > 원본
      const urlParamMatch = rawUrl.match(/reservation_id=(\d+x\d+)/);
      const fPrefixMatch = rawUrl.match(/f(\d{13,}x\d{15,})/);
      const bareIdMatch = rawUrl.match(/(\d{13,}x\d{13,})/);
      const reservationId = urlParamMatch?.[1] || fPrefixMatch?.[1] || bareIdMatch?.[1] || rawUrl;

      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🔍 [QR 파싱]");
      console.log(`📋 원본: ${rawUrl}`);
      console.log(`📋 추출된 ID: ${reservationId}`);
      console.log(`📋 매칭 패턴: ${urlParamMatch ? "reservation_id=" : fPrefixMatch ? "f접두사" : bareIdMatch ? "베어ID" : "⚠️ 매칭실패(원본사용)"}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      try { navigator.vibrate?.([100, 50, 100]); } catch { /* 진동 미지원 무시 */ }
      onQRSuccess?.(reservationId, rawUrl);
    },
    [onQRSuccess, scanning]
  );

  // ─── QR 스캔 루프 (rAF 기반 20+ fps, BarcodeDetector 우선) ───
  useEffect(() => {
    if (isAuthMode || scanMode !== "qr" || !stream) return;

    const video = videoRef.current;
    const canvas = scanCanvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const detector = barcodeDetectorRef.current;
    let lastScanTime = 0;
    const SCAN_INTERVAL = 50; // 20fps (50ms 간격)
    let cancelled = false;

    async function scanFrame(timestamp: number) {
      if (cancelled) return;

      // 최소 간격 체크 (20fps 유지)
      if (timestamp - lastScanTime < SCAN_INTERVAL) {
        scanLoopRef.current = requestAnimationFrame(scanFrame);
        return;
      }
      lastScanTime = timestamp;

      if (video!.readyState < video!.HAVE_ENOUGH_DATA) {
        scanLoopRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      try {
        // 방법 1: BarcodeDetector (네이티브 하드웨어 가속)
        if (detector) {
          const results = await detector.detect(video!);
          if (!cancelled && results.length > 0 && results[0].rawValue) {
            handleQRSuccess(results[0].rawValue);
            return; // 성공 시 루프 종료
          }
        } else {
          // 방법 2: jsQR (소프트웨어 폴백)
          canvas.width = video!.videoWidth;
          canvas.height = video!.videoHeight;
          ctx.drawImage(video!, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "attemptBoth",
          });
          if (!cancelled && code) {
            handleQRSuccess(code.data);
            return; // 성공 시 루프 종료
          }
        }
      } catch {
        // 야외 강한 노출 등 인식 실패 → 무시하고 다음 프레임 계속
      }

      if (!cancelled) {
        scanLoopRef.current = requestAnimationFrame(scanFrame);
      }
    }

    scanLoopRef.current = requestAnimationFrame(scanFrame);

    return () => {
      cancelled = true;
      if (scanLoopRef.current) {
        cancelAnimationFrame(scanLoopRef.current);
        scanLoopRef.current = null;
      }
    };
  }, [isAuthMode, scanMode, stream, scanning, handleQRSuccess]);

  // ─── 캡처 유틸 ───
  const captureToDataUrl = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.92);
  }, []);

  const handleManualCapture = useCallback(() => {
    const imageData = captureToDataUrl();
    if (!imageData) return;
    const reservationId = "MANUAL_" + Date.now();
    navigator.vibrate?.(200);
    onManualCapture?.(reservationId, imageData);
  }, [captureToDataUrl, onManualCapture]);

  const handleAuthCapture = useCallback(() => {
    const imageData = captureToDataUrl();
    if (!imageData) return;
    onAuthCapture?.(imageData);
  }, [captureToDataUrl, onAuthCapture]);

  const setMode = useCallback(
    (m: ScanMode) => {
      onScanModeChange?.(m);
      setScanning(false);
      setStatus(m === "qr" ? "🔍 QR 코드를 스캔하세요" : "📸 예약화면을 촬영하세요");
    },
    [onScanModeChange]
  );

  return (
    <div className="flex flex-col h-full bg-black">
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        <canvas ref={scanCanvasRef} className="hidden" />
        <canvas ref={captureCanvasRef} className="hidden" />

        {/* 카메라 권한 거부 / 에러 UI */}
        {cameraError && (
          <div className="absolute inset-0 z-[10] flex items-center justify-center bg-black/90">
            <div className="text-center px-8">
              <div className="text-6xl mb-6">
                {cameraError === "camera_denied" ? "🔒" : cameraError === "camera_not_found" ? "📷" : "⚠️"}
              </div>
              <h3 className="text-white text-xl font-bold mb-3">
                {cameraError === "camera_denied"
                  ? "카메라 권한을 허용해 주세요"
                  : cameraError === "camera_not_found"
                  ? "카메라를 찾을 수 없습니다"
                  : "카메라 초기화에 실패했습니다"}
              </h3>
              <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                {cameraError === "camera_denied" ? (
                  <>브라우저 설정에서 카메라 권한을 허용한 후<br />페이지를 새로고침 해주세요.</>
                ) : cameraError === "camera_not_found" ? (
                  <>카메라가 연결되어 있는지 확인해 주세요.<br />외장 카메라의 경우 USB 연결을 확인하세요.</>
                ) : (
                  <>카메라에 문제가 발생했습니다.<br />다른 앱에서 카메라를 사용 중인지 확인해 주세요.</>
                )}
              </p>
              <button
                type="button"
                onClick={() => { setCameraError(null); window.location.reload(); }}
                className="px-8 py-3 bg-[#007AFF] text-white rounded-xl font-semibold text-sm"
              >
                🔄 다시 시도
              </button>
            </div>
          </div>
        )}

        {/* 오버레이 */}
        <div className="absolute inset-0 pointer-events-none z-[5]">
          {/* 상단 상태바 */}
          <div className="absolute top-5 left-5 right-5 flex justify-between items-center px-4 py-3 bg-black/85 rounded-xl backdrop-blur-md">
            <span
              className={`flex-1 text-sm font-semibold ${
                status.startsWith("❌") ? "text-red-500" : isAuthMode ? "text-accent" : "text-primary"
              }`}
            >
              {displayStatus}
            </span>
            {!isAuthMode && (
              <span className="text-white text-xs bg-white/15 px-2.5 py-1 rounded-lg">
                오늘 {sessionCount}명
              </span>
            )}
          </div>

          {/* QR 스캔 가이드 영역 - 화면 너비 70% */}
          {!isAuthMode && (
            <div
              ref={qrGuideRef}
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-[3px] rounded-3xl ${
                scanMode === "manual" ? "border-accent" : "border-primary"
              }`}
              style={{
                width: "70vw",
                height: "70vw",
                maxWidth: "400px",
                maxHeight: "400px",
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
              }}
            >
              {/* 스캔 라인 애니메이션 */}
              <div
                className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-scan"
                style={{ boxShadow: "0 0 10px #00D9FF" }}
              />
              {/* 코너 마커 (직관성 강화) */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-[4px] border-l-[4px] border-primary rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-[4px] border-r-[4px] border-primary rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-[4px] border-l-[4px] border-primary rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-[4px] border-r-[4px] border-primary rounded-br-lg" />
            </div>
          )}

          {/* 인증사진 가이드 */}
          {isAuthMode && showPortraitGuide && (
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[220px] h-[280px] border-[3px] border-accent rounded-[20px] flex items-center justify-center"
              style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.7)" }}
            >
              <span className="text-6xl opacity-30">👤</span>
            </div>
          )}
        </div>
      </div>

      {/* 하단 컨트롤 */}
      <div className="flex-shrink-0 bg-surface px-5 pt-5 pb-8 border-t border-border">
        {!isAuthMode && (
          <div className="flex gap-2.5 mb-4">
            <button
              type="button"
              onClick={() => setMode("qr")}
              className={`flex-1 py-3.5 rounded-xl text-[15px] font-semibold transition-colors ${
                scanMode === "qr" ? "bg-primary text-black" : "bg-border text-muted"
              }`}
            >
              📱 QR 스캔
            </button>
            <button
              type="button"
              onClick={() => setMode("manual")}
              className={`flex-1 py-3.5 rounded-xl text-[15px] font-semibold transition-colors ${
                scanMode === "manual" ? "bg-primary text-black" : "bg-border text-muted"
              }`}
            >
              📸 예약화면 촬영
            </button>
          </div>
        )}

        {!isAuthMode && scanMode === "manual" && (
          <button
            type="button"
            onClick={handleManualCapture}
            className="w-full py-4 rounded-[14px] text-[17px] font-bold bg-white text-black mb-2.5"
          >
            예약화면 촬영하기
          </button>
        )}

        {isAuthMode && (
          <>
            <button
              type="button"
              onClick={handleAuthCapture}
              className="w-full py-4 rounded-[14px] text-[17px] font-bold bg-accent text-white mb-2.5"
            >
              📸 인증사진 촬영
            </button>
            {children}
          </>
        )}
      </div>
    </div>
  );
}
