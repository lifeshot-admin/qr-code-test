"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { Camera, Loader2 } from "lucide-react";
import { useReservationStore, validateReservation, type Tour, type Spot } from "@/lib/reservation-store";
import { useHasMounted } from "@/lib/use-has-mounted";

/**
 * 이미지 URL 정규화
 */
function normalizeImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return url;
}

function SpotsContent() {
  const hasMounted = useHasMounted();
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const tourIdParam = searchParams.get("tour_id");
  const folderIdParam = searchParams.get("folder_id"); // ✅ 출입증 확보
  const [loading, setLoading] = useState(true);
  const [navigating, setNavigating] = useState(false);

  const modeParam = searchParams.get("mode");
  
  // ✅ Zustand store
  const {
    tourId,
    tour,
    spots,
    spotSelections,
    folderId,
    editMode,
    pendingPoseIds,
    setTourId,
    setTour,
    setSpots,
    setFolderId,
    getTotalSelectedCount,
    consumePendingPoseIds,
    addPose,
    initializeSpotSelection,
    setEditMode,
    clearSelections,
  } = useReservationStore();
  
  const [restoringPoses, setRestoringPoses] = useState(false);
  
  // Validation state
  const [validation, setValidation] = useState<ReturnType<typeof validateReservation> | null>(null);

  // ✅ 인원 선택은 투어 상세 페이지에서만 처리 → spots에서는 자동 시트 없음

  // Step 1: Tour 유효성 검증
  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.replace("/auth/signin?callbackUrl=" + encodeURIComponent(window.location.pathname + window.location.search));
      return;
    }

    if (!tourIdParam) {
      setLoading(false);
      setTourId(null);
      return;
    }

    const parsedTourId = parseInt(tourIdParam, 10);
    if (isNaN(parsedTourId)) {
      setLoading(false);
      setTourId(null);
      return;
    }

    // ✅ [STALE 가드] URL의 tour_id와 Zustand store의 tourId가 다르면 선택 데이터 초기화
    // localStorage에 이전 세션의 stale tourId(예: 28)가 남아있으면 새 투어(27)와 충돌
    if (tourId !== null && tourId !== parsedTourId) {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🚨 [STALE 가드] URL tour_id와 Store tourId 불일치 감지!");
      console.log(`  📥 URL tour_id: ${parsedTourId}`);
      console.log(`  📦 Store tourId (stale): ${tourId}`);
      console.log("  🗑️ → 이전 세션 선택 데이터 초기화!");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      // 이전 투어의 spotSelections 등을 정리
      clearSelections();
    }
    
    setTourId(parsedTourId);
    
    // ✅ [강제] URL에서 folder_id를 Zustand에 자동 주입
    if (folderIdParam) {
      const parsedFolderId = parseInt(folderIdParam, 10);
      if (!isNaN(parsedFolderId)) {
        setFolderId(parsedFolderId);
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("✅ [SYNC] URL에서 folder_id를 스토어에 저장함:", parsedFolderId);
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      }
    } else {
      console.warn("⚠️ [SYNC] URL에 folder_id 없음, 기존 스토어 값 사용:", folderId);
    }
    
    fetchTourData(parsedTourId);
  }, [status, session, tourIdParam, folderIdParam, router, setTourId, setFolderId, folderId]);

  // Fetch tour data + spots 병렬 호출
  const fetchTourData = async (tourIdValue: number) => {
    try {
      setLoading(true);
      const [tourRes, spotsRes] = await Promise.all([
        fetch(`/api/bubble/tour/${tourIdValue}`),
        fetch(`/api/bubble/spots/${tourIdValue}`),
      ]);

      if (!tourRes.ok) throw new Error("Failed to fetch tour");
      const tourData = await tourRes.json();
      setTour(tourData.tour);

      if (spotsRes.ok) {
        const spotsData = await spotsRes.json();
        processSpotsData(spotsData, tourIdValue);
      }
      setLoading(false);
    } catch (error) {
      console.error("[SPOTS] 데이터 로드 실패:", error);
      setTour(null);
      setLoading(false);
    }
  };

  // Spot 데이터 처리
  const processSpotsData = (data: any, tourIdValue: number) => {
    try {
      const spotsArr = data.spots || [];
      setSpots(spotsArr);
    } catch (error) {
      console.error("[SPOTS] 처리 실패:", error);
      setSpots([]);
    }
  };

  // ✅ [수정 모드] 기존 포즈 복원 로직
  useEffect(() => {
    if (!editMode || !modeParam || modeParam !== "edit") return;
    if (spots.length === 0 || pendingPoseIds.length === 0) return;
    if (restoringPoses) return;

    const restorePoses = async () => {
      setRestoringPoses(true);
      console.log("✏️ [EDIT MODE] 기존 포즈 복원 시작:", pendingPoseIds.length, "개");

      // pendingPoseIds를 소비 (1회만)
      const poseIdsToRestore = consumePendingPoseIds();
      if (poseIdsToRestore.length === 0) {
        setRestoringPoses(false);
        return;
      }

      // 각 spot의 poses를 병렬로 가져와서 매칭
      await Promise.allSettled(
        spots.filter(spot => spot.spot_Id).map(async (spot) => {
          try {
            const res = await fetch(`/api/bubble/spot-poses-by-spot/${spot.spot_Id}`);
            if (!res.ok) return;
            const data = await res.json();
            const spotPoses = data.poses || [];

            initializeSpotSelection(
              spot.spot_Id,
              spot.spot_name || `Spot ${spot.spot_Id}`,
              spot.min_count_limit || 0
            );

            for (const pose of spotPoses) {
              if (poseIdsToRestore.includes(pose._id)) {
                addPose(spot.spot_Id, pose._id);
              }
            }
          } catch (e) {
            console.error(`[EDIT MODE] spot ${spot.spot_Id} 포즈 로드 실패:`, e);
          }
        })
      );

      console.log("✏️ [EDIT MODE] 포즈 복원 완료");
      setRestoringPoses(false);
    };

    restorePoses();
  }, [editMode, modeParam, spots, pendingPoseIds]);

  // Validation 실행
  useEffect(() => {
    if (tour && Object.keys(spotSelections).length > 0) {
      const result = validateReservation(
        spotSelections,
        tour.min_total || 0,
        tour.max_total || 99
      );
      setValidation(result);
    }
  }, [tour, spotSelections]);

  // 스팟 선택 시 포즈 선택 페이지로 이동
  // ✅ URL 파라미터 우선: Zustand store 대신 URL에서 가져온 값을 강제 사용
  const handleSpotSelect = (spot: Spot) => {
    // URL 파라미터에서 가져온 값을 최우선 사용 (store의 stale 값 방지)
    const safeTourId = tourIdParam ? parseInt(tourIdParam, 10) : tourId;
    if (!spot.spot_Id || !safeTourId) return;
    
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📍 [NAV] Moving to poses:");
    console.log(`  🎫 tour_id (URL우선): ${safeTourId}`);
    console.log(`  🎫 tour_id (Store): ${tourId}`);
    if (safeTourId !== tourId) {
      console.log("  🚨 URL과 Store 값이 다름! URL 값 사용!");
    }
    console.log(`  📁 folder_id: ${folderId || "(신규 예약 - 없음)"}`);
    console.log(`  📍 spot_id: ${spot.spot_Id}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    // folder_id는 신규 예약 시 없는 것이 정상 (결제 완료 후 생성됨)
    let url = `/cheiz/reserve/poses?tour_id=${safeTourId}&spot_id=${spot.spot_Id}`;
    if (folderId) url += `&folder_id=${folderId}`;
    console.log(`  📡 [NAV] 최종 이동 URL: ${url}`);
    router.push(url);
  };

  // 다음 단계로 이동 (신규: AI 보정 / 수정: DB 갱신 후 마이페이지)
  // ✅ URL 파라미터 우선: Zustand store 대신 URL에서 가져온 값을 강제 사용
  const handleProceedToReview = () => {
    if (!validation?.canProceedToReview) {
      alert(validation?.globalMessage || "선택 조건을 확인해주세요.");
      return;
    }

    const safeTourId = tourIdParam ? parseInt(tourIdParam, 10) : tourId;
    if (!safeTourId) {
      alert("투어 정보를 확인할 수 없습니다.");
      return;
    }

    // ✅ [수정 모드] 결제 건너뛰기 → Bubble DB 갱신 → 마이페이지 복귀
    if (editMode && modeParam === "edit") {
      handleUpdatePoses(safeTourId);
      return;
    }

    // ✅ [신규 예약] review 페이지 건너뛰고 AI 보정 페이지로 직행
    setNavigating(true);
    let aiUrl = `/cheiz/reserve/ai-retouching?tour_id=${safeTourId}`;
    if (folderId) aiUrl += `&folder_id=${folderId}`;
    router.push(aiUrl);
  };

  // ✅ [수정 모드 전용] 포즈 수정 완료 → Bubble DB 갱신(Delete & Insert) → 마이페이지 복귀
  const [updatingPoses, setUpdatingPoses] = useState(false);
  const { existingReservationId } = useReservationStore();

  const handleUpdatePoses = async (safeTourId: number) => {
    if (updatingPoses) return;
    setUpdatingPoses(true);

    try {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("[EDIT_MODE] ✏️ 포즈 수정 완료 → DB 갱신 시작");
      console.log(`  🆔 reservationId: ${existingReservationId}`);
      console.log(`  📁 folderId: ${folderId}`);
      console.log(`  🎫 tourId: ${safeTourId}`);

      if (!existingReservationId) {
        alert("수정할 예약 정보를 찾을 수 없습니다.");
        setUpdatingPoses(false);
        return;
      }

      // Step 1: 기존 reserved_pose 삭제
      console.log("[EDIT_MODE] 🗑 기존 포즈 삭제 중...");
      const deleteRes = await fetch("/api/bubble/cancel-reservation", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservation_id: existingReservationId }),
      });

      if (!deleteRes.ok) {
        console.warn("[EDIT_MODE] ⚠️ 기존 예약 삭제 실패, 새로 생성 시도...");
      } else {
        console.log("[EDIT_MODE] ✅ 기존 포즈 삭제 완료");
      }

      // Step 2: 새 pose_reservation 생성
      console.log("[EDIT_MODE] 📝 새 pose_reservation 생성 중...");
      const step1Res = await fetch("/api/bubble/pose-reservation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folder_Id: folderId,
          tour_Id: safeTourId,
          user_Id: session?.user?.id,
        }),
      });

      if (!step1Res.ok) {
        throw new Error("새 예약 생성에 실패했습니다.");
      }

      const step1Data = await step1Res.json();
      const newReservationId = step1Data.reservation_id;
      console.log(`[EDIT_MODE] ✅ 새 reservation ID: ${newReservationId}`);

      // Step 3: 새로 선택한 포즈들 저장
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

      console.log(`[EDIT_MODE] 📸 새 포즈 ${selectedPoses.length}개 저장 중...`);

      if (selectedPoses.length > 0) {
        const step2Res = await fetch("/api/bubble/reserved-pose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pose_reservation_id: newReservationId,
            selected_poses: selectedPoses,
          }),
        });

        if (!step2Res.ok) {
          throw new Error("포즈 저장에 실패했습니다.");
        }
      }

      console.log("[EDIT_MODE] 🎉 포즈 수정 완료!");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      // 수정 모드 해제
      setEditMode(false, null, []);

      alert("포즈가 성공적으로 수정되었습니다!");
      router.push("/cheiz/my-tours");
    } catch (error: any) {
      console.error("[EDIT_MODE] ❌ 포즈 수정 실패:", error);
      alert(`수정 실패: ${error.message}`);
    } finally {
      setUpdatingPoses(false);
    }
  };

  // Tour가 없는 경우
  if (!loading && !tourId) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-md w-full text-center"
        >
          <div className="text-6xl mb-6">📭</div>
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            활성화된 투어 예약이 없습니다
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            먼저 쿠폰을 조회하여 투어를 확인해주세요.
          </p>
          <button
            onClick={() => router.push("/cheiz")}
            className="bg-[#0055FF] text-white font-bold py-4 px-8 rounded-xl hover:bg-opacity-90 transition-all transform hover:scale-105 shadow-sm"
          >
            쿠폰 조회하기
          </button>
        </motion.div>
      </div>
    );
  }

  // 로딩 중 — 스켈레톤 UI
  if (loading) {
    return (
      <div className="min-h-screen bg-white max-w-md mx-auto animate-pulse">
        <div className="px-5 pt-12 pb-4 flex items-center gap-3">
          <div className="h-6 w-6 bg-gray-200 rounded" />
          <div className="h-[18px] bg-gray-200 rounded w-20" />
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="h-[60px] bg-gray-200 rounded-xl w-full" />
        </div>
        <div className="px-5 py-3 flex gap-2">
          {[1,2,3,4].map(i => <div key={i} className="h-1 bg-gray-200 rounded-full flex-1" />)}
        </div>
        <div className="px-5 pt-4 space-y-4">
          <div className="h-4 bg-gray-200 rounded w-32" />
          <div className="grid grid-cols-2 gap-3">
            {[1,2,3,4].map(i => <div key={i} className="h-[120px] bg-gray-200 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  // Hydration-safe count
  const safeSelectedCount = hasMounted ? getTotalSelectedCount() : 0;

  return (
    <div className="min-h-screen bg-[#FFF9F5] pb-32">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-orange-100/50">
        <div className="max-w-md mx-auto px-5 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push("/cheiz/my-tours")}
            className="text-gray-500 hover:text-[#0055FF] transition-colors text-sm flex items-center gap-1"
          >
            <span className="text-lg">&#8249;</span> 돌아가기
          </button>
          {/* Step Indicator */}
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-1.5 rounded-full bg-[#0055FF]" />
            <div className="w-8 h-1.5 rounded-full bg-gray-200" />
            <div className="w-8 h-1.5 rounded-full bg-gray-200" />
          </div>
          {validation && (
            <span className={`text-sm font-bold ${
              safeSelectedCount >= (tour?.min_total || 0)
                ? "text-green-500" : "text-gray-400"
            }`}>
              {safeSelectedCount}/{tour?.max_total || "?"}
            </span>
          )}
        </div>
      </div>

      {/* Travel Vibe Hero */}
      <div className="max-w-md mx-auto px-5 pt-8 pb-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-sm font-medium text-[#FF4B2B] tracking-wider uppercase mb-2">
            Step 1 of 3
          </p>
          <h2 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">
            어디서 촬영할까요?
          </h2>
          <p className="text-base text-gray-500 leading-relaxed">
            작가 추천 스팟에서 인생샷을 남겨보세요!<br />
            포즈를 고르면, 포토그래퍼가 원하는 포즈를<br />
            정확하게 찍어드릴 수 있어요.
          </p>
        </motion.div>
      </div>

      {/* Progress Bar */}
      {validation && (
        <div className="max-w-md mx-auto px-5 py-3">
          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                safeSelectedCount >= (tour?.max_total || 99)
                  ? "bg-red-400"
                  : safeSelectedCount >= (tour?.min_total || 0)
                  ? "bg-green-400"
                  : "bg-[#0055FF]"
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((safeSelectedCount / (tour?.max_total || 99)) * 100, 100)}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>
      )}

      {/* Spot Grid - 2x2 Polaroid Style */}
      <div className="max-w-md mx-auto px-5 py-4">
        {!spots || spots.length === 0 ? (
          <p className="text-gray-400 text-center py-16">
            사용 가능한 스팟이 없습니다.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {spots.map((spot, index) => {
              const spotValidation = validation?.spotValidations.find(
                (v) => v.spotId === spot.spot_Id
              );
              const rotations = [-1.5, 1, -0.5, 1.5, -1, 0.5];
              const rotation = rotations[index % rotations.length];

              return (
                <motion.div
                  key={spot._id}
                  initial={{ opacity: 0, y: 30, rotate: rotation * 2 }}
                  animate={{ opacity: 1, y: 0, rotate: rotation }}
                  whileHover={{ scale: 1.05, rotate: 0, zIndex: 10 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.4, delay: index * 0.08 }}
                  onClick={() => handleSpotSelect(spot)}
                  className="cursor-pointer group"
                  style={{ transformOrigin: "center center" }}
                >
                  {/* Polaroid Card */}
                  <div className="bg-white rounded-xl p-2 pb-4 shadow-md hover:shadow-xl transition-shadow duration-300 border border-gray-100/80">
                    {/* Photo */}
                    <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                      {spot.thumbnail ? (
                        <Image
                          src={normalizeImageUrl(spot.thumbnail) || ""}
                          alt={spot.spot_name || "Spot"}
                          fill
                          className="object-cover group-hover:scale-110 transition-transform duration-500"
                          quality={60}
                          sizes="(max-width: 768px) 45vw, 200px"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-300">
                          <Camera className="w-10 h-10" />
                        </div>
                      )}
                      {/* Status Overlay */}
                      {spotValidation && spotValidation.status === "complete" && (
                        <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shadow-md">
                          {spotValidation.count}
                        </div>
                      )}
                      {spotValidation && spotValidation.status === "incomplete" && (
                        <div className="absolute top-2 right-2 bg-orange-400 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold shadow-md">
                          {spotValidation.count}
                        </div>
                      )}
                    </div>
                    {/* Label */}
                    <div className="pt-2.5 px-1">
                      <h4 className="text-sm font-bold text-gray-800 truncate">
                        {spot.spot_name || `Spot ${spot.spot_Id}`}
                      </h4>
                      {spotValidation?.message ? (
                        <p className="text-xs text-orange-500 mt-0.5 truncate">{spotValidation.message}</p>
                      ) : (
                        <p className="text-xs text-[#0055FF] mt-0.5 font-medium">
                          포즈 고르기 &rarr;
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fixed Bottom CTA - 모드에 따라 버튼 변경 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 z-50">
        <div className="max-w-md mx-auto px-5 py-4">
          {validation?.globalMessage && (
            <p className="text-center text-red-500 text-sm font-medium mb-2">
              {validation.globalMessage}
            </p>
          )}
          {editMode && modeParam === "edit" ? (
            /* ✅ 수정 모드: 결제 동선 없이 바로 DB 갱신 */
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setEditMode(false, null, []);
                  router.push("/cheiz/my-tours");
                }}
                className="flex-1 py-3.5 rounded-2xl font-medium text-sm border border-gray-300 text-gray-500 bg-transparent hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleProceedToReview}
                disabled={!validation?.canProceedToReview || updatingPoses}
                className={`flex-[2] py-3.5 rounded-2xl font-bold text-sm transition-all ${
                  validation?.canProceedToReview && !updatingPoses
                    ? "bg-green-500 text-white shadow-lg shadow-green-500/25 active:scale-[0.98]"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                {updatingPoses ? "수정 중..." : `포즈 수정 완료 (${safeSelectedCount}개)`}
              </button>
            </div>
          ) : (
            /* ✅ 신규 예약 모드: 기존 동선 유지 */
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const safeTourId = tourIdParam ? parseInt(tourIdParam, 10) : tourId;
                  let skipUrl = `/cheiz/reserve/ai-retouching?tour_id=${safeTourId}`;
                  if (folderId) skipUrl += `&folder_id=${folderId}`;
                  router.push(skipUrl);
                }}
                className="flex-1 py-3.5 rounded-2xl font-medium text-sm border border-gray-300 text-gray-500 bg-transparent hover:bg-gray-50 transition-colors"
              >
                건너뛰기
              </button>
              <button
                onClick={handleProceedToReview}
                disabled={!validation?.canProceedToReview || navigating || updatingPoses}
                className={`flex-[2] py-3.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                  validation?.canProceedToReview && !navigating && !updatingPoses
                    ? "bg-[#0055FF] text-white shadow-lg shadow-blue-500/25 active:scale-[0.98]"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                {navigating || updatingPoses ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />처리 중...</>
                ) : (
                  <>포즈 선택 완료 ({safeSelectedCount}개)</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 인원 선택은 투어 상세 페이지에서 처리 → spots에서는 GuestSheet 없음 */}
    </div>
  );
}

export default function SpotsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-[#0055FF] border-solid"></div>
      </div>
    }>
      <SpotsContent />
    </Suspense>
  );
}
