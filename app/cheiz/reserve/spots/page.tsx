"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useReservationStore, validateReservation, type Tour, type Spot } from "@/lib/reservation-store";

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
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const tourIdParam = searchParams.get("tour_id");
  const folderIdParam = searchParams.get("folder_id"); // ✅ 출입증 확보
  const [loading, setLoading] = useState(true);
  
  const modeParam = searchParams.get("mode"); // ✅ edit 모드 감지
  
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
  } = useReservationStore();
  
  const [restoringPoses, setRestoringPoses] = useState(false);
  
  // Validation state
  const [validation, setValidation] = useState<ReturnType<typeof validateReservation> | null>(null);

  // Step 1: Tour 유효성 검증
  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/api/auth/signin");
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

  // Fetch tour data
  const fetchTourData = async (tourIdValue: number) => {
    try {
      const response = await fetch(`/api/bubble/tour/${tourIdValue}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch tour");
      }

      const data = await response.json();
      setTour(data.tour); // ✅ Zustand
      
      console.log("🎯 [TOUR DATA] Loaded:", {
        tour_Id: data.tour.tour_Id,
        max_total: data.tour.max_total,
        min_total: data.tour.min_total,
      });

      fetchSpots(tourIdValue);
    } catch (error) {
      console.error("Error fetching tour data:", error);
      setTour(null); // ✅ Zustand
      setLoading(false);
    }
  };

  // Spot 목록 가져오기
  const fetchSpots = async (tourIdValue: number) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/bubble/spots/${tourIdValue}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch spots");
      }

      const data = await response.json();
      const spotsData = data.spots || [];
      setSpots(spotsData); // ✅ Zustand (will auto-initialize selections)
      
      console.log("📍 [SPOTS] Initialized:", spotsData.length);
    } catch (error) {
      console.error("Error fetching spots:", error);
      setSpots([]); // ✅ Zustand
    } finally {
      setLoading(false);
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

      // 각 spot의 poses를 가져와서 매칭
      for (const spot of spots) {
        if (!spot.spot_Id) continue;

        try {
          const res = await fetch(`/api/bubble/spot-poses-by-spot/${spot.spot_Id}`);
          if (!res.ok) continue;
          
          const data = await res.json();
          const spotPoses = data.poses || [];

          // spot 초기화
          initializeSpotSelection(
            spot.spot_Id,
            spot.spot_name || `Spot ${spot.spot_Id}`,
            spot.min_count_limit || 0
          );

          // 해당 spot의 pose 중 기존 선택된 것 복원
          for (const pose of spotPoses) {
            if (poseIdsToRestore.includes(pose._id)) {
              addPose(spot.spot_Id, pose._id);
              console.log(`  ✅ [RESTORE] spot=${spot.spot_Id}, pose=${pose._id}`);
            }
          }
        } catch (e) {
          console.error(`❌ [EDIT MODE] spot ${spot.spot_Id} 포즈 로드 실패:`, e);
        }
      }

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
  const handleSpotSelect = (spot: Spot) => {
    if (!spot.spot_Id || !tourId) return;
    
    // ✅ [강제] 필수 파라미터 모두 전달
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📍 [NAV] Moving to poses:");
    console.log("  🎫 tour_id:", tourId);
    console.log("  📁 folder_id:", folderId || "⚠️ MISSING");
    console.log("  📍 spot_id:", spot.spot_Id);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    // ✅ folder_id가 없으면 경고
    if (!folderId) {
      console.error("🚨 [NAV] folder_id 없이 이동 시도! 예약 실패 가능성 높음!");
    }
    
    const url = `/cheiz/reserve/poses?tour_id=${tourId}&spot_id=${spot.spot_Id}${folderId ? `&folder_id=${folderId}` : ''}`;
    router.push(url);
  };

  // 리뷰 페이지로 이동
  const handleProceedToReview = () => {
    if (!validation?.canProceedToReview) {
      alert(validation?.globalMessage || "선택 조건을 확인해주세요.");
      return;
    }

    if (!tourId) {
      alert("투어 정보를 확인할 수 없습니다.");
      return;
    }

    // ✅ [강제] folder_id 검증
    if (!folderId) {
      alert("Folder ID를 확인할 수 없습니다. 처음부터 다시 시작해주세요.");
      console.error("🚨 [NAV] folder_id 없이 리뷰 페이지 이동 차단!");
      return;
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📋 [NAV] Moving to review page:");
    console.log("  🎫 tour_id:", tourId);
    console.log("  📁 folder_id:", folderId);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    router.push(`/cheiz/reserve/review?tour_id=${tourId}&folder_id=${folderId}`);
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
            className="bg-skyblue text-white font-bold py-4 px-8 rounded-3xl hover:bg-opacity-90 transition-all transform hover:scale-105 shadow-lg"
          >
            쿠폰 조회하기
          </button>
        </motion.div>
      </div>
    );
  }

  // 로딩 중
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-skyblue border-solid mx-auto mb-4"></div>
          <p className="text-gray-600">투어 정보를 불러오는 중...</p>
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
            onClick={() => router.push("/cheiz/my-tours")}
            className="hover:text-skyblue transition-colors"
          >
            ← 마이페이지
          </button>
          <span className="text-gray-300">|</span>
          <span className="font-medium text-gray-700">스팟 선택</span>
        </div>
      </div>

      {/* Inline Progress Indicator (헤더 아래 간결 표시) */}
      {validation && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100">
            <div className="flex-1">
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${
                    getTotalSelectedCount() >= (tour?.max_total || 99)
                      ? "bg-red-500"
                      : getTotalSelectedCount() >= (tour?.min_total || 0)
                      ? "bg-green-500"
                      : "bg-skyblue"
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((getTotalSelectedCount() / (tour?.max_total || 99)) * 100, 100)}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
            <span className={`text-sm font-bold whitespace-nowrap ${
              getTotalSelectedCount() >= (tour?.max_total || 99)
                ? "text-red-500"
                : getTotalSelectedCount() >= (tour?.min_total || 0)
                ? "text-green-500"
                : "text-gray-500"
            }`}>
              {getTotalSelectedCount()} / {tour?.max_total || "?"}
            </span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-4xl font-bold text-gray-800 mb-2">
            촬영 스팟 선택
          </h2>
          <p className="text-gray-600">
            원하는 스팟을 선택하여 포즈를 골라보세요 ✨
          </p>
        </div>

        {/* Spot Selection */}
        <div>
          <h3 className="text-2xl font-bold text-gray-800 mb-6">
            스팟 리스트
          </h3>
            {!spots || spots.length === 0 ? (
              <p className="text-gray-500 text-center py-12">
                사용 가능한 스팟이 없습니다.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {spots.map((spot) => {
                  const spotValidation = validation?.spotValidations.find(
                    (v) => v.spotId === spot.spot_Id
                  );

                  return (
                  <motion.div
                    key={spot._id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.3 }}
                    onClick={() => handleSpotSelect(spot)}
                    className="bg-white rounded-3xl shadow-lg overflow-hidden cursor-pointer group relative"
                  >
                    {spot.thumbnail && (
                      <div className="relative h-48 bg-gray-100">
                        <Image
                          src={normalizeImageUrl(spot.thumbnail) || ""}
                          alt={spot.spot_name || "Spot"}
                          fill
                          className="object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      </div>
                    )}
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xl font-bold text-gray-800">
                          {spot.spot_name || `Spot ${spot.spot_Id}`}
                        </h4>
                        {/* Status Badge */}
                        {spotValidation && (
                          <div>
                            {spotValidation.status === "complete" && (
                              <span className="text-2xl">✅</span>
                            )}
                            {spotValidation.status === "incomplete" && (
                              <span className="text-2xl">⚠️</span>
                            )}
                          </div>
                        )}
                      </div>
                      {spotValidation?.message && (
                        <p className="text-red-500 text-sm font-medium mb-2">
                          {spotValidation.message}
                        </p>
                      )}
                      {spotValidation && (
                        <p className="text-gray-600 text-sm mb-2">
                          선택됨: {spotValidation.count}개
                          {spotValidation.minRequired > 0 && ` / 최소 ${spotValidation.minRequired}개`}
                        </p>
                      )}
                      <p className="text-skyblue font-medium">
                        포즈 선택하기 →
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Proceed to Review Button (Fixed) */}
      {validation && getTotalSelectedCount() > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl z-50">
          <div className="max-w-7xl mx-auto px-6 py-4">
            {validation.globalMessage && (
              <p className="text-center text-red-500 font-medium mb-3">
                {validation.globalMessage}
              </p>
            )}
            <button
              onClick={handleProceedToReview}
              disabled={!validation.canProceedToReview}
              className={`w-full py-4 rounded-3xl font-bold text-lg transition-all ${
                validation.canProceedToReview
                  ? "bg-skyblue text-white hover:bg-opacity-90 shadow-lg"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
            >
              선택 내역 확인하기 ({getTotalSelectedCount()}개)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SpotsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-skyblue border-solid"></div>
      </div>
    }>
      <SpotsContent />
    </Suspense>
  );
}
