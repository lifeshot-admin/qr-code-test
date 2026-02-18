import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * 치이즈 포즈 예약 상태 관리 Store (Zustand)
 * 
 * 기능:
 * 1. 스팟별 포즈 선택 상태 관리
 * 2. localStorage를 통한 영구 저장
 * 3. 페이지 간 이동 시에도 선택 상태 유지
 */

export type SpotSelection = {
  spotId: number;
  spotName: string;
  minCountLimit: number;
  selectedPoses: string[]; // Array for serialization
};

export type Tour = {
  _id: string;
  tour_Id?: number;
  tour_name?: string;
  tour_date?: string;
  tour_time?: string;       // 촬영 시간 (HH:MM)
  tour_location?: string;   // 장소 (교토/아라시야마 등)
  tour_thumbnail?: string;  // 썸네일 이미지 URL
  max_total?: number;
  min_total?: number;
};

export type Spot = {
  _id: string;
  spot_Id?: number;
  spot_name?: string;
  Tour_ID?: number;
  thumbnail?: string;
  min_count_limit?: number;
};

export type GuestCount = {
  adults: number;
  children: number;
};

export type PersonaCategory = "solo" | "couple" | "friends" | "family";

export const PERSONA_OPTIONS: { value: PersonaCategory; label: string; emoji: string }[] = [
  { value: "solo", label: "솔로", emoji: "🧍" },
  { value: "couple", label: "커플", emoji: "💑" },
  { value: "friends", label: "친구", emoji: "👫" },
  { value: "family", label: "가족", emoji: "👨‍👩‍👧" },
];

// ✅ 크레딧(GIFT/WALLET) 관련 타입
export type CreditBalance = {
  photoCredits: number;    // 사진 다운로드권 크레딧
  aiCredits: number;       // AI 보정 크레딧
  retouchCredits: number;  // 리터치(보정) 크레딧
};

export type AppliedCredits = {
  photoCredits: number;    // 적용할 사진 크레딧 수 (예약 시점에는 미사용, 보유만 표시)
  aiCredits: number;       // 적용할 AI 크레딧 수 (0 or 1)
  retouchCredits: number;  // 적용할 리터치 크레딧 수
};

export type ReservationState = {
  // Current tour context
  tourId: number | null;
  tour: Tour | null;
  spots: Spot[];
  
  // ✅ Folder ID from Java backend (출입증 번호)
  folderId: number | null;
  
  // ✅ 자바 백엔드 scheduleId (Swagger 규격 필수값)
  scheduleId: number | null;
  
  // ✅ 인원 선택
  guestCount: GuestCount;
  
  // ✅ 페르소나 (촬영 카테고리)
  persona: PersonaCategory;
  
  // ✅ AI 보정 선택
  aiRetouching: boolean;
  
  // ✅ 크레딧(GIFT/WALLET) 상태
  creditBalance: CreditBalance;     // 보유 크레딧 잔액
  appliedCredits: AppliedCredits;   // 적용할 크레딧 수

  // ✅ [수정 모드] 기존 예약 정보
  editMode: boolean;
  existingReservationId: string | null;
  pendingPoseIds: string[]; // 수정 시 기존 선택된 spot_pose_Id들 (spots 페이지 복원용)
  
  // Spot selections (key: spotId)
  spotSelections: Record<number, SpotSelection>;
  
  // Actions
  setTourId: (tourId: number | null) => void;
  setTour: (tour: Tour | null) => void;
  setSpots: (spots: Spot[]) => void;
  setFolderId: (folderId: number | null) => void;
  setScheduleId: (scheduleId: number | null) => void;
  setGuestCount: (count: GuestCount) => void;
  setPersona: (persona: PersonaCategory) => void;
  setAiRetouching: (value: boolean) => void;
  
  // ✅ 크레딧 액션
  setCreditBalance: (balance: CreditBalance) => void;
  setAppliedCredits: (applied: AppliedCredits) => void;
  
  // ✅ [수정 모드] 액션
  setEditMode: (mode: boolean, reservationId?: string | null, poseIds?: string[]) => void;
  consumePendingPoseIds: () => string[];
  
  // Spot selection management
  initializeSpotSelection: (spotId: number, spotName: string, minCountLimit: number) => void;
  addPose: (spotId: number, poseId: string) => boolean;
  removePose: (spotId: number, poseId: string) => void;
  isPoseSelected: (spotId: number, poseId: string) => boolean;
  getSpotSelection: (spotId: number) => SpotSelection | undefined;
  
  // Total counts
  getTotalSelectedCount: () => number;
  getSpotSelectedCount: (spotId: number) => number;
  
  // Reset
  clearSelections: () => void;
  clearAll: () => void;
};

