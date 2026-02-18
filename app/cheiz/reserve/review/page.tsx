"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, Suspense, useRef, useCallback } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { useReservationStore, validateReservation } from "@/lib/reservation-store";
import { useModal } from "@/components/GlobalModal";

// ==================== LOGGING HELPER ====================

function logUserAction(buttonName: string, data?: Record<string, unknown>) {
  const now = new Date();
  const time = now.toLocaleTimeString("ko-KR", { hour12: false });
  console.log(`[USER_ACTION] Button: ${buttonName}, Time: ${time}, Data:`, data || {});
}

type SpotPose = {
  _id: string;
  image?: string;
  persona?: string;
  spot_Id?: number;
  tour_Id?: number;
};

/**
 * 이미지 URL 정규화
 */
function normalizeImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return url;
}

function ReviewContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showAlert, showError } = useModal();
  
  const tourIdParam = searchParams.get("tour_id");
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [reservationCompleted, setReservationCompleted] = useState(false);
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [reservationCode, setReservationCode] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  
  // ✅ [버그 수정] ref 기반 성공 플래그 — React 상태 비동기 업데이트와 무관하게 즉시 읽기 가능
  // clearAll() 이후 Zustand 상태 변경 → re-render → useEffect 재실행 시에도
  // 이 ref는 항상 최신 값을 가지므로 "선택한 포즈가 없습니다" 팝업을 확실히 차단
  const isSuccessRef = useRef(false);
  
  // ✅ Image Lightbox state
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxPersona, setLightboxPersona] = useState<string | null>(null);
  
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  // ━━━ 이메일 인증 상태 ━━━
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailEditing, setEmailEditing] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [codeSending, setCodeSending] = useState(false);
  const [codeVerifying, setCodeVerifying] = useState(false);
  const [emailError, setEmailError] = useState("");
  
  // ✅ Zustand store
  const {
    tourId,
    tour,
    spots,
    spotSelections,
    folderId,
    scheduleId,
    guestCount,
    editMode,
    existingReservationId,
    setTourId,
    setFolderId,
    setEditMode,
    getTotalSelectedCount,
    clearAll,
  } = useReservationStore();
  
  // Pose details (fetched from API)
  const [poseDetailsMap, setPoseDetailsMap] = useState<Map<string, SpotPose>>(new Map());

  // Step 1: 초기화 및 folderId 확보
  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.replace("/auth/signin?callbackUrl=" + encodeURIComponent(window.location.pathname + window.location.search));
      return;
    }

    if (!tourIdParam) {
      router.push("/cheiz/reserve/spots");
      return;
    }

    const parsedTourId = parseInt(tourIdParam, 10);
    
    if (isNaN(parsedTourId)) {
      router.push("/cheiz/reserve/spots");
      return;
    }

    setTourId(parsedTourId);
    
    // ✅ folderId 확보 (URL 또는 세션에서)
    const folderIdParam = searchParams.get("folder_id");
    if (folderIdParam) {
      const parsedFolderId = parseInt(folderIdParam, 10);
      if (!isNaN(parsedFolderId)) {
        setFolderId(parsedFolderId);
        console.log("📁 [FOLDER ID] Obtained from URL:", parsedFolderId);
      }
    } else {
      console.warn("⚠️ [FOLDER ID] Not found in URL, will use existing store value:", folderId);
    }
    
    // ✅ [버그 수정] 예약 성공 후 clearAll()로 스토어가 초기화되면서
    // useEffect가 재실행 → getTotalSelectedCount()=0 → "선택한 포즈가 없습니다" 팝업이 뜸
    // 해결: isSuccessRef(ref)와 state 둘 다 체크하여 성공 상태에서는 절대 경고하지 않음
    if (isSuccessRef.current || reservationCompleted || showSuccessModal || submitting) {
      console.log("🛡️ [GUARD] 예약 성공/진행 중 — 포즈 0개 경고 스킵");
      setLoading(false);
      return;
    }

    const totalCount = getTotalSelectedCount();
    if (totalCount === 0) {
      await showAlert("선택한 포즈가 없습니다. 스팟 선택 페이지로 이동합니다.");
      router.push(`/cheiz/reserve/spots?tour_id=${parsedTourId}`);
      return;
    }
    
    setLoading(false);
  }, [status, session, tourIdParam, searchParams, router, setTourId, setFolderId, getTotalSelectedCount, folderId, reservationCompleted, showSuccessModal, submitting]);

  // Fetch pose details
  useEffect(() => {
    if (!tour || Object.keys(spotSelections).length === 0) return;

    const fetchPoseDetails = async () => {
      const allPoseIds = Object.values(spotSelections)
        .flatMap((spot) => spot.selectedPoses);
      
      if (allPoseIds.length === 0) return;

      try {
        // Fetch all poses (you might need to create an API endpoint for this)
        // For now, we'll fetch by spot
        const detailsMap = new Map<string, SpotPose>();
        
        for (const spot of Object.values(spotSelections)) {
          if (spot.selectedPoses.length === 0) continue;
          
          const response = await fetch(`/api/bubble/spot-poses-by-spot/${spot.spotId}`);
          if (response.ok) {
            const data = await response.json();
            const poses: SpotPose[] = data.poses || [];
            
            poses.forEach((pose) => {
              if (spot.selectedPoses.includes(pose._id)) {
                detailsMap.set(pose._id, pose);
              }
            });
          }
        }
        
        setPoseDetailsMap(detailsMap);
        console.log("📸 [REVIEW] Loaded pose details:", detailsMap.size);
      } catch (error) {
        console.error("Error fetching pose details:", error);
      }
    };

    fetchPoseDetails();
  }, [tour, spotSelections]);

  // ━━━ 이메일 자동 판별 ━━━
  useEffect(() => {
    if (!session?.user?.email) return;
    const email = session.user.email;
    setEmailInput(email);

    // 구글 로그인 또는 이미 인증된 계정이면 자동 통과
    const isGoogleUser = (session as any)?.provider === "google" || email.endsWith("@gmail.com");
    const isVerified = (session.user as any)?.email_verified === true || (session.user as any)?.emailVerified === true;

    if (isGoogleUser || isVerified) {
      setEmailVerified(true);
      console.log(`[EMAIL] 자동 인증 통과 — ${email} (${isGoogleUser ? "Google" : "인증완료"})`);
    } else {
      console.log(`[EMAIL] 인증 필요 — ${email}`);
    }
  }, [session]);

  // ━━━ 인증번호 발송 ━━━
  const sendVerificationCode = useCallback(async () => {
    if (!emailInput || !emailInput.includes("@")) {
      setEmailError("유효한 이메일을 입력해주세요.");
      return;
    }
    setCodeSending(true);
    setEmailError("");
    try {
      const res = await fetch("/api/backend/send-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput }),
      });
      const data = await res.json();
      if (data.success) {
        setCodeSent(true);
        setEmailError("");
      } else {
        setEmailError(data.error || "발송 실패");
      }
    } catch {
      setEmailError("인증번호 발송 중 오류가 발생했습니다.");
    } finally {
      setCodeSending(false);
    }
  }, [emailInput]);

  // ━━━ 인증번호 검증 ━━━
  const verifyCode = useCallback(async () => {
    if (!verificationCode.trim()) {
      setEmailError("인증번호를 입력해주세요.");
      return;
    }
    setCodeVerifying(true);
    setEmailError("");
    try {
      const res = await fetch("/api/backend/send-verification", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput, code: verificationCode.trim() }),
      });
      const data = await res.json();
      if (data.success && data.verified) {
        setEmailVerified(true);
        setCodeSent(false);
        setEmailError("");
      } else {
        setEmailError(data.error || "인증 실패");
      }
    } catch {
      setEmailError("인증 확인 중 오류가 발생했습니다.");
    } finally {
      setCodeVerifying(false);
    }
  }, [emailInput, verificationCode]);

  // Validation
  const validation = tour ? validateReservation(
    spotSelections,
    tour.min_total || 0,
    tour.max_total || 99
  ) : null;

  // ⏰ 타임스탬프 생성 함수
  const getTimestamp = (): string => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    return `[${hours}:${minutes}:${seconds}]`;
  };

  // 🏰 버블 왕국으로 포즈 예약하기
  const handleReserve = async () => {
    logUserAction("포즈 예약하기", { tourId, folderId, poseCount: getTotalSelectedCount() });
    // ✅ [검증 1] 선택 조건 확인
    if (!validation?.canProceedToReview) {
      await showAlert(validation?.globalMessage || "선택 조건을 확인해주세요.");
      return;
    }

    // ✅ [검증 2] 세션 확인
    if (!session?.user?.id) {
      await showError("세션 정보를 확인할 수 없습니다. 다시 로그인해주세요.");
      console.error(`${getTimestamp()} ❌ [SESSION] Missing session or user ID`);
      return;
    }

    // ✅ [검증 3] tourId 확인
    if (!tourId) {
      await showError("투어 정보를 확인할 수 없습니다. 처음부터 다시 시작해주세요.");
      console.error(`${getTimestamp()} ❌ [TOUR ID] Missing tourId`);
      return;
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`${getTimestamp()} 🏰 Starting reservation process (Backend First!)`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`${getTimestamp()} 📦 [Parameters]`);
    console.log(`${getTimestamp()}   📁 기존 Folder ID:`, folderId ?? "(없음 - 신규)");
    console.log(`${getTimestamp()}   🎫 Tour ID:`, tourId, "✅");
    console.log(`${getTimestamp()}   👤 User ID:`, session.user.id, "✅");
    console.log(`${getTimestamp()}   📸 Total Poses:`, getTotalSelectedCount(), "✅");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    setSubmitting(true);

    try {
      // ━━━ STEP 0: 백엔드 폴더 생성 (Backend First!) ━━━
      let finalFolderId = folderId;

      console.log(`${getTimestamp()} 📁 [STEP 0] 백엔드 폴더 생성 API 호출...`);
      try {
        const folderName = tour?.tour_name || "촬영 예약";
        const folderPayload = {
          scheduleId: scheduleId || tourId,
          name: folderName,
          hostUserId: session.user.id,
          personCount: guestCount.adults || 1,
        };
        console.log(`${getTimestamp()}   📤 Folder Payload: ${JSON.stringify(folderPayload)}`);

        const folderRes = await fetch("/api/backend/create-folder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(folderPayload),
        });

        console.log(`${getTimestamp()}   📥 폴더 API 응답: ${folderRes.status}`);

        if (folderRes.ok) {
          const folderData = await folderRes.json();
          console.log(`${getTimestamp()}   📦 폴더 응답: ${JSON.stringify(folderData).substring(0, 300)}`);
          if (folderData.folderId) {
            finalFolderId = folderData.folderId;
            setFolderId(folderData.folderId);
            console.log(`${getTimestamp()}   ✅ 새 folderId 발급: ${finalFolderId}`);
          } else {
            console.warn(`${getTimestamp()}   ⚠️ folderId 없음, 기존값 사용: ${folderId}`);
          }
        } else {
          const errText = await folderRes.text();
          console.error(`${getTimestamp()}   ❌ 폴더 생성 실패 (${folderRes.status}): ${errText.substring(0, 200)}`);

          // 401 인증 만료 → 명확한 안내 후 버블 호출 완전 중단
          if (folderRes.status === 401) {
            let errData: any = {};
            try { errData = JSON.parse(errText); } catch {}
            const isAuthExpired = errData.code === "AUTH_EXPIRED";
            throw new Error(
              isAuthExpired
                ? "인증이 만료되었습니다. 다시 로그인 후 예약을 진행해주세요."
                : `인증 오류가 발생했습니다 (HTTP 401). 다시 로그인해주세요.`
            );
          }

          // 기타 실패 시 버블 호출 중단
          throw new Error(`백엔드 예약 폴더 생성 실패 (HTTP ${folderRes.status})`);
        }
      } catch (folderErr: any) {
        if (folderErr.message.includes("백엔드 예약 폴더 생성 실패")) {
          throw folderErr;
        }
        console.warn(`${getTimestamp()}   ⚠️ 폴더 생성 예외: ${folderErr.message}`);
        throw new Error(`폴더 생성 중 오류: ${folderErr.message}`);
      }

      if (!finalFolderId) {
        throw new Error("폴더 ID를 확보할 수 없습니다. 백엔드 응답을 확인하세요.");
      }

      console.log(`${getTimestamp()} 📁 최종 확정 folderId: ${finalFolderId}`);

      // ✅ [수정 모드] 기존 예약 삭제 후 재생성
      if (editMode && existingReservationId) {
        console.log(`${getTimestamp()} ✏️ [EDIT MODE] 기존 예약 삭제 중... id=${existingReservationId}`);
        
        const deleteRes = await fetch("/api/bubble/cancel-reservation", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reservation_id: existingReservationId }),
        });

        if (deleteRes.ok) {
          const delData = await deleteRes.json();
          console.log(`${getTimestamp()} ✅ [EDIT MODE] 기존 예약 삭제 완료:`, delData);
        } else {
          console.warn(`${getTimestamp()} ⚠️ [EDIT MODE] 기존 예약 삭제 실패, 새로 생성 진행`);
        }
      }

      // ✅ STEP 1: Create pose_reservation (Master Record) — 백엔드 성공 후에만!
      console.log(`${getTimestamp()} 🏰 [STEP 1] Creating pose_reservation...`);
      
      const step1Payload = {
        folder_Id: finalFolderId,
        tour_Id: tourId,
        user_Id: session.user.id,
        user_nickname: session.user.nickname || session.user.name || "",
      };
      
      console.log(`${getTimestamp()} 📤 [STEP 1] Payload:`, step1Payload);
      
      const step1Response = await fetch("/api/bubble/pose-reservation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(step1Payload),
      });

      if (!step1Response.ok) {
        const errorData = await step1Response.json();
        console.error(`${getTimestamp()} ❌ [STEP 1] Failed:`, errorData);
        
        // ✨ 404 에러면 명확한 메시지
        if (step1Response.status === 404) {
          throw new Error(
            errorData.error || 
            "버블 API 슬러그 설정을 확인해주세요 (pose_reservation vs pose-reservation)"
          );
        }
        throw new Error(errorData.error || "Failed to create pose_reservation");
      }

      const step1Data = await step1Response.json();
      
      if (!step1Data.success) {
        console.error(`${getTimestamp()} ❌ [STEP 1] Success=false:`, step1Data);
        throw new Error(step1Data.error || "Failed to create pose_reservation");
      }
      
      const bubbleReservationId = step1Data.reservation_id;
      const bubbleReservationCode = step1Data.reservation_code || "";
      setReservationCode(bubbleReservationCode);

      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`${getTimestamp()} ✅✅✅ [STEP 1] pose_reservation created!`);
      console.log(`${getTimestamp()} 🆔 Bubble Reservation ID:`, bubbleReservationId);
      console.log(`${getTimestamp()} 🔢 예약 코드:`, bubbleReservationCode);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      // ✅ [검증] reservation_id 확인
      if (!bubbleReservationId) {
        throw new Error("Bubble did not return reservation_id");
      }

      // ✅ STEP 2: Create reserved_pose records (Detail Records)
      console.log(`${getTimestamp()} 🏰 [STEP 2] Creating reserved_pose records...`);

      // 선택된 포즈 정보 수집
      const selectedPoses: any[] = [];
      Object.values(spotSelections).forEach((spot) => {
        spot.selectedPoses.forEach((poseId) => {
          selectedPoses.push({
            spot_pose_id: poseId,
            spot_id: spot.spotId,
            spot_name: spot.spotName,
          });
        });
      });

      console.log(`${getTimestamp()} 📸 [STEP 2] reserved_pose 저장 대상 수: ${selectedPoses.length}`);
      
      if (selectedPoses.length === 0) {
        throw new Error("reserved_pose 선택 항목 없음");
      }
      
      const step2Payload = {
        pose_reservation_id: bubbleReservationId,
        selected_poses: selectedPoses,
      };
      
      console.log(`${getTimestamp()} 📤 [STEP 2] Payload:`, {
        pose_reservation_id: bubbleReservationId,
        poses_count: selectedPoses.length,
      });

      const step2Response = await fetch("/api/bubble/reserved-pose", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(step2Payload),
      });

      if (!step2Response.ok) {
        const errorData = await step2Response.json();
        console.error(`${getTimestamp()} ❌ [STEP 2] Failed:`, errorData);
        
        // ✨ 404 에러면 명확한 메시지
        if (step2Response.status === 404) {
          throw new Error(
            errorData.error || 
            "버블 API 슬러그 설정을 확인해주세요 (reserved_pose vs reserved-pose)"
          );
        }
        throw new Error(errorData.error || "Failed to create reserved_pose records");
      }

      const step2Data = await step2Response.json();
      
      if (!step2Data.success) {
        console.error(`${getTimestamp()} ❌ [STEP 2] Success=false:`, step2Data);
        throw new Error(step2Data.error || "Failed to create reserved_pose records");
      }

      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`${getTimestamp()} ✅✅✅ [BUBBLE KINGDOM] Reservation completed!`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`${getTimestamp()} 🆔 Reservation ID:`, bubbleReservationId);
      console.log(`${getTimestamp()} 📸 Poses created:`, step2Data.created_count);
      console.log(`${getTimestamp()} ❌ Poses failed:`, step2Data.failed_count || 0);
      
      if (step2Data.failed_count > 0) {
        console.warn(`${getTimestamp()} ⚠️ [WARNING] 일부 reserved_pose 저장 실패 (failed_count: ${step2Data.failed_count})`);
      }
      
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      // ✅ STEP 3: Set reservation ID for display
      setReservationId(bubbleReservationId);

      // ✅ STEP 3: Generate QR code with Bubble reservation ID (모든 저장 완료 후)
      console.log(`${getTimestamp()} 📱 [STEP 3] Generating QR code...`);
      const qrData = `${window.location.origin}/photographer/scan?reservation_id=${bubbleReservationId}`;
      
      // 6자리 백업 코드 추출 (Bubble _id에서 숫자만 뽑아 마지막 6자리)
      const idNumbers = (bubbleReservationId || "").replace(/\D/g, "");
      const backupCode = idNumbers.slice(-6);
      
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`${getTimestamp()} 📱 [QR CODE GENERATION]`);
      console.log(`${getTimestamp()} 🔗 QR Data URL:`, qrData);
      console.log(`${getTimestamp()} 🔑 Bubble Reservation ID (원본):`, bubbleReservationId);
      console.log(`${getTimestamp()} 🔢 6자리 백업 코드:`, backupCode);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      
      const qrDataUrl = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: {
          dark: "#0055FF",
          light: "#FFFFFF",
        },
      });
      
      setQrCodeUrl(qrDataUrl);
      console.log(`${getTimestamp()} ✅ [QR CODE] Generated successfully`);

      // ✅ STEP 3.5: Bubble DB에 qrcode_url 업데이트 (PATCH)
      console.log(`${getTimestamp()} 📤 [STEP 3.5] Bubble DB에 qrcode_url 저장 중...`);
      try {
        const patchRes = await fetch("/api/bubble/update-reservation", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reservation_id: bubbleReservationId,
            qrcode_url: qrData,
          }),
        });
        if (patchRes.ok) {
          console.log(`${getTimestamp()} ✅ [STEP 3.5] qrcode_url 저장 성공`);
        } else {
          const errText = await patchRes.text();
          console.warn(`${getTimestamp()} ⚠️ [STEP 3.5] qrcode_url 저장 실패 (${patchRes.status}): ${errText.substring(0, 200)}`);
        }
      } catch (patchErr) {
        console.warn(`${getTimestamp()} ⚠️ [STEP 3.5] qrcode_url PATCH 에러:`, patchErr);
      }

      // ✅ [버그 수정] 예약 완료 플래그를 먼저 설정하여 useEffect 포즈 0개 경고 차단
      // ref는 동기적으로 즉시 반영됨 → clearAll() 이후 재렌더 시에도 확실히 방어
      isSuccessRef.current = true;
      setReservationCompleted(true);

      // ✅ [수정 모드] 완료 후 editMode 해제
      if (editMode) {
        setEditMode(false, null, []);
        console.log(`${getTimestamp()} ✏️ [EDIT MODE] 수정 완료, 모드 해제`);
      }

      // Show success modal
      console.log(`${getTimestamp()} 🎉 [SUCCESS] Showing success modal`);
      setShowSuccessModal(true);

      // Clear store after success (플래그가 이미 설정되었으므로 안전)
      setTimeout(() => {
        clearAll();
        console.log(`${getTimestamp()} 🗑️ [STORE] Cleared after successful reservation`);
      }, 1500);

    } catch (error) {
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.error(`${getTimestamp()} ❌❌❌ [BUBBLE KINGDOM] Reservation failed!`);
      console.error(`${getTimestamp()} Error:`, error);
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      
      await showError(`포즈 예약에 실패했습니다.\n${error instanceof Error ? error.message : "다시 시도해주세요."}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 뒤로가기
  const handleBack = () => {
    logUserAction("스팟 선택 뒤로가기", { tourId, folderId });
    if (tourId) {
      router.push(`/cheiz/reserve/spots?tour_id=${tourId}${folderId ? `&folder_id=${folderId}` : ''}${editMode ? '&mode=edit' : ''}`);
    } else {
      router.back();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-[#0055FF] border-solid mx-auto mb-4"></div>
          <p className="text-gray-600">리뷰 페이지를 준비하는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-32">
      {/* Sub Navigation (레이아웃 헤더와 중복 제거) */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-md mx-auto px-6 py-2 flex items-center gap-2 text-sm text-gray-500">
          <button
            onClick={handleBack}
            className="hover:text-[#0055FF] transition-colors"
          >
            ← 스팟 선택
          </button>
          <span className="text-gray-300">|</span>
          <span className="font-medium text-gray-700">최종 검토</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-md mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-4xl font-bold text-[#1A1A1A] mb-2">
            선택 내역 확인
          </h2>
          <p className="text-gray-600">
            총 <span className="font-bold text-[#0055FF]">{getTotalSelectedCount()}개</span>의 포즈를 선택하셨습니다 ✨
          </p>
          <p className="text-sm text-gray-500 mt-2">
            💡 이미지를 클릭하면 크게 볼 수 있습니다
          </p>
        </div>

        {/* Spot별 선택 내역 - 스크롤 최적화 */}
        <div className="space-y-6 max-h-[calc(100vh-420px)] overflow-y-auto pr-2" style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#0055FF #E5E7EB'
        }}>
          {Object.values(spotSelections)
            .filter((spot) => spot.selectedPoses.length > 0)
            .map((spot) => (
              <motion.div
                key={spot.spotId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-sm p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold text-[#1A1A1A]">
                    {spot.spotName}
                  </h3>
                  <span className="bg-[#0055FF] text-white px-4 py-1 rounded-full text-sm font-medium">
                    {spot.selectedPoses.length}개
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {spot.selectedPoses.map((poseId) => {
                    const pose = poseDetailsMap.get(poseId);
                    
                    return (
                      <motion.div
                        key={poseId}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.05 }}
                        className="relative aspect-square rounded-2xl overflow-hidden shadow-md cursor-pointer"
                        onClick={() => {
                          if (pose?.image) {
                            setLightboxImage(normalizeImageUrl(pose.image) || null);
                            setLightboxPersona(pose.persona || null);
                          }
                        }}
                      >
                        {pose?.image && (
                          <Image
                            src={normalizeImageUrl(pose.image) || ""}
                            alt={`Pose ${poseId}`}
                            fill
                            className="object-cover"
                            quality={60}
                            sizes="120px"
                          />
                        )}
                        {pose?.persona && (
                          <div className="absolute top-2 right-2 bg-white bg-opacity-90 text-[#0055FF] px-2 py-1 rounded-full text-xs font-medium">
                            {pose.persona}
                          </div>
                        )}
                        <div className="absolute top-2 left-2 bg-[#0055FF] text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                          ✓
                        </div>
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-all flex items-center justify-center">
                          <div className="opacity-0 hover:opacity-100 text-white text-2xl transition-opacity">
                            🔍
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
        </div>

        {/* Validation Message */}
        {validation && !validation.canProceedToReview && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 bg-red-50 border border-red-200 rounded-2xl p-4"
          >
            <p className="text-red-600 font-medium text-center">
              {validation.globalMessage}
            </p>
          </motion.div>
        )}
      </div>

      {/* ━━━ 이메일 확인 섹션 ━━━ */}
      <div className="max-w-md mx-auto px-6 mt-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📧</span>
            <h3 className="text-sm font-bold text-gray-900">알림 수신 이메일</h3>
            {emailVerified && (
              <span className="ml-auto text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                인증완료
              </span>
            )}
          </div>

          <p className="text-xs text-gray-400 mb-3">
            사진 보정 완료 알림이 이메일로 발송됩니다. 정확한 주소인지 확인해주세요.
          </p>

          {emailVerified && !emailEditing ? (
            /* 인증 완료 상태 */
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700 font-medium">
                {emailInput}
              </div>
              <button
                onClick={() => {
                  setEmailEditing(true);
                  setEmailVerified(false);
                  setCodeSent(false);
                  setVerificationCode("");
                }}
                className="px-3 py-3 text-xs font-bold text-[#0055FF] bg-[#0055FF]/10 rounded-xl hover:bg-[#0055FF]/20 active:scale-95 transition-all"
              >
                변경
              </button>
            </div>
          ) : (
            /* 인증 필요 상태 */
            <div className="space-y-3">
              {/* 이메일 입력 + 발송 버튼 */}
              <div className="flex gap-2">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    setCodeSent(false);
                    setEmailError("");
                  }}
                  placeholder="이메일 주소"
                  className="flex-1 bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700 border border-gray-200 outline-none focus:border-[#0055FF] transition-colors"
                />
                <button
                  onClick={sendVerificationCode}
                  disabled={codeSending || !emailInput.includes("@")}
                  className="px-4 py-3 text-xs font-bold text-white bg-[#0055FF] rounded-xl disabled:opacity-40 active:scale-95 transition-all whitespace-nowrap"
                >
                  {codeSending ? "발송 중..." : codeSent ? "재발송" : "인증번호 발송"}
                </button>
              </div>

              {/* 인증번호 입력 (코드 발송 후) */}
              <AnimatePresence>
                {codeSent && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={verificationCode}
                        onChange={(e) => {
                          setVerificationCode(e.target.value.replace(/\D/g, ""));
                          setEmailError("");
                        }}
                        placeholder="6자리 인증번호"
                        className="flex-1 bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700 border border-gray-200 outline-none focus:border-[#0055FF] transition-colors text-center tracking-[6px] font-bold"
                      />
                      <button
                        onClick={verifyCode}
                        disabled={codeVerifying || verificationCode.length < 6}
                        className="px-4 py-3 text-xs font-bold text-white bg-green-600 rounded-xl disabled:opacity-40 active:scale-95 transition-all whitespace-nowrap"
                      >
                        {codeVerifying ? "확인 중..." : "확인"}
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1.5">
                      인증번호는 5분간 유효합니다.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 에러 메시지 */}
              {emailError && (
                <p className="text-xs text-red-500 font-medium">{emailError}</p>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* 결제/예약 진행 Button (Fixed) - checkout 페이지로 이동 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-lg z-50">
        <div className="max-w-md mx-auto px-5 py-4">
          {!emailVerified && (
            <p className="text-xs text-center text-amber-600 font-medium mb-2">
              이메일 인증을 완료해야 결제를 진행할 수 있습니다.
            </p>
          )}
          <button
            onClick={() => {
              logUserAction("결제 진행", { tourId, folderId, poseCount: getTotalSelectedCount(), emailVerified });
              const safeTourId = tourIdParam ? parseInt(tourIdParam, 10) : tourId;
              router.push(`/cheiz/reserve/checkout?tour_id=${safeTourId}&folder_id=${folderId}`);
            }}
            disabled={!validation?.canProceedToReview || !emailVerified}
            className={`w-full py-4 rounded-2xl font-bold text-base transition-all ${
              validation?.canProceedToReview && emailVerified
                ? "bg-[#0055FF] text-white shadow-lg shadow-blue-500/25 active:scale-[0.98]"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            {emailVerified
              ? `결제 진행하기 (${getTotalSelectedCount()}개)`
              : "이메일 인증 후 결제 가능"}
          </button>
        </div>
      </div>

      {/* Image Lightbox */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4"
            onClick={() => {
              setLightboxImage(null);
              setLightboxPersona(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="relative max-w-md max-h-[90vh] w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => {
                  setLightboxImage(null);
                  setLightboxPersona(null);
                }}
                className="absolute -top-12 right-0 text-white text-4xl hover:text-[#0055FF] transition-colors z-10"
              >
                ✕
              </button>

              {/* Image */}
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src={lightboxImage}
                  alt="Pose Detail"
                  className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-lg"
                />
              </div>

              {/* Persona badge */}
              {lightboxPersona && (
                <div className="absolute top-4 right-4 bg-[#0055FF] text-white px-4 py-2 rounded-full font-medium shadow-lg">
                  {lightboxPersona}
                </div>
              )}

              {/* Tap instruction for mobile */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-4 py-2 rounded-full">
                클릭하거나 바깥 영역을 터치하면 닫힙니다
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Modal with QR Code */}
      <AnimatePresence>
        {showSuccessModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                // Allow closing by clicking backdrop
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 50 }}
              transition={{ type: "spring", duration: 0.6 }}
              className="bg-white rounded-2xl p-8 md:p-12 max-w-md w-full text-center shadow-lg"
            >
              <div className="text-6xl mb-4">✨</div>
              <h2 className="text-3xl font-bold text-[#0055FF] mb-4">
                예약 완료!
              </h2>
              <p className="text-gray-600 text-lg mb-6">
                {getTotalSelectedCount()}개의 포즈가 성공적으로 예약되었습니다.
              </p>

              {/* QR Code */}
              {qrCodeUrl && (
                <div className="mb-6">
                  <div className="bg-gray-50 rounded-2xl p-6 inline-block">
                    <img 
                      src={qrCodeUrl} 
                      alt="Reservation QR Code" 
                      className="w-64 h-64 mx-auto"
                    />
                  </div>
                  <p className="text-sm text-gray-500 mt-4">
                    포토그래퍼에게 이 QR 코드를 보여주세요
                  </p>
                </div>
              )}

              {/* 6자리 예약 코드 (크게 표시) */}
              {reservationCode && (
                <div className="bg-gradient-to-r from-[#0055FF]/10 to-[#7B2BFF]/10 border-2 border-[#0055FF]/20 rounded-2xl p-5 mb-6">
                  <p className="text-xs text-gray-500 font-semibold mb-2 tracking-wide uppercase">예약 번호</p>
                  <p className="text-4xl font-mono font-extrabold tracking-[0.3em] text-[#0055FF]">
                    {reservationCode}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-2">
                    촬영 당일 포토그래퍼에게 이 번호를 알려주세요
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    logUserAction("마이페이지 이동", { reservationId });
                    setShowSuccessModal(false);
                    router.push("/cheiz/my-tours");
                  }}
                  className="w-full bg-[#0055FF] text-white py-3 rounded-xl font-bold hover:bg-opacity-90 transition-all"
                >
                  마이페이지
                </button>
                <button
                  onClick={() => {
                    logUserAction("홈으로 이동", {});
                    setShowSuccessModal(false);
                    router.push("/cheiz");
                  }}
                  className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-200 transition-all"
                >
                  홈으로
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-[#0055FF] border-solid"></div>
      </div>
    }>
      <ReviewContent />
    </Suspense>
  );
}
