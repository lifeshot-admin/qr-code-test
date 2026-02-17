"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useState, useEffect, Suspense, useRef } from "react";
import {
  Copy,
  Check,
  Camera,
  Plane,
  Calendar,
  Users,
  Sparkles,
  Home,
  User,
} from "lucide-react";
import QRCode from "qrcode";
import { useReservationStore } from "@/lib/reservation-store";
import { useHasMounted } from "@/lib/use-has-mounted";
import { formatKSTDate } from "@/lib/utils";

function SuccessContent() {
  const hasMounted = useHasMounted();
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
    aiRetouching,
    editMode,
    existingReservationId,
    getTotalSelectedCount,
    setTourId,
    setFolderId,
    setEditMode,
    clearAll,
  } = useReservationStore();

  const [phase, setPhase] = useState<"processing" | "success" | "error">(
    "processing"
  );
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const processedRef = useRef(false);

  // ✅ clearAll() 이후에도 유지되는 캡처된 요약 정보
  const [capturedSummary, setCapturedSummary] = useState<{
    tourName: string;
    tourDate: string;
    totalGuests: number;
    poseCount: number;
    hasAiRetouching: boolean;
  } | null>(null);

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

    const poseCount = getTotalSelectedCount();

    const effectiveTourId =
      tourId || (tourIdParam ? parseInt(tourIdParam, 10) : null);
    const effectiveFolderId =
      folderId || (folderIdParam ? parseInt(folderIdParam, 10) : null);

    // tourId는 필수, folderId는 없어도 STEP 0에서 새로 생성
    if (!effectiveTourId) {
      if (poseCount === 0) {
        // ✅ 포즈 0개 케이스에서도 요약 캡처
        setCapturedSummary({
          tourName: tour?.tour_name || "투어",
          tourDate: tour?.tour_date || "",
          totalGuests: guestCount.adults + guestCount.children || 1,
          poseCount: 0,
          hasAiRetouching: aiRetouching,
        });
        setPhase("success");
        return;
      }
      return;
    }

    if (poseCount === 0) {
      // ✅ 포즈 0개 케이스에서도 요약 캡처
      setCapturedSummary({
        tourName: tour?.tour_name || "투어",
        tourDate: tour?.tour_date || "",
        totalGuests: guestCount.adults + guestCount.children || 1,
        poseCount: 0,
        hasAiRetouching: aiRetouching,
      });
      setPhase("success");
      return;
    }

    processedRef.current = true;
    processReservation(effectiveTourId, effectiveFolderId, session.user.id);
  }, [status, session, tourId, folderId, tourIdParam, folderIdParam]);

  const processReservation = async (
    effectiveTourId: number,
    effectiveFolderId: number | null,
    userId: string
  ) => {
    try {
      // ✅ clearAll() 전에 요약 정보 캡처 (UI에서 '포즈 0개' 방지)
      const poseCountSnapshot = getTotalSelectedCount();
      const guestsSnapshot = guestCount.adults + guestCount.children;
      setCapturedSummary({
        tourName: tour?.tour_name || "투어",
        tourDate: tour?.tour_date || "",
        totalGuests: guestsSnapshot || 1,
        poseCount: poseCountSnapshot,
        hasAiRetouching: aiRetouching,
      });

      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("[FOLDER_FLOW] 🏰 예약 프로세스 시작");
      console.log(`[FOLDER_FLOW]   📁 URL에서 받은 folderId: ${effectiveFolderId ?? "(없음 - 신규 예약)"}`);
      console.log(`[FOLDER_FLOW]   🎫 tourId: ${effectiveTourId}`);
      console.log(`[FOLDER_FLOW]   👤 userId: ${userId}`);
      console.log(`[FOLDER_FLOW]   📸 캡처된 포즈 수: ${poseCountSnapshot}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      // ━━━ STEP 0: 진짜 폴더 생성 (POST /api/v1/folders → 백엔드 프록시) ━━━
      //    Swagger 규격: scheduleId, name, hostUserId, personCount를 Query Param으로
      let finalFolderId = effectiveFolderId;
      console.log("[FOLDER_FLOW] 📁 [STEP 0] 진짜 폴더 생성 API 호출 시작...");
      console.log(`[FOLDER_FLOW]   📁 기존 folderId (URL에서): ${effectiveFolderId}`);
      console.log(`[FOLDER_FLOW]   📅 scheduleId (from store): ${scheduleId}`);
      console.log(`[FOLDER_FLOW]   👥 personCount: ${guestCount.adults}`);
      console.log(`[FOLDER_FLOW]   👤 userId: ${userId}`);

      try {
        // ✅ name = 투어 제목 (유저 이름이 아닌 투어 제목으로!)
        const folderName = tour?.tour_name || "촬영 예약";
        const folderPayload = {
          scheduleId: scheduleId || effectiveTourId, // scheduleId 우선, 없으면 tourId fallback
          name: folderName,
          hostUserId: userId,
          personCount: guestCount.adults || 1,
        };
        console.log(`[FOLDER_FLOW]   📤 Folder Payload: ${JSON.stringify(folderPayload)}`);
        console.log(`[FOLDER_FLOW]   📛 예약명(name): "${folderName}" (투어 제목 사용)`);

        const folderRes = await fetch("/api/backend/create-folder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(folderPayload),
        });

        console.log(`[FOLDER_FLOW]   📥 폴더 API 응답 status: ${folderRes.status}`);

        if (folderRes.ok) {
          const folderData = await folderRes.json();
          console.log(`[FOLDER_FLOW]   📦 폴더 API 응답: ${JSON.stringify(folderData).substring(0, 300)}`);

          if (folderData.folderId && folderData.folderId !== null) {
            finalFolderId = folderData.folderId;
            console.log(`[FOLDER_FLOW]   ✅ 새 folderId 발급 성공: ${finalFolderId}`);
          } else {
            console.warn(`[FOLDER_FLOW]   ⚠️ 폴더 API 응답에 folderId 없음, 기존값 사용: ${effectiveFolderId}`);
          }
        } else {
          const errorText = await folderRes.text();
          console.error(`[FOLDER_FLOW]   ❌ 폴더 생성 실패 (${folderRes.status}): ${errorText.substring(0, 200)}`);
          // ✅ 백엔드 실패 시 버블 API 호출 중단!
          throw new Error(`백엔드 예약 폴더 생성 실패 (HTTP ${folderRes.status})`);
        }
      } catch (folderErr: any) {
        if (folderErr.message.includes("백엔드 예약 폴더 생성 실패")) {
          throw folderErr; // 명시적 실패 → 상위로 전파
        }
        console.error(`[FOLDER_FLOW]   ❌ 폴더 생성 예외: ${folderErr.message}`);
        throw new Error(`폴더 생성 중 오류: ${folderErr.message}`);
      }

      // ━━━ 최종 folderId 확정 로그 ━━━
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`[FOLDER_FLOW] 📁 최종 확정 folderId: ${finalFolderId ?? "(없음)"}`);
      console.log(`[FOLDER_FLOW]   📁 원본 (URL): ${effectiveFolderId ?? "(없음 - 신규)"}`);
      console.log(`[FOLDER_FLOW]   📁 변경 여부: ${finalFolderId !== effectiveFolderId ? "✅ 새 ID 발급됨!" : "⚠️ 변경 없음"}`);
      if (finalFolderId === 11209) {
        console.error("[FOLDER_FLOW] ❌❌❌ 경고: folderId가 여전히 11209 고정값입니다!");
        console.error("[FOLDER_FLOW]   → 백엔드 POST /api/v1/folders 응답을 확인하세요.");
      }
      if (!finalFolderId) {
        console.warn("[FOLDER_FLOW] ⚠️ folderId가 null입니다. STEP 0 폴더 생성이 실패했을 수 있습니다.");
        console.warn("[FOLDER_FLOW]   → 포즈 예약은 folderId 없이도 진행합니다 (Bubble에서 나중에 매핑 가능).");
      }
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      // ━━━ Edit mode: delete existing ━━━
      if (editMode && existingReservationId) {
        try {
          await fetch("/api/bubble/cancel-reservation", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reservation_id: existingReservationId }),
          });
          console.log("[FOLDER_FLOW] ✅ 기존 예약 삭제 완료");
        } catch (e) {
          console.warn("[FOLDER_FLOW] ⚠️ 기존 예약 삭제 실패:", e);
        }
      }

      // ━━━ STEP 1: pose_reservation 생성 (Bubble) ━━━
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("[FOLDER_FLOW] 🏰 [STEP 1] pose_reservation 생성");
      console.log(`[FOLDER_FLOW]   📁 folder_Id → Bubble Payload: ${finalFolderId}`);
      console.log(`[FOLDER_FLOW]   🎫 tour_Id: ${effectiveTourId}`);
      console.log(`[FOLDER_FLOW]   👤 user_Id: ${userId}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      const step1Payload = {
        folder_Id: finalFolderId,
        tour_Id: effectiveTourId,
        user_Id: userId,
      };
      console.log(`[FOLDER_FLOW]   📤 STEP 1 Payload: ${JSON.stringify(step1Payload)}`);

      const step1Res = await fetch("/api/bubble/pose-reservation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(step1Payload),
      });

      console.log(`[FOLDER_FLOW]   📥 STEP 1 응답 status: ${step1Res.status}`);

      if (!step1Res.ok) {
        const err = await step1Res.json();
        console.error(`[FOLDER_FLOW] ❌ STEP 1 실패:`, err);
        throw new Error(err.error || "Failed to create reservation");
      }

      const step1Data = await step1Res.json();
      console.log(`[FOLDER_FLOW]   📦 STEP 1 응답: ${JSON.stringify(step1Data).substring(0, 300)}`);

      if (!step1Data.success || !step1Data.reservation_id) {
        throw new Error("Reservation creation returned no ID");
      }

      const bubbleReservationId = step1Data.reservation_id;
      console.log(`[FOLDER_FLOW] ✅ [STEP 1] Bubble Reservation ID: ${bubbleReservationId}`);

      // ━━━ STEP 2: reserved_pose 생성 (Bubble) ━━━
      console.log("[FOLDER_FLOW] 🏰 [STEP 2] reserved_pose 레코드 생성");
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

      console.log(`[FOLDER_FLOW]   📸 선택된 포즈 수: ${selectedPoses.length}`);

      if (selectedPoses.length > 0) {
        const step2Res = await fetch("/api/bubble/reserved-pose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pose_reservation_id: bubbleReservationId,
            selected_poses: selectedPoses,
          }),
        });

        console.log(`[FOLDER_FLOW]   📥 STEP 2 응답 status: ${step2Res.status}`);

        if (!step2Res.ok) {
          const err = await step2Res.json();
          console.error(`[FOLDER_FLOW] ❌ STEP 2 실패:`, err);
          throw new Error(err.error || "reserved_pose 저장 실패");
        }

        const step2Data = await step2Res.json();
        console.log(`[FOLDER_FLOW] ✅ [STEP 2] 포즈 저장 완료: ${selectedPoses.length}개`);
        console.log(`[FOLDER_FLOW]   📦 STEP 2 응답: ${JSON.stringify(step2Data).substring(0, 200)}`);
      }

      // ━━━ STEP 3: 백엔드 DB 동기화 확인 ━━━
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("[FOLDER_FLOW] 🔄 [STEP 3] 백엔드 DB 동기화 확인");
      console.log(`[FOLDER_FLOW]   📁 folderId: ${finalFolderId}`);
      console.log(`[FOLDER_FLOW]   🆔 bubbleReservationId: ${bubbleReservationId}`);
      console.log(`[FOLDER_FLOW]   ✅ Bubble 저장: 성공`);
      console.log(`[FOLDER_FLOW]   ⚠️ 백엔드 DB: Webhook/Finalize 로직이 별도 존재하는지 확인 필요`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      // ━━━ STEP 4: QR Code 생성 ━━━
      setReservationId(bubbleReservationId);

      const qrData = `${window.location.origin}/photographer/scan?reservation_id=${bubbleReservationId}`;
      const qrDataUrl = await QRCode.toDataURL(qrData, {
        width: 280,
        margin: 2,
        color: { dark: "#0055FF", light: "#FFFFFF" },
      });
      setQrCodeUrl(qrDataUrl);
      console.log("[FOLDER_FLOW] ✅ [STEP 4] QR 코드 생성 완료");

      // Edit mode cleanup
      if (editMode) {
        setEditMode(false, null, []);
      }

      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("[FOLDER_FLOW] 🎉 전체 예약 프로세스 완료!");
      console.log(`[FOLDER_FLOW]   📁 최종 folderId: ${finalFolderId}`);
      console.log(`[FOLDER_FLOW]   🆔 Bubble Reservation ID: ${bubbleReservationId}`);
      console.log(`[FOLDER_FLOW]   📸 포즈 수: ${selectedPoses.length}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      setPhase("success");

      // Clear store after delay
      setTimeout(() => {
        clearAll();
      }, 2000);
    } catch (error: any) {
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.error("[FOLDER_FLOW] ❌ 예약 프로세스 실패!", error);
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      setErrorMsg(error.message || "예약 처리 중 오류가 발생했습니다.");
      setPhase("error");
    }
  };

  const handleCopy = () => {
    if (reservationId) {
      navigator.clipboard.writeText(reservationId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ✅ 캡처된 요약 우선, fallback으로 store 값 (hydration-safe)
  const safePoseCount = capturedSummary?.poseCount ?? (hasMounted ? getTotalSelectedCount() : 0);
  const safeTotalGuests = capturedSummary?.totalGuests ?? (hasMounted ? guestCount.adults + guestCount.children : 0);
  const safeAiRetouching = capturedSummary?.hasAiRetouching ?? (hasMounted ? aiRetouching : false);
  const safeTourName = capturedSummary?.tourName ?? (hasMounted ? tour?.tour_name : null);
  const safeTourDate = capturedSummary?.tourDate ?? (hasMounted ? tour?.tour_date : null);

  // ━━━ Processing Phase ━━━
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

  // ━━━ Error Phase ━━━
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
            className="w-full py-3.5 rounded-2xl bg-[#0055FF] text-white font-bold shadow-lg shadow-blue-500/25"
          >
            마이페이지로 이동
          </button>
        </motion.div>
      </div>
    );
  }

  // ━━━ Google Map 열기 ━━━
  const openGoogleMap = () => {
    const location = tour?.tour_location || safeTourName || "교토";
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`, "_blank");
  };

  // ━━━ Success Phase ━━━
  return (
    <div className="min-h-screen bg-[#FFF9F5] flex flex-col items-center px-5 py-8">
      {/* ━━━ 투어 이미지 배경 카드 ━━━ */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", duration: 0.7 }}
        className="max-w-sm w-full relative overflow-hidden rounded-3xl shadow-xl mb-4"
      >
        {/* 배경 이미지 */}
        {hasMounted && tour?.tour_thumbnail ? (
          <div className="relative h-48 bg-gradient-to-br from-[#0055FF] to-[#7B2BFF]">
            <img src={tour.tour_thumbnail} alt={safeTourName || ""} className="w-full h-full object-cover opacity-70" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-4 left-5 right-5">
              <motion.h2 initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-2xl font-extrabold text-white mb-0.5">
                예약이 확정되었습니다!
              </motion.h2>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="text-white/80 text-sm">
                촬영 당일 아래 QR을 보여주세요
              </motion.p>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-[#0055FF] to-[#7B2BFF] px-6 py-8 text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: "spring" }}
              className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3"><Plane className="w-7 h-7 text-white" /></motion.div>
            <h2 className="text-2xl font-extrabold text-white mb-1">예약이 확정되었습니다!</h2>
            <p className="text-white/80 text-sm">촬영 당일 아래 QR을 보여주세요</p>
          </div>
        )}

        {/* 카드 본문 */}
        <div className="bg-white p-6">
          {/* QR Code (Bubble unique_ID) */}
          {qrCodeUrl && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }} className="mb-5 text-center">
              <div className="bg-sky-50 rounded-2xl p-5 inline-block">
                <img src={qrCodeUrl} alt="Reservation QR" className="w-48 h-48 mx-auto" />
              </div>
            </motion.div>
          )}

          {/* Reservation ID */}
          {reservationId && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="bg-gray-50 rounded-xl p-3.5 mb-4">
              <p className="text-xs text-gray-400 mb-1">예약번호 (QR Data: Bubble unique_ID)</p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-xs font-mono font-bold text-gray-700 break-all">{reservationId}</span>
                <button onClick={handleCopy} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors flex-shrink-0">
                  {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                </button>
              </div>
            </motion.div>
          )}

          {/* Reservation Summary */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="bg-[#0055FF]/5 rounded-xl p-4 mb-4 text-left">
            <div className="space-y-2">
              {safeTourName && (<div className="flex items-center gap-2 text-sm"><Plane className="w-3.5 h-3.5 text-[#0055FF]" /><span className="text-gray-700">{safeTourName}</span></div>)}
              {safeTourDate && (<div className="flex items-center gap-2 text-sm"><Calendar className="w-3.5 h-3.5 text-[#0055FF]" /><span className="text-gray-700">{formatKSTDate(safeTourDate!)}</span></div>)}
              <div className="flex items-center gap-2 text-sm"><Users className="w-3.5 h-3.5 text-[#0055FF]" /><span className="text-gray-700">{safeTotalGuests}명</span></div>
              <div className="flex items-center gap-2 text-sm"><Camera className="w-3.5 h-3.5 text-[#0055FF]" /><span className="text-gray-700">포즈 {safePoseCount}개</span></div>
              {safeAiRetouching && (<div className="flex items-center gap-2 text-sm"><Sparkles className="w-3.5 h-3.5 text-purple-500" /><span className="text-gray-700">AI 보정 포함</span></div>)}
            </div>
          </motion.div>

          {/* Google Map 확인 버튼 */}
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.75 }}
            onClick={openGoogleMap}
            className="w-full py-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-bold mb-4 active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:bg-green-100">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            촬영지 위치 확인 (Google Map)
          </motion.button>

          {/* Action Buttons */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="flex gap-3">
            <button onClick={() => router.push("/cheiz/my-tours")}
              className="flex-1 py-3.5 rounded-2xl bg-[#0055FF] text-white font-bold shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5">
              <User className="w-4 h-4" /> 마이페이지
            </button>
            <button onClick={() => router.push("/cheiz")}
              className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-600 font-medium hover:bg-gray-200 transition-all flex items-center justify-center gap-1.5">
              <Home className="w-4 h-4" /> 홈으로
            </button>
          </motion.div>
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