export const useReservationStore = create<ReservationState>()(
  persist(
    (set, get) => ({
      // Initial state
      tourId: null,
      tour: null,
      spots: [],
      folderId: null, // ✅ 자바 백엔드 folderId (출입증)
      scheduleId: null, // ✅ 자바 백엔드 scheduleId (Swagger 필수값)
      guestCount: { adults: 1, children: 0 },
      persona: "solo" as PersonaCategory,
      aiRetouching: false,
      creditBalance: { photoCredits: 0, aiCredits: 0, retouchCredits: 0 },
      appliedCredits: { photoCredits: 0, aiCredits: 0, retouchCredits: 0 },
      editMode: false,
      existingReservationId: null,
      pendingPoseIds: [],
      spotSelections: {},

      // Set tour ID
      setTourId: (tourId) => {
        set({ tourId });
      },

      // Set tour data
      setTour: (tour) => {
        set({ tour });
      },

      // Set spots
      setSpots: (spots) => {
        set({ spots });
        
        // Initialize selections for new spots
        const currentSelections = get().spotSelections;
        const newSelections = { ...currentSelections };
        
        spots.forEach((spot) => {
          if (spot.spot_Id && !newSelections[spot.spot_Id]) {
            newSelections[spot.spot_Id] = {
              spotId: spot.spot_Id,
              spotName: spot.spot_name || `Spot ${spot.spot_Id}`,
              minCountLimit: spot.min_count_limit || 0,
              selectedPoses: [],
            };
          }
        });
        
        set({ spotSelections: newSelections });
      },

      // Set folder ID (from Java backend)
      setFolderId: (folderId) => {
        set({ folderId });
        console.log("📁 [Store] Folder ID set:", folderId);
      },

      // Set schedule ID (Java backend Swagger 필수값)
      setScheduleId: (scheduleId) => {
        set({ scheduleId });
        console.log("📅 [Store] Schedule ID set:", scheduleId);
      },

      // Set guest count
      setGuestCount: (count) => {
        set({ guestCount: count });
      },

      // Set persona category
      setPersona: (persona) => {
        set({ persona });
      },

      // Set AI retouching
      setAiRetouching: (value) => {
        set({ aiRetouching: value });
      },

      // ✅ 크레딧 잔액 설정 (API에서 가져온 데이터)
      setCreditBalance: (balance) => {
        set({ creditBalance: balance });
        console.log("💰 [Store] Credit balance set:", balance);
      },

      // ✅ 적용 크레딧 설정 (사용자가 조절)
      setAppliedCredits: (applied) => {
        const balance = get().creditBalance;
        // 검증: 보유량 초과 방지
        const safeApplied = {
          photoCredits: Math.min(Math.max(0, applied.photoCredits), balance.photoCredits),
          aiCredits: Math.min(Math.max(0, applied.aiCredits), balance.aiCredits),
          retouchCredits: Math.min(Math.max(0, applied.retouchCredits), balance.retouchCredits),
        };
        set({ appliedCredits: safeApplied });
        console.log("🎫 [Store] Applied credits set:", safeApplied);
      },

      // ✅ [수정 모드] 기존 예약 수정 진입
      setEditMode: (mode, reservationId = null, poseIds = []) => {
        set({
          editMode: mode,
          existingReservationId: reservationId,
          pendingPoseIds: poseIds,
        });
        console.log(`✏️ [Store] Edit mode: ${mode}, reservation: ${reservationId}, poses: ${poseIds.length}개`);
      },

      // ✅ [수정 모드] pendingPoseIds를 꺼내고 비움 (spots 페이지에서 1회만 사용)
      consumePendingPoseIds: () => {
        const ids = get().pendingPoseIds;
        set({ pendingPoseIds: [] });
        return ids;
      },

      // Initialize spot selection if not exists
      initializeSpotSelection: (spotId, spotName, minCountLimit) => {
        const currentSelections = get().spotSelections;
        
        if (!currentSelections[spotId]) {
          set({
            spotSelections: {
              ...currentSelections,
              [spotId]: {
                spotId,
                spotName,
                minCountLimit,
                selectedPoses: [],
              },
            },
          });
        }
      },

      // Add pose to spot
      addPose: (spotId, poseId) => {
        const state = get();
        const currentSelection = state.spotSelections[spotId];
        
        if (!currentSelection) {
          console.error(`Spot ${spotId} not initialized`);
          return false;
        }

        // Check if already selected
        if (currentSelection.selectedPoses.includes(poseId)) {
          return true;
        }

        // Check max total limit
        const totalCount = state.getTotalSelectedCount();
        const maxTotal = state.tour?.max_total || 99;
        
        if (totalCount >= maxTotal) {
          console.warn(`Max total ${maxTotal} reached`);
          return false;
        }

        // Add pose
        set({
          spotSelections: {
            ...state.spotSelections,
            [spotId]: {
              ...currentSelection,
              selectedPoses: [...currentSelection.selectedPoses, poseId],
            },
          },
        });

        console.log(`✅ [Store] Added pose ${poseId} to spot ${spotId}`);
        return true;
      },

      // Remove pose from spot
      removePose: (spotId, poseId) => {
        const state = get();
        const currentSelection = state.spotSelections[spotId];
        
        if (!currentSelection) {
          console.error(`Spot ${spotId} not initialized`);
          return;
        }

        set({
          spotSelections: {
            ...state.spotSelections,
            [spotId]: {
              ...currentSelection,
              selectedPoses: currentSelection.selectedPoses.filter((id) => id !== poseId),
            },
          },
        });

        console.log(`❌ [Store] Removed pose ${poseId} from spot ${spotId}`);
      },

      // Check if pose is selected
      isPoseSelected: (spotId, poseId) => {
        const selection = get().spotSelections[spotId];
        return selection ? selection.selectedPoses.includes(poseId) : false;
      },

      // Get spot selection
      getSpotSelection: (spotId) => {
        return get().spotSelections[spotId];
      },

      // Get total selected count across all spots
      getTotalSelectedCount: () => {
        const selections = get().spotSelections;
        return Object.values(selections).reduce(
          (sum, spot) => sum + spot.selectedPoses.length,
          0
        );
      },

      // Get selected count for specific spot
      getSpotSelectedCount: (spotId) => {
        const selection = get().spotSelections[spotId];
        return selection ? selection.selectedPoses.length : 0;
      },

      // Clear all selections but keep tour/spot data
      clearSelections: () => {
        const state = get();
        const clearedSelections: Record<number, SpotSelection> = {};
        
        Object.values(state.spotSelections).forEach((selection) => {
          clearedSelections[selection.spotId] = {
            ...selection,
            selectedPoses: [],
          };
        });
        
        set({ spotSelections: clearedSelections });
        console.log("🗑️ [Store] All selections cleared");
      },

      // Clear everything
      clearAll: () => {
        set({
          tourId: null,
          tour: null,
          spots: [],
          folderId: null,
          scheduleId: null,
          guestCount: { adults: 1, children: 0 },
          persona: "solo" as PersonaCategory,
          aiRetouching: false,
          creditBalance: { photoCredits: 0, aiCredits: 0, retouchCredits: 0 },
          appliedCredits: { photoCredits: 0, aiCredits: 0, retouchCredits: 0 },
          editMode: false,
          existingReservationId: null,
          pendingPoseIds: [],
          spotSelections: {},
        });
        console.log("🗑️ [Store] All data cleared");
      },
    }),
    {
      name: 'cheiz-reservation-storage', // localStorage key
      storage: createJSONStorage(() => localStorage),
      // ✅ persist 대상: 선택 상태만 저장, tourId는 제외!
      // tourId는 항상 URL ?tour_id= 파라미터에서 가져와야 함
      // (localStorage에 이전 세션의 stale 값이 남아 28 등 오래된 값이 유입되는 문제 방지)
      partialize: (state) => ({
        // tourId: 제거! → URL에서만 가져옴
        tour: state.tour, // ✅ Persist tour metadata (이름, 썸네일, 장소, 일정 등)
        folderId: state.folderId, // ✅ Persist folder ID
        scheduleId: state.scheduleId, // ✅ Persist schedule ID (Swagger 필수값)
        guestCount: state.guestCount,
        persona: state.persona,
        aiRetouching: state.aiRetouching,
        creditBalance: state.creditBalance,
        appliedCredits: state.appliedCredits,
        editMode: state.editMode,
        existingReservationId: state.existingReservationId,
        pendingPoseIds: state.pendingPoseIds,
        spotSelections: state.spotSelections,
      }),
    }
  )
);

