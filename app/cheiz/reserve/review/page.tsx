"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, Suspense, useRef } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { useReservationStore, validateReservation } from "@/lib/reservation-store";

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
  
  const tourIdParam = searchParams.get("tour_id");
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [reservationCompleted, setReservationCompleted] = useState(false); // ✅ 예약 완료 플래그
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  
  // ✅ [버그 수정] ref 기반 성공 플래그 — React 상태 비동기 업데이트와 무관하게 즉시 읽기 가능
  // clearAll() 이후 Zustand 상태 변경 → re-render → useEffect 재실행 시에도
  // 이 ref는 항상 최신 값을 가지므로 "선택한 포즈가 없습니다" 팝업을 확실히 차단
  const isSuccessRef = useRef(false);
  
  // ✅ Image Lightbox state
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxPersona, setLightboxPersona] = useState<string | null>(null);
  
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // ✅ Zustand store
  const {
    tourId,
    tour,
    spots,
    spotSelections,
    folderId,
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
      router.push("/api/auth/signin");
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
      alert("선택한 포즈가 없습니다. 스팟 선택 페이지로 이동합니다.");
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
      alert(validation?.globalMessage || "선택 조건을 확인해주세요.");
      return;
    }

    // ✅ [검증 2] 세션 확인
    if (!session?.user?.id) {
      alert("세션 정보를 확인할 수 없습니다. 다시 로그인해주세요.");
      console.error(`${getTimestamp()} ❌ [SESSION] Missing session or user ID`);
      return;
    }

    // ✅ [검증 3] tourId 확인
    if (!tourId) {
      alert("투어 정보를 확인할 수 없습니다. 처음부터 다시 시작해주세요.");
      console.error(`${getTimestamp()} ❌ [TOUR ID] Missing tourId`);
      return;
    }

    // ✅ [검증 4] folderId 확인 (가장 중요!)
    if (!folderId) {
      alert("Folder ID를 확인할 수 없습니다. 처음부터 다시 시작해주세요.");
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.error(`${getTimestamp()} ❌❌❌ [CRITICAL] FOLDER ID MISSING!`);
      console.error(`${getTimestamp()} Store folderId:`, folderId);
      console.error(`${getTimestamp()} URL에 folder_id가 포함되어 있는지 확인하세요!`);
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      return;
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`${getTimestamp()} 🏰 [BUBBLE KINGDOM] Starting reservation process`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`${getTimestamp()} 📦 [Parameters Validation]`);
    console.log(`${getTimestamp()}   📁 Folder ID (출입증):`, folderId, "✅");
    console.log(`${getTimestamp()}   🎫 Tour ID:`, tourId, "✅");
    console.log(`${getTimestamp()}   👤 User ID:`, session.user.id, "✅");
    console.log(`${getTimestamp()}   📸 Total Poses:`, getTotalSelectedCount(), "✅");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    setSubmitting(true);

    try {
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

      // ✅ STEP 1: Create pose_reservation (Master Record)
      console.log(`${getTimestamp()} 🏰 [STEP 1] Creating pose_reservation...`);
      
      const step1Payload = {
        folder_Id: folderId,
        tour_Id: tourId,
        user_Id: session.user.id,
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

      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`${getTimestamp()} ✅✅✅ [STEP 1] pose_reservation created!`);
      console.log(`${getTimestamp()} 🆔 Bubble Reservation ID:`, bubbleReservationId);
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

      console.log(`${getTimestamp()} 📸 [STEP 2] Total poses to save: ${selectedPoses.length}`);
      
      if (selectedPoses.length === 0) {
        throw new Error("No poses selected");
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
        console.warn(`${getTimestamp()} ⚠️ [WARNING] Some poses failed to save`);
      }
      
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      // ✅ STEP 3: Set reservation ID for display
      setReservationId(bubbleReservationId);

      // ✅ STEP 3: Generate QR code with Bubble reservation ID (모든 저장 완료 후)
      console.log(`${getTimestamp()} 📱 [STEP 3] Generating QR code...`);
      const qrData = `${window.location.origin}/photographer/scan?reservation_id=${bubbleReservationId}`;
      
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`${getTimestamp()} 📱 [QR CODE GENERATION]`);
      console.log(`${getTimestamp()} 🔗 QR Data URL:`, qrData);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      
      const qrDataUrl = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: {
          dark: "#0EA5E9", // skyblue
          light: "#FFFFFF",
        },
      });
      
      setQrCodeUrl(qrDataUrl);
      console.log(`${getTimestamp()} ✅ [QR CODE] Generated successfully`);

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
      
      alert(`포즈 예약에 실패했습니다.\n${error instanceof Error ? error.message : "다시 시도해주세요."}`);
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
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-skyblue border-solid mx-auto mb-4"></div>
          <p className="text-gray-600">리뷰 페이지를 준비하는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white pb-32">
      {/* Sub Navigation (레이아웃 헤더와 중복 제거) */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-2 flex items-center gap-2 text-sm text-gray-500">
          <button
            onClick={handleBack}
            className="hover:text-skyblue transition-colors"
          >
            ← 스팟 선택
          </button>
          <span className="text-gray-300">|</span>
          <span className="font-medium text-gray-700">최종 검토</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-4xl font-bold text-gray-800 mb-2">
            선택 내역 확인
          </h2>
          <p className="text-gray-600">
            총 <span className="font-bold text-skyblue">{getTotalSelectedCount()}개</span>의 포즈를 선택하셨습니다 ✨
          </p>
          <p className="text-sm text-gray-500 mt-2">
            💡 이미지를 클릭하면 크게 볼 수 있습니다
          </p>
        </div>

        {/* Spot별 선택 내역 - 스크롤 최적화 */}
        <div className="space-y-6 max-h-[calc(100vh-420px)] overflow-y-auto pr-2" style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#0EA5E9 #E5E7EB'
        }}>
          {Object.values(spotSelections)
            .filter((spot) => spot.selectedPoses.length > 0)
            .map((spot) => (
              <motion.div
                key={spot.spotId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl shadow-lg p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold text-gray-800">
                    {spot.spotName}
                  </h3>
                  <span className="bg-skyblue text-white px-4 py-1 rounded-full text-sm font-medium">
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
                          />
                        )}
                        {pose?.persona && (
                          <div className="absolute top-2 right-2 bg-white bg-opacity-90 text-skyblue px-2 py-1 rounded-full text-xs font-medium">
                            {pose.persona}
                          </div>
                        )}
                        <div className="absolute top-2 left-2 bg-skyblue text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
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

      {/* 포즈 예약하기 Button (Fixed) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl z-50">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <button
            onClick={handleReserve}
            disabled={!validation?.canProceedToReview || submitting}
            className={`w-full py-4 rounded-3xl font-bold text-lg transition-all ${
              validation?.canProceedToReview && !submitting
                ? "bg-skyblue text-white hover:bg-opacity-90 shadow-lg transform hover:scale-105"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            {submitting ? "예약 처리 중..." : `포즈 예약하기 (${getTotalSelectedCount()}개)`}
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
              className="relative max-w-4xl max-h-[90vh] w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => {
                  setLightboxImage(null);
                  setLightboxPersona(null);
                }}
                className="absolute -top-12 right-0 text-white text-4xl hover:text-skyblue transition-colors z-10"
              >
                ✕
              </button>

              {/* Image */}
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src={lightboxImage}
                  alt="Pose Detail"
                  className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
                />
              </div>

              {/* Persona badge */}
              {lightboxPersona && (
                <div className="absolute top-4 right-4 bg-skyblue text-white px-4 py-2 rounded-full font-medium shadow-lg">
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
              className="bg-white rounded-3xl p-8 md:p-12 max-w-md w-full text-center shadow-2xl"
            >
              <div className="text-6xl mb-4">✨</div>
              <h2 className="text-3xl font-bold text-skyblue mb-4">
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

              {reservationId && (
                <div className="bg-skyblue/10 rounded-2xl p-4 mb-6">
                  <p className="text-xs text-gray-500 mb-1">예약 번호</p>
                  <p className="text-sm font-mono font-bold text-gray-700">
                    {reservationId}
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
                  className="w-full bg-skyblue text-white py-3 rounded-2xl font-bold hover:bg-opacity-90 transition-all"
                >
                  마이페이지
                </button>
                <button
                  onClick={() => {
                    logUserAction("홈으로 이동", {});
                    setShowSuccessModal(false);
                    router.push("/cheiz");
                  }}
                  className="w-full bg-gray-100 text-gray-700 py-3 rounded-2xl font-medium hover:bg-gray-200 transition-all"
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
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-skyblue border-solid"></div>
      </div>
    }>
      <ReviewContent />
    </Suspense>
  );
}
