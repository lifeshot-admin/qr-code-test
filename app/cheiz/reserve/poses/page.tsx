"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useReservationStore, type Tour, type Spot } from "@/lib/reservation-store";

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

function PosesContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const tourIdParam = searchParams.get("tour_id");
  const spotIdParam = searchParams.get("spot_id");
  const folderIdParam = searchParams.get("folder_id"); // ✅ 출입증 확보
  
  const [spotId, setSpotId] = useState<number | null>(null);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [selectedPersona, setSelectedPersona] = useState("전체");
  const [personas, setPersonas] = useState<string[]>(["전체"]);
  const [poses, setPoses] = useState<SpotPose[]>([]);
  const [allPoses, setAllPoses] = useState<SpotPose[]>([]); // 필터링 전 전체 포즈
  const [loadingPoses, setLoadingPoses] = useState(false);
  
  // ✅ Zustand store
  const {
    tourId,
    tour,
    folderId,
    setTourId,
    setFolderId,
    addPose,
    removePose,
    isPoseSelected,
    getTotalSelectedCount,
    getSpotSelectedCount,
    initializeSpotSelection,
  } = useReservationStore();

  // Step 1: 초기화
  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/api/auth/signin");
      return;
    }

    if (!tourIdParam || !spotIdParam) {
      router.push("/cheiz/reserve/spots" + (tourIdParam ? `?tour_id=${tourIdParam}` : ""));
      return;
    }

    const parsedTourId = parseInt(tourIdParam, 10);
    const parsedSpotId = parseInt(spotIdParam, 10);
    
    if (isNaN(parsedTourId) || isNaN(parsedSpotId)) {
      router.push("/cheiz/reserve/spots");
      return;
    }

    setTourId(parsedTourId); // ✅ Zustand
    setSpotId(parsedSpotId);
    
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
    fetchSpotData(parsedSpotId);
    fetchPoses(parsedSpotId);
  }, [status, session, tourIdParam, spotIdParam, folderIdParam, router, setTourId, setFolderId, folderId]);

  // Fetch tour data
  const fetchTourData = async (tourIdValue: number) => {
    try {
      const response = await fetch(`/api/bubble/tour/${tourIdValue}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch tour");
      }

      const data = await response.json();
      // Tour is already in store, no need to set again
    } catch (error) {
      console.error("Error fetching tour data:", error);
    }
  };

  // Fetch spot data
  const fetchSpotData = async (spotIdValue: number) => {
    try {
      const response = await fetch(`/api/bubble/spot/${spotIdValue}`);
      
      if (response.ok) {
        const data = await response.json();
        setSpot(data.spot);
      }
    } catch (error) {
      console.error("Error fetching spot data:", error);
    }
  };

  // Fetch poses
  const fetchPoses = async (spotIdValue: number) => {
    try {
      setLoadingPoses(true);
      const response = await fetch(`/api/bubble/spot-poses-by-spot/${spotIdValue}`);

      if (!response.ok) {
        throw new Error("Failed to fetch poses");
      }

      const data = await response.json();
      const posesData = data.poses || [];
      setAllPoses(posesData);
      setPoses(posesData);
      
      // 페르소나 목록 추출
      const personaSet = new Set<string>(["전체"]);
      posesData.forEach((pose: SpotPose) => {
        if (pose.persona) {
          personaSet.add(pose.persona);
        }
      });
      setPersonas(Array.from(personaSet));
      
      console.log("📸 [POSES] Loaded:", posesData.length);
    } catch (error) {
      console.error("Error fetching poses:", error);
      setPoses([]);
    } finally {
      setLoadingPoses(false);
      setLoading(false);
    }
  };

  // 페르소나 필터 변경
  useEffect(() => {
    if (selectedPersona === "전체") {
      setPoses(allPoses);
    } else {
      const filtered = allPoses.filter((pose) => pose.persona === selectedPersona);
      setPoses(filtered);
    }
  }, [selectedPersona, allPoses]);

  // 페르소나별 카운트 계산
  const getPersonaCount = (persona: string): number => {
    if (persona === "전체") {
      return allPoses.length;
    }
    return allPoses.filter((pose) => pose.persona === persona).length;
  };

  // Initialize spot selection when first entering
  useEffect(() => {
    if (spotId && spot) {
      initializeSpotSelection(
        spotId,
        spot.spot_name || `Spot ${spotId}`,
        spot.min_count_limit || 0
      );
    }
  }, [spotId, spot, initializeSpotSelection]);

  // 포즈 선택/해제
  const togglePoseSelection = (poseId: string) => {
    if (!spotId || !tour) return;

    const isCurrentlySelected = isPoseSelected(spotId, poseId);

    if (isCurrentlySelected) {
      // 제거 (항상 가능)
      removePose(spotId, poseId);
    } else {
      // 추가 (store에서 검증)
      const success = addPose(spotId, poseId);
      if (!success) {
        alert(`최대 ${tour.max_total}개까지만 선택 가능합니다.`);
      }
    }
  };

  // 뒤로가기
  const handleBack = () => {
    if (tourId) {
      // ✅ [강제] 필수 파라미터 모두 전달
      const url = `/cheiz/reserve/spots?tour_id=${tourId}${folderId ? `&folder_id=${folderId}` : ''}`;
      
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🔙 [BACK] Returning to spots:");
      console.log("  🎫 tour_id:", tourId);
      console.log("  📁 folder_id:", folderId || "⚠️ MISSING");
      console.log("  📍 URL:", url);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      
      router.push(url);
    } else {
      router.back();
    }
  };

  // 현재 스팟의 선택 개수
  const currentSpotCount = spotId ? getSpotSelectedCount(spotId) : 0;
  const currentTotalCount = getTotalSelectedCount();

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-skyblue border-solid mx-auto mb-4"></div>
          <p className="text-gray-600">포즈 정보를 불러오는 중...</p>
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
          <span className="font-medium text-gray-700">포즈 선택</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-4xl font-bold text-gray-800 mb-2">
            {spot?.spot_name || `Spot ${spotId}`} - 포즈 선택
          </h2>
          <p className="text-gray-600">
            원하는 포즈를 선택해보세요 ✨
          </p>
        </div>

        {/* Persona Filter with Count */}
        <div className="mb-6">
          <div className="flex items-center gap-3 overflow-x-auto pb-2">
            <span className="text-gray-700 font-medium whitespace-nowrap">
              페르소나:
            </span>
            {personas.map((persona) => {
              const count = getPersonaCount(persona);
              return (
                <button
                  key={persona}
                  onClick={() => setSelectedPersona(persona)}
                  className={`px-6 py-2 rounded-3xl font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
                    selectedPersona === persona
                      ? "bg-skyblue text-white shadow-lg scale-105"
                      : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
                  }`}
                >
                  {persona}
                  <span className={`text-xs ${
                    selectedPersona === persona ? "text-white" : "text-gray-500"
                  }`}>
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Pose Gallery */}
        {loadingPoses ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-skyblue border-solid mx-auto mb-4"></div>
            <p className="text-gray-600">포즈를 불러오는 중...</p>
          </div>
        ) : poses.length === 0 ? (
          <p className="text-gray-500 text-center py-12">
            선택한 조건에 맞는 포즈가 없습니다.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {poses.map((pose) => {
              const isSelected = spotId ? isPoseSelected(spotId, pose._id) : false;

              return (
                <motion.div
                  key={pose._id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.3 }}
                  onClick={() => togglePoseSelection(pose._id)}
                  className={`relative aspect-square rounded-3xl overflow-hidden cursor-pointer shadow-lg ${
                    isSelected ? "ring-4 ring-skyblue" : ""
                  }`}
                >
                  {pose.image && (
                    <Image
                      src={normalizeImageUrl(pose.image) || ""}
                      alt={`Pose ${pose._id}`}
                      fill
                      className="object-cover"
                    />
                  )}
                  {isSelected && (
                    <div className="absolute inset-0 bg-skyblue bg-opacity-30 flex items-center justify-center">
                      <div className="bg-skyblue text-white rounded-full w-12 h-12 flex items-center justify-center text-2xl">
                        ✓
                      </div>
                    </div>
                  )}
                  {pose.persona && (
                    <div className="absolute top-2 right-2 bg-white bg-opacity-90 text-skyblue px-3 py-1 rounded-full text-sm font-medium">
                      {pose.persona}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Progress Bar (Fixed) */}
      {tour && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl z-50">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="text-center mb-2">
              <p className="text-sm text-gray-600">
                이 스팟: <span className="font-bold text-skyblue">{currentSpotCount}개</span> 선택
                {spot?.min_count_limit && spot.min_count_limit > 0 && (
                  <span className="text-gray-500"> (최소 {spot.min_count_limit}개)</span>
                )}
              </p>
              <p className="text-lg font-bold text-gray-800">
                전체 선택: {currentTotalCount} / {tour.max_total}
                {tour.min_total && tour.min_total > 0 && (
                  <span className="text-sm text-gray-500"> (최소 {tour.min_total}개 필요)</span>
                )}
              </p>
            </div>
            <button
              onClick={handleBack}
              className="w-full py-4 rounded-3xl font-bold text-lg bg-skyblue text-white hover:bg-opacity-90 shadow-lg transition-all"
            >
              스팟 선택으로 돌아가기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PosesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-skyblue border-solid"></div>
      </div>
    }>
      <PosesContent />
    </Suspense>
  );
}