/**
 * Validation helpers (uses validation-engine internally)
 */
export const validateReservation = (
  spotSelections: Record<number, SpotSelection>,
  minTotal: number,
  maxTotal: number
): {
  isValid: boolean;
  canProceedToReview: boolean;
  spotValidations: {
    spotId: number;
    spotName: string;
    count: number;
    minRequired: number;
    status: "empty" | "incomplete" | "complete";
    message: string | null;
  }[];
  globalMessage: string | null;
} => {
  const totalCount = Object.values(spotSelections).reduce(
    (sum, spot) => sum + spot.selectedPoses.length,
    0
  );

  // Validate each spot
  const spotValidations = Object.values(spotSelections).map((spot) => {
    const count = spot.selectedPoses.length;
    const minRequired = spot.minCountLimit || 0;

    let status: "empty" | "incomplete" | "complete";
    let message: string | null = null;

    if (count === 0) {
      status = "empty";
    } else if (count < minRequired) {
      status = "incomplete";
      message = `최소 ${minRequired}개 필요 (현재 ${count}개)`;
    } else {
      status = "complete";
    }

    return {
      spotId: spot.spotId,
      spotName: spot.spotName,
      count,
      minRequired,
      status,
      message,
    };
  });

  // Check global validation
  const allSpotsValid = spotValidations.every(
    (v) => v.status === "empty" || v.status === "complete"
  );
  const meetsGlobalMin = totalCount >= minTotal;
  const meetsGlobalMax = totalCount <= maxTotal;

  let globalMessage: string | null = null;
  
  if (!allSpotsValid) {
    const incompleteSpots = spotValidations.filter((v) => v.status === "incomplete");
    if (incompleteSpots.length > 0) {
      const firstIncomplete = incompleteSpots[0];
      globalMessage = `${firstIncomplete.spotName}의 포즈를 더 선택해주세요`;
    }
  } else if (!meetsGlobalMin) {
    const needed = minTotal - totalCount;
    globalMessage = `최소 ${minTotal}개 필요 (${needed}개 더 선택)`;
  } else if (!meetsGlobalMax) {
    globalMessage = `최대 ${maxTotal}개까지만 선택 가능`;
  }

  const canProceedToReview = allSpotsValid && meetsGlobalMin && meetsGlobalMax;

  return {
    isValid: allSpotsValid,
    canProceedToReview,
    spotValidations,
    globalMessage,
  };
};
