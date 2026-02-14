/**
 * 치이즈 포즈 선택 검증 엔진
 * 
 * 3가지 핵심 비즈니스 룰:
 * 1. Global Max: 전체 선택 개수 ≤ max_total
 * 2. Local Min: 각 스팟은 0개 또는 min_count_limit개 이상
 * 3. Global Min: 전체 선택 개수 ≥ min_total
 */

export type SpotSelection = {
  spotId: number;
  spotName: string;
  minCountLimit: number;
  selectedPoses: Set<string>;
};

export type ValidationResult = {
  isValid: boolean;
  canAddMore: boolean;
  globalProgress: {
    current: number;
    min: number;
    max: number;
    percentage: number;
  };
  spotValidations: {
    spotId: number;
    spotName: string;
    count: number;
    minRequired: number;
    status: "empty" | "incomplete" | "complete";
    message: string | null;
  }[];
  finalButtonEnabled: boolean;
  finalButtonMessage: string | null;
};

/**
 * 전체 검증 엔진
 */
export function validatePoseSelection(
  spotSelections: Map<number, SpotSelection>,
  minTotal: number,
  maxTotal: number
): ValidationResult {
  console.log("\n🚨 [VALIDATION ENGINE] Starting validation...");
  
  // 전체 선택 개수 계산
  let totalSelected = 0;
  spotSelections.forEach((spot) => {
    totalSelected += spot.selectedPoses.size;
  });

  console.log(`📊 [GLOBAL] Total: ${totalSelected}/${maxTotal} (Min: ${minTotal})`);

  // 각 스팟별 검증
  const spotValidations = Array.from(spotSelections.values()).map((spot) => {
    const count = spot.selectedPoses.size;
    const minRequired = spot.minCountLimit || 0;

    let status: "empty" | "incomplete" | "complete";
    let message: string | null = null;

    if (count === 0) {
      status = "empty";
      message = null; // 건너뛰기 허용
    } else if (count < minRequired) {
      status = "incomplete";
      message = `최소 ${minRequired}개 필요 (현재 ${count}개)`;
    } else {
      status = "complete";
      message = null;
    }

    console.log(
      `🔍 [SPOT ${spot.spotId}] ${spot.spotName}: ${count}/${minRequired} - ${status.toUpperCase()}`
    );

    return {
      spotId: spot.spotId,
      spotName: spot.spotName,
      count,
      minRequired,
      status,
      message,
    };
  });

  // 전체 최대 선택 체크
  const canAddMore = totalSelected < maxTotal;
  if (!canAddMore) {
    console.log("🚫 [GLOBAL MAX] 최대 선택 개수 도달!");
  }

  // 모든 스팟이 유효한지 체크 (0개 또는 min 이상)
  const allSpotsValid = spotValidations.every(
    (v) => v.status === "empty" || v.status === "complete"
  );

  // 전체 최소 선택 체크
  const meetsGlobalMin = totalSelected >= minTotal;

  // 최종 버튼 활성화 조건
  const finalButtonEnabled = allSpotsValid && meetsGlobalMin;

  // 최종 버튼 메시지
  let finalButtonMessage: string | null = null;

  if (!allSpotsValid) {
    const incompleteSpots = spotValidations.filter((v) => v.status === "incomplete");
    if (incompleteSpots.length > 0) {
      const firstIncomplete = incompleteSpots[0];
      const needed = firstIncomplete.minRequired - firstIncomplete.count;
      finalButtonMessage = `${firstIncomplete.spotName} 스팟의 포즈를 ${needed}개 더 선택해주세요`;
    }
  } else if (!meetsGlobalMin) {
    const needed = minTotal - totalSelected;
    finalButtonMessage = `전체 최소 개수까지 ${needed}개 남았습니다`;
  }

  console.log(`✅ [VALIDATION] Final Button: ${finalButtonEnabled ? "ENABLED" : "DISABLED"}`);
  if (finalButtonMessage) {
    console.log(`💬 [MESSAGE] ${finalButtonMessage}`);
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  return {
    isValid: allSpotsValid,
    canAddMore,
    globalProgress: {
      current: totalSelected,
      min: minTotal,
      max: maxTotal,
      percentage: (totalSelected / maxTotal) * 100,
    },
    spotValidations,
    finalButtonEnabled,
    finalButtonMessage,
  };
}

/**
 * 포즈 추가 가능 여부 체크
 */
export function canAddPose(
  currentTotal: number,
  maxTotal: number,
  spotId: number,
  spotSelections: Map<number, SpotSelection>
): boolean {
  if (currentTotal >= maxTotal) {
    console.log(`🚫 [ADD BLOCKED] Global max reached: ${currentTotal}/${maxTotal}`);
    return false;
  }

  console.log(`✅ [ADD ALLOWED] Spot ${spotId}: ${currentTotal + 1}/${maxTotal}`);
  return true;
}

/**
 * 포즈 제거 가능 여부 체크 (항상 가능)
 */
export function canRemovePose(
  spotId: number,
  poseId: string,
  spotSelections: Map<number, SpotSelection>
): boolean {
  console.log(`✅ [REMOVE ALLOWED] Spot ${spotId}, Pose ${poseId}`);
  return true;
}
