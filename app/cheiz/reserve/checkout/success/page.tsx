"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useState, useEffect, Suspense, useRef } from "react";
import QRCode from "qrcode";
import { useReservationStore } from "@/lib/reservation-store";

function SuccessContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const tourIdParam = searchParams.get("tour_id");
  const folderIdParam = searchParams.get("folder_id");
  const sessionId = searchParams.get("session_id");
  const noPayment = searchParams.get("no_payment");

  const {
    tourId,
    tour,
    spotSelections,
    folderId,
    scheduleId,
    guestCount,
    editMode,
    existingReservationId,
    getTotalSelectedCount,
    setTourId,
    setFolderId,
    setEditMode,
    clearAll,
  } = useReservationStore();

  const [phase, setPhase] = useState<"processing" | "success" | "error">("processing");
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState("");
  const processedRef = useRef(false);

  // Sync URL params to store
  useEffect(() => {
    if (tourIdParam) {
      const parsed = parseInt(tourIdParam, 10);
      if (!isNaN(parsed)) setTourId(parsed);
    }
    if (folderIdParam) {
      const parsed = parseInt(folderIdParam, 10);
      if (!isNaN(parsed)) setFolderId(parsed);
    }
  }, [tourIdParam, folderIdParam, setTourId, setFolderId]);

  // Process reservation after payment
  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user?.id) return;
    if (processedRef.current) return;
    if (getTotalSelectedCount() === 0) return;

    const effectiveTourId = tourId || (tourIdParam ? parseInt(tourIdParam, 10) : null);
    const effectiveFolderId = folderId || (folderIdParam ? parseInt(folderIdParam, 10) : null);

    // ✅ tourId만 필수, folderId는 STEP 0에서 생성
    if (!effectiveTourId) return;

    processedRef.current = true;
    processReservation(effectiveTourId, effectiveFolderId, session.user.id);
  }, [status, session, tourId, folderId, tourIdParam, folderIdParam, getTotalSelectedCount]);

  const processReservation = async (
    effectiveTourId: number,
    effectiveFolderId: number | null,
    userId: string
  ) => {
    try {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("[CHECKOUT_SUCCESS] 🏰 예약 프로세스 시작");
      console.log(`[CHECKOUT_SUCCESS]   🎫 tourId: ${effectiveTourId}`);
      console.log(`[CHECKOUT_SUCCESS]   📁 URL folderId: ${effectiveFolderId ?? "(없음 - 신규)"}`);
      console.log(`[CHECKOUT_SUCCESS]   👤 userId: ${userId}`);
      console.log(`[CHECKOUT_SUCCESS]   📸 포즈 수: ${getTotalSelectedCount()}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      // ━━━ STEP 0: 백엔드 폴더 생성 (Backend First!) ━━━
      let finalFolderId = effectiveFolderId;

      console.log("[CHECKOUT_SUCCESS] 📁 [STEP 0] 백엔드 폴더 생성 API 호출...");
      try {
        const folderName = tour?.tour_name || "촬영 예약";
        const folderPayload = {
          scheduleId: scheduleId || effectiveTourId,
          name: folderName,
          hostUserId: userId,
          personCount: guestCount.adults || 1,
        };
        console.log(`[CHECKOUT_SUCCESS]   📤 Payload: ${JSON.stringify(folderPayload)}`);

        const folderRes = await fetch("/api/backend/create-folder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(folderPayload),
        });

        console.log(`[CHECKOUT_SUCCESS]   📥 폴더 API 응답: ${folderRes.status}`);

        if (folderRes.ok) {
          const folderData = await folderRes.json();
          console.log(`[CHECKOUT_SUCCESS]   📦 폴더 응답: ${JSON.stringify(folderData).substring(0, 300)}`);
          if (folderData.folderId) {
            finalFolderId = folderData.folderId;
            console.log(`[CHECKOUT_SUCCESS]   ✅ 새 folderId: ${finalFolderId}`);
          } else {
            console.warn(`[CHECKOUT_SUCCESS]   ⚠️ folderId 없음, 기존값 사용: ${effectiveFolderId}`);
          }
        } else {
          const errText = await folderRes.text();
          console.error(`[CHECKOUT_SUCCESS]   ❌ 폴더 생성 실패 (${folderRes.status}): ${errText.substring(0, 200)}`);
          // ✅ 백엔드 실패 시 버블 API 호출 중단!
          throw new Error(`백엔드 예약 폴더 생성 실패 (HTTP ${folderRes.status})`);
        }
      } catch (folderErr: any) {
        if (folderErr.message.includes("백엔드 예약 폴더 생성 실패")) {
          throw folderErr; // 명시적 실패 → 상위로 전파
        }
        console.warn(`[CHECKOUT_SUCCESS]   ⚠️ 폴더 생성 예외: ${folderErr.message}`);
        // 네트워크 에러 등도 중단
        throw new Error(`폴더 생성 중 오류: ${folderErr.message}`);
      }

      console.log(`[CHECKOUT_SUCCESS] 📁 최종 folderId: ${finalFolderId}`);

      // Edit mode: delete existing first
      if (editMode && existingReservationId) {
        try {
          await fetch("/api/bubble/cancel-reservation", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reservation_id: existingReservationId }),
          });
          console.log("[CHECKOUT_SUCCESS] ✅ 기존 예약 삭제 완료");
        } catch (e) {
          console.warn("[CHECKOUT_SUCCESS] ⚠️ 기존 예약 삭제 실패:", e);
        }
      }

      // ━━━ STEP 1: 버블 pose_reservation 생성 (백엔드 성공 후에만!) ━━━
      console.log("[CHECKOUT_SUCCESS] 🏰 [STEP 1] pose_reservation 생성");
      console.log(`[CHECKOUT_SUCCESS]   📁 folder_Id: ${finalFolderId}`);

      const step1Res = await fetch("/api/bubble/pose-reservation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folder_Id: finalFolderId,
          tour_Id: effectiveTourId,
          user_Id: userId,
        }),
      });

      if (!step1Res.ok) {
        const err = await step1Res.json();
        throw new Error(err.error || "Failed to create reservation");
      }

      const step1Data = await step1Res.json();
      if (!step1Data.success || !step1Data.reservation_id) {
        throw new Error("Reservation creation returned no ID");
      }

      const bubbleReservationId = step1Data.reservation_id;
      console.log(`[CHECKOUT_SUCCESS] ✅ [STEP 1] Bubble ID: ${bubbleReservationId}`);

      // ━━━ STEP 2: 버블 reserved_pose 생성 ━━━
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

      if (selectedPoses.length > 0) {
        console.log(`[CHECKOUT_SUCCESS] 🏰 [STEP 2] reserved_pose ${selectedPoses.length}개 생성`);
        const step2Res = await fetch("/api/bubble/reserved-pose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pose_reservation_id: bubbleReservationId,
            selected_poses: selectedPoses,
          }),
        });

        if (!step2Res.ok) {
          const err = await step2Res.json();
          throw new Error(err.error || "reserved_pose 저장 실패");
        }
        console.log("[CHECKOUT_SUCCESS] ✅ [STEP 2] 포즈 저장 완료");
      }

      // ━━━ STEP 3: QR 생성 ━━━
      setReservationId(bubbleReservationId);

      const qrData = `${window.location.origin}/photographer/scan?reservation_id=${bubbleReservationId}`;
      const qrDataUrl = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: { dark: "#0055FF", light: "#FFFFFF" },
      });
      setQrCodeUrl(qrDataUrl);

      // Edit mode cleanup
      if (editMode) {
        setEditMode(false, null, []);
      }

      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("[CHECKOUT_SUCCESS] 🎉 전체 예약 프로세스 완료!");
      console.log(`[CHECKOUT_SUCCESS]   📁 folderId: ${finalFolderId}`);
      console.log(`[CHECKOUT_SUCCESS]   🆔 Bubble ID: ${bubbleReservationId}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      setPhase("success");

      // Clear store after a delay
      setTimeout(() => {
        clearAll();
      }, 2000);
    } catch (error: any) {
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.error("[CHECKOUT_SUCCESS] ❌ 예약 프로세스 실패!", error);
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      setErrorMsg(error.message || "예약 처리 중 오류가 발생했습니다.");
      setPhase("error");
    }
  };

  // Processing phase
  if (phase === "processing") {
    return (
      <div className="min-h-screen bg-[#FFF9F5] flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
            <div className="absolute inset-0 rounded-full border-4 border-[#0055FF] border-t-transparent animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            예약을 처리하고 있어요
          </h2>
          <p className="text-sm text-gray-500">잠시만 기다려주세요...</p>
        </motion.div>
      </div>
    );
  }

  // Error phase
  if (phase === "error") {
    return (
      <div className="min-h-screen bg-[#FFF9F5] flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-sm"
        >
          <div className="text-5xl mb-4">&#x26A0;&#xFE0F;</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            예약 처리 실패
          </h2>
          <p className="text-sm text-gray-500 mb-6">{errorMsg}</p>
          <button
            onClick={() => router.push("/cheiz/my-tours")}
            className="w-full py-3 rounded-2xl bg-[#0055FF] text-white font-bold"
          >
            마이페이지로 이동
          </button>
        </motion.div>
      </div>
    );
  }

  // Success phase
  return (
    <div className="min-h-screen bg-[#FFF9F5] flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", duration: 0.7 }}
        className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-xl"
      >
        {/* Confetti-like header */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: "spring" }}
          className="text-6xl mb-4"
        >
          &#x2728;
        </motion.div>

        <h2 className="text-2xl font-bold text-[#0055FF] mb-2">
          예약 완료!
        </h2>
        <p className="text-gray-500 text-sm mb-6">
          포즈가 성공적으로 예약되었습니다.
          <br />
          포토그래퍼에게 QR 코드를 보여주세요!
        </p>

        {/* QR Code */}
        {qrCodeUrl && (
          <div className="mb-6">
            <div className="bg-gray-50 rounded-2xl p-5 inline-block">
              <img
                src={qrCodeUrl}
                alt="Reservation QR"
                className="w-52 h-52 mx-auto"
              />
            </div>
          </div>
        )}

        {/* Reservation ID */}
        {reservationId && (
          <div className="bg-[#0055FF]/5 rounded-xl p-3 mb-6">
            <p className="text-[10px] text-gray-400 mb-0.5">예약 번호</p>
            <p className="text-xs font-mono font-bold text-gray-700 break-all">
              {reservationId}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => router.push("/cheiz/my-tours")}
            className="w-full py-3.5 rounded-2xl bg-[#0055FF] text-white font-bold shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all"
          >
            마이페이지
          </button>
          <button
            onClick={() => router.push("/cheiz")}
            className="w-full py-3.5 rounded-2xl bg-gray-100 text-gray-600 font-medium hover:bg-gray-200 transition-all"
          >
            홈으로
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FFF9F5] flex items-center justify-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-[#0055FF] border-solid" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
