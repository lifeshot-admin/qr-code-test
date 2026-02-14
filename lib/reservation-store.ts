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

export type ReservationState = {
  // Current tour context
  tourId: number | null;
  tour: Tour | null;
  spots: Spot[];
  
  // ✅ Folder ID from Java backend (출입증 번호)
  folderId: number | null;
  
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
      // Only persist selections, not temporary UI state
      partialize: (state) => ({
        tourId: state.tourId,
        folderId: state.folderId, // ✅ Persist folder ID
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
