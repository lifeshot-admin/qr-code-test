"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useState, useEffect, Suspense, useCallback } from "react";
import Image from "next/image";
import { Check } from "lucide-react";
import { useReservationStore, type Tour, type Spot } from "@/lib/reservation-store";
import { useHasMounted } from "@/lib/use-has-mounted";
import PoseLightbox from "@/app/cheiz/components/PoseLightbox";
import { useModal } from "@/components/GlobalModal";

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
  const hasMounted = useHasMounted();
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showAlert } = useModal();
  
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
      router.replace("/auth/signin?callbackUrl=" + encodeURIComponent(window.location.pathname + window.location.search));
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

    // ✅ [STALE 가드] URL의 tour_id와 Store의 tourId가 다르면 경고
    if (tourId !== null && tourId !== parsedTourId) {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🚨 [POSES STALE 가드] URL tour_id와 Store tourId 불일치!");
      console.log(`  📥 URL tour_id: ${parsedTourId}`);
      console.log(`  📦 Store tourId (stale): ${tourId}`);
      console.log("  ✅ URL 값으로 강제 덮어씀");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }
    
    setTourId(parsedTourId); // ✅ Zustand (URL 값으로 강제 설정)
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
      removePose(spotId, poseId);
    } else {
      const success = addPose(spotId, poseId);
      if (!success) {
        showAlert(`최대 ${tour.max_total}개까지만 선택 가능합니다.`);
      }
    }
  };

  // Lightbox 상태
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

  const checkPoseSelected = useCallback((poseId: string) => {
    return spotId ? isPoseSelected(spotId, poseId) : false;
  }, [spotId, isPoseSelected]);

  // 뒤로가기
  // ✅ URL 파라미터 우선 사용 (stale store 값 방지)
  const handleBack = () => {
    const safeTourId = tourIdParam ? parseInt(tourIdParam, 10) : tourId;
    if (safeTourId) {
      const url = `/cheiz/reserve/spots?tour_id=${safeTourId}${folderId ? `&folder_id=${folderId}` : ''}`;
      
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🔙 [BACK] Returning to spots:");
      console.log(`  🎫 tour_id (URL우선): ${safeTourId}`);
      console.log(`  📁 folder_id: ${folderId || "(신규 예약 - 없음)"}`);
      console.log(`  📡 최종 URL: ${url}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      
      router.push(url);
    } else {
      router.back();
    }
  };

  // 현재 스팟의 선택 개수 (hydration-safe)
  const currentSpotCount = hasMounted && spotId ? getSpotSelectedCount(spotId) : 0;
  const currentTotalCount = hasMounted ? getTotalSelectedCount() : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-cheiz-primary border-solid mx-auto mb-4"></div>
          <p className="text-gray-600">포즈 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF9F5] pb-44">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-orange-100/50">
        <div className="max-w-md mx-auto px-5 py-3 flex items-center justify-between">
          <button
            onClick={handleBack}
            className="text-gray-500 hover:text-cheiz-primary transition-colors text-sm flex items-center gap-1"
          >
            <span className="text-lg">&#8249;</span> 스팟 선택
          </button>
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-1.5 rounded-full bg-cheiz-primary/30" />
            <div className="w-8 h-1.5 rounded-full bg-cheiz-primary" />
            <div className="w-8 h-1.5 rounded-full bg-gray-200" />
          </div>
          <span className="text-sm font-bold text-cheiz-primary">
            {currentSpotCount}개
          </span>
        </div>
      </div>

      {/* Spot Title */}
      <div className="max-w-md mx-auto px-5 pt-6 pb-2">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-sm font-medium text-[#FF4B2B] tracking-wider uppercase mb-1">
            Step 2 of 3
          </p>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">
            {spot?.spot_name || `Spot ${spotId}`}
          </h2>
          <p className="text-sm text-gray-500">
            사진을 터치하면 크게 볼 수 있어요. 우측 상단 체크로 선택!
          </p>
        </motion.div>
      </div>

      {/* Persona Filter */}
      <div className="max-w-md mx-auto px-5 py-3">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {personas.map((persona) => {
            const count = getPersonaCount(persona);
            return (
              <button
                key={persona}
                onClick={() => setSelectedPersona(persona)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1 ${
                  selectedPersona === persona
                    ? "bg-cheiz-primary text-white shadow-sm"
                    : "bg-white text-gray-600 border border-gray-200"
                }`}
              >
                {persona}
                <span className={`text-xs ${
                  selectedPersona === persona ? "text-white/70" : "text-gray-400"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pose Gallery - 2 Column, click zones */}
      <div className="max-w-md mx-auto px-5 py-2">
        {loadingPoses ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-cheiz-primary border-solid mx-auto mb-4" />
            <p className="text-gray-400 text-sm">포즈를 불러오는 중...</p>
          </div>
        ) : poses.length === 0 ? (
          <p className="text-gray-400 text-center py-16 text-sm">
            선택한 조건에 맞는 포즈가 없습니다.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {poses.map((pose, index) => {
              const isSelected = spotId ? isPoseSelected(spotId, pose._id) : false;

              return (
                <motion.div
                  key={pose._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.04 }}
                  className="relative"
                >
                  {/* Card: tap anywhere to open lightbox */}
                  <div
                    onClick={() => openLightbox(index)}
                    className={`relative aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer shadow-sm transition-all ${
                      isSelected ? "ring-[3px] ring-cheiz-primary ring-offset-2" : "border border-gray-100"
                    }`}
                  >
                    {pose.image ? (
                      <Image
                        src={normalizeImageUrl(pose.image) || ""}
                        alt={`Pose ${pose._id}`}
                        fill
                        className="object-cover"
                        quality={60}
                        sizes="(max-width: 768px) 45vw, 200px"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gray-100 flex items-center justify-center text-gray-300 text-xs">
                        이미지 없음
                      </div>
                    )}

                    {/* Selected overlay */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-cheiz-primary/15" />
                    )}

                    {/* Persona tag (bottom-left) */}
                    {pose.persona && (
                      <div className="absolute bottom-2 left-2 bg-black/40 backdrop-blur-sm text-white px-2 py-0.5 rounded-full text-[10px] font-medium">
                        {pose.persona}
                      </div>
                    )}
                  </div>

                  {/* Select Button (top-right) - separate click zone */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePoseSelection(pose._id);
                    }}
                    className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all z-10 shadow-md ${
                      isSelected
                        ? "bg-cheiz-primary text-white scale-110"
                        : "bg-white/90 text-gray-400 hover:text-cheiz-primary hover:bg-white"
                    }`}
                  >
                    <Check className="w-4 h-4" strokeWidth={isSelected ? 3 : 2} />
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox */}
      <PoseLightbox
        poses={poses}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        isPoseSelected={checkPoseSelected}
        onToggleSelect={togglePoseSelection}
      />

      {/* Fixed Bottom Bar - Skip (Ghost) + Select (Main) */}
      {tour && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 z-50">
          <div className="max-w-md mx-auto px-5 py-3">
            {/* Counter */}
            <div className="flex items-center justify-between text-sm mb-3">
              <span className="text-gray-500">
                이 스팟 <span className="font-bold text-cheiz-primary">{currentSpotCount}개</span>
                {spot?.min_count_limit && spot.min_count_limit > 0 && (
                  <span className="text-gray-400"> / 최소 {spot.min_count_limit}개</span>
                )}
              </span>
              <span className="font-bold text-gray-700">
                전체 {currentTotalCount}/{tour.max_total}
              </span>
            </div>
            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleBack}
                className="flex-1 py-3.5 rounded-2xl font-medium text-sm border border-gray-300 text-gray-500 bg-transparent hover:bg-gray-50 transition-colors"
              >
                건너뛰기
              </button>
              <button
                onClick={handleBack}
                className="flex-[2] py-3.5 rounded-2xl font-bold text-sm bg-cheiz-primary text-white shadow-lg shadow-cheiz-primary/25 active:scale-[0.98] transition-all"
              >
                포즈 예약하기 ({currentSpotCount})
              </button>
            </div>
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
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-cheiz-primary border-solid"></div>
      </div>
    }>
      <PosesContent />
    </Suspense>
  );
}
