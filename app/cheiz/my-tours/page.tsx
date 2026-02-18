"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { getUserTours, type Tour } from "@/lib/api-client";
import { useReservationStore, type GuestCount } from "@/lib/reservation-store";
import GuestSheet from "@/app/cheiz/components/GuestSheet";
import QRCode from "qrcode";
import { formatKSTTime, formatKSTDate, toKST } from "@/lib/utils";
import toast from "react-hot-toast";
import { useModal } from "@/components/GlobalModal";

// ==================== LOGGING HELPER ====================

function logUserAction(buttonName: string, data?: Record<string, unknown>) {
  const now = new Date();
  const time = now.toLocaleTimeString("ko-KR", { hour12: false });
  console.log(`[USER_ACTION] Button: ${buttonName}, Time: ${time}, Data:`, data || {});
}

function MyToursContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showAlert, showConfirm, showError, showSuccess } = useModal();
  
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ━━━ 탭 필터 ━━━
  const [activeTab, setActiveTab] = useState<"active" | "canceled">("active");

  // ✅ 인원 선택 바텀 시트
  const [guestSheetOpen, setGuestSheetOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<{
    realTourId: number;
    folderId: number;
    tourName?: string;
    thumbnail?: string;
    startTime?: string;
  } | null>(null);
  const { setGuestCount, setTourId: setStoreTourId, setFolderId: setStoreFolderId, setTour: setStoreTour } = useReservationStore();

  // ✅ [마이페이지 통합] 포즈 예약 상태 관리
  type PoseReservationInfo = {
    has_reservation: boolean;
    reservation: {
      id: string;
      folder_Id: number;
      tour_Id: number;
      user_Id: number;
      status: string;
      qrcode_url: string | null;
      created_date: string;
    } | null;
    pose_count: number;
    reserved_poses?: { id: string; spot_pose_Id: string }[]; // ✅ 수정 기능용
  };
  const [poseReservations, setPoseReservations] = useState<Record<number, PoseReservationInfo>>({});
  const [loadingPoseInfo, setLoadingPoseInfo] = useState<Record<number, boolean>>({});
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // ✅ [QR코드 모달] 상태 관리
  const [qrModalData, setQrModalData] = useState<{
    visible: boolean;
    qrCodeUrl: string;
    reservationId: string;
    tourName: string;
  }>({ visible: false, qrCodeUrl: "", reservationId: "", tourName: "" });

  // ━━━ AI 보정 진행률 상태 ━━━
  type AiProgressInfo = {
    totalCount: number;
    completedCount: number;
    processingCount: number;
    pendingCount: number;
    isComplete: boolean;
    percentage: number;
  };
  const [aiProgress, setAiProgress] = useState<Record<number, AiProgressInfo>>({});
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // ━━━ AI 폴더 여부 판별 (이름이 [AI]로 시작하는 폴더) ━━━
  const isAiFolder = useCallback((tour: Tour): boolean => {
    return tour.name?.startsWith("[AI]") ?? false;
  }, []);

  // ━━━ AI 폴더의 보정 진행률 조회 ━━━
  const fetchAiProgress = useCallback(async (folderId: number) => {
    try {
      const res = await fetch(`/api/backend/ai-status?folderId=${folderId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setAiProgress(prev => ({
            ...prev,
            [folderId]: {
              totalCount: data.totalCount,
              completedCount: data.completedCount,
              processingCount: data.processingCount,
              pendingCount: data.pendingCount,
              isComplete: data.isComplete,
              percentage: data.percentage,
            },
          }));
          return data.isComplete;
        }
      }
    } catch (e) {
      console.error(`[AI_POLL] folderId=${folderId} 상태 조회 실패:`, e);
    }
    return false;
  }, []);

  // ━━━ AI 폴더 폴링 (진행 중인 AI 폴더가 있으면 10초마다 상태 갱신) ━━━
  useEffect(() => {
    const aiTours = tours.filter(t => isAiFolder(t) && (t.status === "COMPLETED" || t.status === "UPLOAD_COMPLETED"));

    if (aiTours.length === 0) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    // 초기 1회 조회
    aiTours.forEach(t => fetchAiProgress(t.id));

    // 폴링 시작: 10초 간격
    pollingRef.current = setInterval(async () => {
      const incompleteAiTours = aiTours.filter(t => {
        const p = aiProgress[t.id];
        return !p || !p.isComplete;
      });

      if (incompleteAiTours.length === 0) {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        return;
      }

      for (const t of incompleteAiTours) {
        const complete = await fetchAiProgress(t.id);
        if (complete) {
          toast.success(`"${t.name}" AI 보정이 완료되었습니다!`);
        }
      }
    }, 10000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [tours, isAiFolder, fetchAiProgress]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check for access denied error
  useEffect(() => {
    const errorType = searchParams.get("error");
    const message = searchParams.get("message");
    
    if (errorType === "access_denied" && message) {
      // Show toast notification
      showError(message || "접근이 거부되었습니다.");
      
      // Clean URL
      router.replace("/cheiz/my-tours");
    }
  }, [searchParams, router]);

  // Fetch user tours
  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.replace("/auth/signin?callbackUrl=/cheiz/my-tours");
      return;
    }

    fetchTours();
  }, [status, session, router]);

  const fetchTours = async () => {
    if (!session?.user?.id) {
      console.error("❌ [My Tours] No user ID in session!");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log("📋📋📋 [My Tours] Fetching tours for REAL user ID:", session.user.id);
      console.log("🔑 [My Tours] Full session data:", {
        id: session.user.id,
        idType: typeof session.user.id,
        email: session.user.email,
        name: session.user.name,
        nickname: (session.user as any).nickname || "⚠️ NULL",
        hasAccessToken: !!(session as any).accessToken,
        accessTokenPreview: (session as any).accessToken ? 
          `${String((session as any).accessToken).substring(0, 30)}...` : 
          "❌ MISSING",
        tokenType: (session as any).accessToken?.startsWith('eyJ')
          ? '✅ JWT Token' 
          : (session as any).accessToken?.startsWith('ya29') 
          ? '⚠️ OAuth Token' 
          : (session as any).accessToken?.startsWith('temp_')
          ? '⚠️ Temp Token'
          : '❌ Unknown',
      });

      console.log("🔍 [My Tours] Calling getUserTours with ID:", session.user.id);

      // ✅ 모든 상태 조회 (RESERVED, CANCELED, COMPLETED 등)
      // statusSet을 제거하여 pending/CANCELED 포함 전체 예약 내역을 가져옴
      const response = await getUserTours(session.user.id);
      
      console.log("✅✅✅ [My Tours] API Response received:", response);
      console.log("📦 [My Tours] Response status:", response.statusCode);
      console.log("📦 [My Tours] Response message:", response.message);
      
      // ✅ [수정] 유연한 데이터 추출 - 여러 경로 시도
      let toursData: any[] = [];
      
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🔍 [My Tours] 데이터 추출 시도:");
      
      // 방법 1: response.data.content
      if (response.data?.content && Array.isArray(response.data.content)) {
        toursData = response.data.content;
        console.log("  ✅ [Method 1] response.data.content:", toursData.length, "개");
      }
      // 방법 2: response.content (실제 Swagger API)
      else if ((response as any).content && Array.isArray((response as any).content)) {
        toursData = (response as any).content;
        console.log("  ✅ [Method 2] response.content:", toursData.length, "개");
      }
      // 방법 3: response.data 자체가 배열
      else if (Array.isArray(response.data)) {
        toursData = response.data;
        console.log("  ✅ [Method 3] response.data (배열):", toursData.length, "개");
      }
      else {
        console.error("  ❌ 데이터 추출 실패! response 구조 확인 필요");
        toursData = [];
      }
      
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("📦 [My Tours] 추출된 원본 데이터:", toursData.length, "개");

      // ━━━ Ghost Data Filter: folder_Id가 null/undefined인 유령 예약 제거 ━━━
      const validTours = toursData.filter((t: any) => {
        const hasValidId = t.id != null && t.id !== undefined && t.id !== 0;
        const hasValidSchedule = t.scheduleResponse?.startTime != null;
        if (!hasValidId || !hasValidSchedule) {
          console.warn(`[GHOST_FILTER] ⚠️ 유령 예약 제거: id=${t.id}, name=${t.name}, schedule=${!!t.scheduleResponse}`);
          return false;
        }
        return true;
      });

      if (validTours.length !== toursData.length) {
        console.warn(`[GHOST_FILTER] 🗑️ ${toursData.length - validTours.length}개 유령 예약 제거됨 (${toursData.length} → ${validTours.length})`);
      }
      console.log("📦 [My Tours] 최종 필터링 후 데이터:", validTours.length, "개");
      
      setTours(validTours);

      // ✅ [마이페이지 통합] 각 투어의 포즈 예약 상태 조회 (병렬 호출)
      await Promise.allSettled(
        validTours.map(t => fetchPoseReservation(t.id))
      );

      if (toursData.length > 0) {
        console.log("📋 [My Tours] First tour SWAGGER mapping check:");
        const first = toursData[0];
        console.log("  - name:", first.name);
        console.log("  - thumbnailImageUrl:", first.scheduleResponse?.tourDTO?.thumbnailImageUrl);
        console.log("  - startTime:", first.scheduleResponse?.startTime);
        console.log("  - hostUser.nickname:", first.hostUser?.nickname);
        console.log("  - hostUser.profileImageUrl:", first.hostUser?.profileImageUrl);
      } else {
        console.warn("⚠️ [My Tours] 추출된 데이터가 0개입니다.");
        console.warn("⚠️ statusSet=RESERVED 조건으로 데이터가 실제로 없을 수 있습니다.");
      }
    } catch (err: any) {
      console.error("❌ [My Tours] Failed to fetch tours:", err);
      
      // ✅ 401 에러 체크 (인증 실패)
      const errorMessage = err?.message || String(err);
      if (errorMessage.includes("401") || errorMessage.includes("Unauthorized")) {
        console.error("🚨 [My Tours] 401 Unauthorized - Session expired or invalid token");
        setError("SESSION_EXPIRED");
      } else {
        setError("투어 목록을 불러오는데 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ✅ [마이페이지 통합] 포즈 예약 조회
  const fetchPoseReservation = useCallback(async (folderId: number) => {
    setLoadingPoseInfo((prev) => ({ ...prev, [folderId]: true }));
    try {
      const res = await fetch(`/api/bubble/pose-reservation-by-folder?folder_id=${folderId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setPoseReservations((prev) => ({ ...prev, [folderId]: data }));
        }
      }
    } catch (e) {
      console.error(`❌ [Pose Lookup] folder_id=${folderId} 조회 실패:`, e);
    } finally {
      setLoadingPoseInfo((prev) => ({ ...prev, [folderId]: false }));
    }
  }, []);

  // ✅ [마이페이지 통합] 포즈 예약 취소 + Java 백엔드 폴더 CANCELED
  const handleCancelReservation = async (reservationId: string, folderId: number) => {
    const confirmed = await showConfirm("정말로 예약을 취소하시겠습니까?\n선택한 포즈가 모두 삭제되며, 예약 취소 후 새 예약을 해야 합니다.", { title: "예약 취소", confirmText: "취소하기", cancelText: "돌아가기" });
    if (!confirmed) return;

    setCancellingId(reservationId);
    try {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("[CANCEL] 🗑 예약 취소 시작");
      console.log(`  🆔 reservationId: ${reservationId}`);
      console.log(`  📁 folderId: ${folderId}`);

      // Step 1: Java 백엔드 폴더 상태 → CANCELED
      console.log("[CANCEL] Step 1: Java 백엔드 PATCH 호출...");
      try {
        const patchRes = await fetch("/api/backend/cancel-folder", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderId }),
        });
        if (patchRes.ok) {
          console.log("[CANCEL] ✅ Java 백엔드 폴더 CANCELED 처리 완료");
        } else {
          const patchErr = await patchRes.text();
          console.warn(`[CANCEL] ⚠️ Java 백엔드 취소 실패 (${patchRes.status}): ${patchErr.substring(0, 200)}`);
        }
      } catch (patchErr: any) {
        console.warn("[CANCEL] ⚠️ Java 백엔드 PATCH 예외:", patchErr.message);
      }

      // Step 2: Bubble DB에서 pose_reservation + reserved_pose 삭제
      console.log("[CANCEL] Step 2: Bubble DB 삭제...");
      const res = await fetch("/api/bubble/cancel-reservation", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservation_id: reservationId }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          console.log("[CANCEL] ✅ Bubble 예약 삭제 완료");
          await showSuccess("예약이 취소되었습니다.\n새 예약을 하려면 투어 상세에서 다시 예약해주세요.", { title: "취소 완료" });
          // 상태 갱신
          setPoseReservations((prev) => ({
            ...prev,
            [folderId]: { has_reservation: false, reservation: null, pose_count: 0 },
          }));
          // 투어 목록 새로고침
          fetchTours();
        } else {
          await showError("취소에 실패했습니다. 다시 시도해주세요.");
        }
      } else {
        await showError("취소에 실패했습니다. 다시 시도해주세요.");
      }
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    } catch (e) {
      console.error("❌ [Cancel] 취소 실패:", e);
      await showError("취소 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setCancellingId(null);
    }
  };

  // ✅ [QR코드 모달] QR 표시 핸들러
  const handleShowQRCode = async (reservationId: string, tourName: string) => {
    logUserAction("QR코드 표시하기", { reservationId, tourName });
    try {
      const qrData = `${window.location.origin}/photographer/scan?reservation_id=${reservationId}`;
      const qrDataUrl = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: {
          dark: "#0055FF",
          light: "#FFFFFF",
        },
      });
      setQrModalData({
        visible: true,
        qrCodeUrl: qrDataUrl,
        reservationId,
        tourName,
      });
    } catch (err) {
      console.error("QR 코드 생성 실패:", err);
      showError("QR 코드 생성에 실패했습니다.");
    }
  };

  // ✅ Zustand store 접근
  const { setEditMode, setTourId, setFolderId, clearSelections } = useReservationStore();

  // ✅ [마이페이지 통합] 포즈 수정 (기존 포즈 ID를 Zustand에 채운 후 이동)
  const handleEditReservation = async (realTourId: number, fId: number) => {
    // 1) 기존 예약에서 선택된 포즈 ID들을 가져옴
    const poseInfo = poseReservations[fId];
    const reservationId = poseInfo?.reservation?.id;
    const reservedPoseIds = (poseInfo as any)?.reserved_poses?.map((p: any) => p.spot_pose_Id).filter(Boolean) || [];

    console.log("✏️ [EDIT] 수정 모드 진입:", {
      realTourId,
      folderId: fId,
      reservationId,
      existingPoseCount: reservedPoseIds.length,
      poseIds: reservedPoseIds,
    });

    // 2) Zustand 스토어에 수정 모드 정보 세팅
    clearSelections(); // 기존 선택 초기화
    setTourId(realTourId);
    setFolderId(fId);
    setEditMode(true, reservationId || null, reservedPoseIds);

    // 3) spots 페이지로 이동 (mode=edit)
    router.push(`/cheiz/reserve/spots?tour_id=${realTourId}&folder_id=${fId}&mode=edit`);
  };

  // ✅ Status 뱃지 색상 매핑
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return { text: "예약 완료", color: "bg-blue-100 text-blue-700", icon: "📋" };
      case "scanned":
        return { text: "스캔 완료", color: "bg-yellow-100 text-yellow-700", icon: "📷" };
      case "completed":
        return { text: "촬영 완료", color: "bg-green-100 text-green-700", icon: "✅" };
      default:
        return { text: status, color: "bg-gray-100 text-gray-700", icon: "❓" };
    }
  };

  // Calculate D-day (ISO 8601 datetime 기준, KST +9h 보정)
  const calculateDDay = (startTime: string): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const target = toKST(startTime); // ✅ UTC → KST 보정
    target.setHours(0, 0, 0, 0);
    
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  // Format date (ISO 8601 → KST "2026년 2월 11일 (화)")
  const formatDate = (startTime: string): string => {
    return formatKSTDate(startTime);
  };

  // Loading state — 스켈레톤 UI
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
        <div className="bg-white px-5 pt-12 pb-4">
          <div className="h-5 bg-gray-200 rounded w-28 animate-pulse" />
        </div>
        <div className="px-5 pt-4 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm animate-pulse">
              <div className="h-[160px] bg-gray-200" />
              <div className="p-4 space-y-3">
                <div className="flex justify-between">
                  <div className="h-4 bg-gray-200 rounded w-32" />
                  <div className="h-[22px] bg-gray-200 rounded-full w-16" />
                </div>
                <div className="h-3 bg-gray-200 rounded w-40" />
                <div className="h-3 bg-gray-200 rounded w-28" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ✅ Session expired state (401 error)
  if (error === "SESSION_EXPIRED") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-md w-full text-center"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-6xl mb-6"
          >
            🔒
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-3xl font-bold text-gray-800 mb-4"
          >
            세션이 만료되었습니다
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-lg text-gray-600 mb-8"
          >
            다시 로그인해 주세요.
          </motion.p>

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            onClick={() => {
              logUserAction("로그인 하러 가기", {});
              router.push("/auth/signin?callbackUrl=/cheiz/my-tours");
            }}
            className="bg-[#0055FF] text-white font-bold py-4 px-8 rounded-xl hover:bg-opacity-90 transition-all transform hover:scale-105 shadow-sm"
          >
            로그인 하러 가기
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // Empty state
  if (tours.length === 0) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-md w-full text-center"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-6xl mb-6"
          >
            📭
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-3xl font-bold text-gray-800 mb-4"
          >
            예약된 투어가 없습니다
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-lg text-gray-600 mb-8"
          >
            쿠폰을 조회하여 투어를 확인해보세요!
          </motion.p>

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            onClick={() => {
              logUserAction("쿠폰 조회하기", {});
              router.push("/cheiz");
            }}
            className="bg-[#0055FF] text-white font-bold py-4 px-8 rounded-xl hover:bg-opacity-90 transition-all transform hover:scale-105 shadow-sm"
          >
            쿠폰 조회하기
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // Tours list
  return (
    <div className="min-h-screen bg-white">
      {/* Sub Navigation (레이아웃 헤더와 중복 제거) */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-2 flex items-center gap-2 text-sm text-gray-500">
          <button
            onClick={() => router.push("/cheiz")}
            className="hover:text-[#0055FF] transition-colors"
          >
            ← 홈
          </button>
          <span className="text-gray-300">|</span>
          <span className="font-medium text-gray-700">나의 예약</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-8"
        >
          <h2 className="text-4xl font-bold text-gray-800 mb-2">
            나의 예약
          </h2>
          <p className="text-gray-600">
            예약 현황을 확인하고 포즈를 선택해보세요
          </p>
        </motion.div>

        {/* ━━━ 탭 (예약 & 업로드 완료 / 예약 취소) ━━━ */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("active")}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${
              activeTab === "active"
                ? "bg-[#0055FF] text-white shadow-sm"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            예약 / 업로드 완료 ({tours.filter(t => t.status !== "CANCELED" && t.status !== "NOSHOW" && t.status !== "PAYMENT_IN_PROGRESS").length})
          </button>
          <button
            onClick={() => setActiveTab("canceled")}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${
              activeTab === "canceled"
                ? "bg-red-500 text-white shadow-sm"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            예약 취소 ({tours.filter(t => t.status === "CANCELED" || t.status === "NOSHOW").length})
          </button>
        </div>

        {/* Tours Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tours
            .filter(t => activeTab === "active"
              ? t.status !== "CANCELED" && t.status !== "NOSHOW" && t.status !== "PAYMENT_IN_PROGRESS"
              : t.status === "CANCELED" || t.status === "NOSHOW")
            .sort((a, b) => {
              // 2순위: 상태 우선 (진행 중 > 완료 > 기타)
              const ACTIVE_STATUSES = ["RESERVED", "PENDING", "UPLOAD_COMPLETED"];
              const aActive = ACTIVE_STATUSES.includes(a.status) ? 0 : a.status === "COMPLETED" ? 1 : 2;
              const bActive = ACTIVE_STATUSES.includes(b.status) ? 0 : b.status === "COMPLETED" ? 1 : 2;
              if (aActive !== bActive) return aActive - bActive;

              // 1순위: 최신순 (startTime 기준 내림차순)
              return new Date(b.scheduleResponse.startTime).getTime() - new Date(a.scheduleResponse.startTime).getTime();
            })
            .map((tour, index) => {
              // ✅ SWAGGER SPEC - EXACT MAPPING
              const startTime = tour.scheduleResponse.startTime; // ✅ scheduleResponse.startTime (ISO 8601)
              const dDay = calculateDDay(startTime);
              const isDToday = dDay === 0;
              const isPast = dDay < 0;
              
              const tourName = tour.name; // ✅ item.name (투어 제목)
              const thumbnail = tour.scheduleResponse.tourDTO.thumbnailImageUrl; // ✅ item.scheduleResponse.tourDTO.thumbnailImageUrl
              const userName = tour.hostUser.nickname; // ✅ item.hostUser.nickname
              const userProfileImage = tour.hostUser.profileImageUrl; // ✅ item.hostUser.profileImageUrl
              
              // ✅ [CRITICAL] ID 구분
              const folderId = tour.id; // ✅ Folder ID (자바 백엔드 출입증) - 11093
              const realTourId = tour.scheduleResponse.tourDTO.id; // ✅ 진짜 Tour ID (버블용) - 30

              console.log(`🎴 [Tour Card ${index}] ID MAPPING:`, {
                folderId: folderId, // ✅ 자바 백엔드 출입증 (11093)
                realTourId: realTourId, // ✅ 버블 Tour ID (30)
                name: tourName,
                startTime: startTime,
                dDay,
                thumbnailImageUrl: thumbnail || "No thumbnail",
                hostUserNickname: userName,
                hostUserProfileImageUrl: userProfileImage || "No profile",
                status: tour.status,
              });

              return (
                <motion.div
                  key={tour.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                  whileHover={{ scale: 1.03 }}
                  onClick={() => {
                    if (!isPast && tour.status !== "CANCELED") {
                      const poseInfo = poseReservations[folderId];
                      
                      // 예약이 없으면 인원 선택 바텀 시트 표시
                      if (!poseInfo?.has_reservation) {
                        logUserAction("예약하기 (인원선택)", { folderId, realTourId, tourName });
                        setPendingNavigation({
                          realTourId,
                          folderId,
                          tourName,
                          thumbnail,
                          startTime,
                        });
                        setGuestSheetOpen(true);
                      }
                      // 예약이 있으면 카드 자체는 클릭 무시 (버튼으로 수정/취소)
                    }
                  }}
                  className={`bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 ${
                    tour.status === "CANCELED" || tour.status === "NOSHOW"
                      ? "opacity-40 grayscale border-gray-200 pointer-events-none"
                      : isAiFolder(tour) && aiProgress[folderId] && !aiProgress[folderId].isComplete
                      ? "opacity-80 border-purple-200"
                      : !isPast 
                      ? "cursor-pointer hover:shadow-sm transition-shadow" 
                      : "opacity-60"
                  }`}
                >
                  {/* ✅ 상단: 썸네일 이미지 (SWAGGER: scheduleResponse.tourDTO.thumbnailImageUrl) */}
                  {thumbnail && (
                    <div className="relative h-48 bg-gray-100">
                      <img
                        src={thumbnail}
                        alt={tourName}
                        className="w-full h-full object-cover"
                      />
                      {/* D-Day Badge Overlay */}
                      <div className="absolute top-4 right-4 bg-[#0055FF] px-4 py-2 rounded-xl text-white shadow-sm">
                        {isDToday ? (
                          <span className="text-lg font-bold">D-DAY</span>
                        ) : isPast ? (
                          <span className="text-sm font-bold">완료</span>
                        ) : (
                          <span className="text-lg font-bold">D-{dDay}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* D-Day Badge (no thumbnail일 때) */}
                  {!thumbnail && (
                    <div className="bg-[#0055FF] p-6 text-white">
                      <div className="text-center">
                        {isDToday ? (
                          <span className="text-3xl font-bold">D-DAY</span>
                        ) : isPast ? (
                          <span className="text-2xl font-bold">완료</span>
                        ) : (
                          <>
                            <span className="text-sm block">D-</span>
                            <span className="text-4xl font-bold">{dDay}</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ✅ 중간: 투어 정보 (SWAGGER: name, scheduleResponse.startTime, status) */}
                  <div className="p-6">
                    <h3 className="text-2xl font-bold text-gray-800 mb-3 line-clamp-2 min-h-[3.5rem]">
                      {tourName}
                    </h3>

                    <div className="space-y-2 text-gray-600 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[#0055FF]">📅</span>
                        <span className="font-medium">{formatDate(startTime)}</span>
                      </div>
                      {/* 상태 배지 */}
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          tour.status === "CANCELED" || tour.status === "NOSHOW"
                            ? "bg-red-100 text-red-600"
                            : tour.status === "COMPLETED"
                            ? "bg-green-100 text-green-600"
                            : tour.status === "RESERVED"
                            ? "bg-blue-100 text-blue-600"
                            : tour.status === "PENDING"
                            ? "bg-yellow-100 text-yellow-700"
                            : tour.status === "UPLOAD_COMPLETED"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-100 text-gray-600"
                        }`}>
                          {tour.status === "CANCELED" ? "취소됨"
                            : tour.status === "NOSHOW" ? "노쇼"
                            : tour.status === "COMPLETED" ? "이용 완료"
                            : tour.status === "RESERVED" ? "예약 확정"
                            : tour.status === "PENDING" ? "대기 중"
                            : tour.status === "UPLOAD_COMPLETED" ? "업로드 완료"
                            : tour.status || "대기 중"}
                        </span>
                      </div>
                    </div>

                    {/* ✅ 하단: 예약자 정보 (SWAGGER: hostUser.nickname, hostUser.profileImageUrl) */}
                    <div className="flex items-center gap-3 pb-4 mb-4 border-b border-gray-200">
                      <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                        {userProfileImage ? (
                          <img
                            src={userProfileImage}
                            alt={userName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-[#0055FF] text-white text-lg font-bold">
                            {userName.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">호스트</p>
                        <p className="font-semibold text-gray-800">{userName}</p>
                      </div>
                    </div>

                    {/* ✅ [마이페이지 통합] 포즈 예약 상태 & CTA */}
                    {/* ✅ COMPLETED / UPLOAD_COMPLETED 상태: 앨범 보기 버튼 */}
                    {(tour.status === "COMPLETED" || tour.status === "UPLOAD_COMPLETED") && (() => {
                      const isAi = isAiFolder(tour);
                      const progress = aiProgress[folderId];
                      const aiProcessing = isAi && progress && !progress.isComplete;

                      return (
                        <div className="space-y-2 relative">
                          {/* AI 보정 진행 중 오버레이 */}
                          {aiProcessing && progress && (
                            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-bold text-purple-700 flex items-center gap-1.5">
                                  <span className="inline-block w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                                  AI 보정 중
                                </span>
                                <span className="text-sm font-extrabold text-purple-600">
                                  {progress.completedCount}/{progress.totalCount}장 ({progress.percentage}%)
                                </span>
                              </div>
                              <div className="h-2.5 bg-purple-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-700 ease-out"
                                  style={{
                                    width: `${progress.percentage}%`,
                                    background: "linear-gradient(90deg, #9333ea, #ec4899)",
                                  }}
                                />
                              </div>
                              <p className="text-[11px] text-purple-400 mt-2 text-center">
                                보정이 완료되면 자동으로 갱신됩니다
                              </p>
                            </div>
                          )}

                          {/* 완료 안내 (AI 보정이 아니거나 AI 보정 완료) */}
                          {(!isAi || (progress && progress.isComplete)) && (
                            <div className="bg-green-50 rounded-2xl p-3 text-center">
                              <p className="text-sm text-green-600 font-medium">
                                {isAi && progress?.isComplete ? "✨ AI 보정이 완료되었습니다" : "✅ 촬영이 완료되었습니다"}
                              </p>
                            </div>
                          )}

                          {/* 버튼: AI 보정 중이면 비활성화 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (aiProcessing) {
                                toast("아직 AI 보정이 진행 중입니다.\n완료 후 확인하실 수 있습니다.", { icon: "⏳" });
                                return;
                              }
                              logUserAction("폴더 보기", { folderId });
                              router.push(`/cheiz/folder/${folderId}`);
                            }}
                            disabled={!!aiProcessing}
                            className={`w-full py-3 px-4 font-bold rounded-xl transition-all text-base shadow-sm active:scale-[0.98] flex items-center justify-center gap-2 ${
                              aiProcessing
                                ? "bg-gray-300 text-gray-500 cursor-not-allowed shadow-none"
                                : "bg-[#0055FF] text-white hover:bg-opacity-90"
                            }`}
                          >
                            {aiProcessing ? (
                              <>⏳ AI 보정 진행 중...</>
                            ) : (
                              <>📷 사진 확인 & 리터칭</>
                            )}
                          </button>
                        </div>
                      );
                    })()}
                    {(tour.status === "CANCELED" || tour.status === "NOSHOW") && (
                      <div className="bg-red-50 rounded-2xl p-4 text-center">
                        <p className="text-sm text-red-500 font-medium">
                          {tour.status === "NOSHOW" ? "노쇼 처리되었습니다" : "예약이 취소되었습니다"}
                        </p>
                      </div>
                    )}
                    {/* ✅ 상태 기반 조건부 렌더링: RESERVED/PENDING만 액션 버튼 표시 */}
                    {!isPast && tour.status !== "CANCELED" && tour.status !== "NOSHOW" && tour.status !== "COMPLETED" && tour.status !== "UPLOAD_COMPLETED" && (() => {
                      const poseInfo = poseReservations[folderId];
                      const isLoadingPose = loadingPoseInfo[folderId];
                      const isActionable = tour.status === "RESERVED" || tour.status === "PENDING";

                      // 로딩 중
                      if (isLoadingPose) {
                        return (
                          <div className="bg-gray-50 rounded-2xl p-4 text-center">
                            <div className="animate-pulse flex items-center justify-center gap-2">
                              <div className="w-4 h-4 rounded-full bg-gray-300"></div>
                              <span className="text-gray-400 text-sm">포즈 정보 확인 중...</span>
                            </div>
                          </div>
                        );
                      }

                      // 포즈 예약이 있을 때
                      if (poseInfo?.has_reservation && poseInfo.reservation) {
                        const badge = getStatusBadge(poseInfo.reservation.status);
                        const isCancelling = cancellingId === poseInfo.reservation.id;

                        return (
                          <div className="space-y-3">
                            {/* 예약 상태 표시 */}
                            <div className="bg-blue-50 rounded-2xl p-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${badge.color}`}>
                                  {badge.icon} {badge.text}
                                </span>
                                <span className="text-sm font-bold text-[#0055FF]">
                                  {poseInfo.pose_count}개 포즈 선택됨
                                </span>
                              </div>
                            </div>

                            {/* QR코드 / 상세보기: RESERVED 또는 PENDING일 때만 */}
                            {isActionable && poseInfo.reservation.status === "pending" && (
                              <div className="space-y-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleShowQRCode(poseInfo.reservation!.id, tourName);
                                  }}
                                  className="w-full py-3 px-4 bg-[#0055FF] text-white font-bold rounded-xl hover:bg-opacity-90 transition-all text-base shadow-sm"
                                >
                                  📱 QR코드 표시하기
                                </button>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    logUserAction("예약 상세보기", { folderId });
                                    router.push(`/cheiz/my-tours/${folderId}`);
                                  }}
                                  className="w-full py-2.5 px-4 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-all text-sm"
                                >
                                  예약 상세 보기 →
                                </button>
                              </div>
                            )}

                            {/* 비활성 상태 안내 (scanned 등) */}
                            {!isActionable && (
                              <div className="bg-gray-50 rounded-2xl p-3 text-center">
                                <p className="text-sm text-gray-500 font-medium">이용 완료</p>
                              </div>
                            )}
                          </div>
                        );
                      }

                      // 포즈 예약이 없을 때 (RESERVED 상태에서만 포즈 선택 유도)
                      if (isActionable) {
                        return (
                          <div className="space-y-2">
                            <p className="text-gray-400 text-sm text-center">
                              아직 포즈를 선택하지 않았습니다
                            </p>
                            <div className="bg-[#0055FF]/10 rounded-2xl p-3 text-center">
                              <span className="text-[#0055FF] font-bold text-sm">
                                포즈 고르러 가기 →
                              </span>
                            </div>
                          </div>
                        );
                      }

                      return null;
                    })()}
                  </div>
                </motion.div>
              );
            })}
        </div>

        {/* 현재 탭에 데이터가 없을 때 */}
        {tours.filter(t => activeTab === "active"
          ? t.status !== "CANCELED" && t.status !== "NOSHOW" && t.status !== "PAYMENT_IN_PROGRESS"
          : t.status === "CANCELED" || t.status === "NOSHOW").length === 0 && (
          <div className="bg-gray-50 rounded-2xl p-10 text-center">
            <p className="text-4xl mb-3">{activeTab === "active" ? "📭" : "🗑️"}</p>
            <p className="text-gray-500 text-sm font-medium">
              {activeTab === "active" ? "유효한 예약이 없습니다" : "취소된 예약이 없습니다"}
            </p>
          </div>
        )}

        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
            <p className="text-red-700">{error}</p>
            <button
              onClick={() => {
                logUserAction("다시 시도", {});
                fetchTours();
              }}
              className="mt-3 text-[#0055FF] font-bold hover:underline"
            >
              다시 시도
            </button>
          </div>
        )}
      </div>

      {/* ==================== QR코드 모달 팝업 ==================== */}
      <AnimatePresence>
        {qrModalData.visible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
            onClick={() => {
              logUserAction("QR모달 닫기 (배경 클릭)", { reservationId: qrModalData.reservationId });
              setQrModalData((prev) => ({ ...prev, visible: false }));
            }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 50 }}
              transition={{ type: "spring", duration: 0.6 }}
              className="bg-white rounded-2xl p-8 md:p-12 max-w-md w-full text-center shadow-lg border border-gray-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-5xl mb-4">📱</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                QR 코드
              </h2>
              <p className="text-gray-500 text-sm mb-6">
                {qrModalData.tourName}
              </p>

              {/* QR Code 이미지 */}
              {qrModalData.qrCodeUrl && (
                <div className="mb-6">
                  <div className="bg-gray-50 rounded-2xl p-6 inline-block">
                    <img
                      src={qrModalData.qrCodeUrl}
                      alt="Reservation QR Code"
                      className="w-64 h-64 mx-auto"
                    />
                  </div>
                  <p className="text-sm text-gray-500 mt-4">
                    포토그래퍼에게 이 QR 코드를 보여주세요
                  </p>
                </div>
              )}

              {/* 6자리 예약 코드 (악천후 백업) */}
              {qrModalData.reservationId && (
                <div className="bg-gradient-to-r from-[#0055FF] to-[#3377FF] rounded-2xl p-5 mb-4">
                  <p className="text-xs text-white/70 mb-1.5">예약 코드 (포토그래퍼에게 알려주세요)</p>
                  <p className="text-3xl font-mono font-extrabold text-white tracking-[0.3em] text-center">
                    {qrModalData.reservationId.replace(/\D/g, "").slice(-6).padStart(6, "0")}
                  </p>
                  <p className="text-[10px] text-white/50 mt-2">QR이 안 될 경우 이 코드를 사용하세요</p>
                </div>
              )}

              {/* 예약 번호 (전체 ID) */}
              {qrModalData.reservationId && (
                <div className="bg-gray-50 rounded-xl p-3 mb-6">
                  <p className="text-[10px] text-gray-400 mb-0.5">예약 번호</p>
                  <p className="text-xs font-mono text-gray-500 truncate">
                    {qrModalData.reservationId}
                  </p>
                </div>
              )}

              {/* 닫기 버튼 */}
              <button
                onClick={() => {
                  logUserAction("QR모달 닫기", { reservationId: qrModalData.reservationId });
                  setQrModalData((prev) => ({ ...prev, visible: false }));
                }}
                className="w-full bg-[#0055FF] text-white py-3 rounded-xl font-bold hover:bg-opacity-90 transition-all"
              >
                닫기
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 인원 선택 바텀 시트 */}
      <GuestSheet
        isOpen={guestSheetOpen}
        onClose={() => {
          setGuestSheetOpen(false);
          setPendingNavigation(null);
        }}
        onConfirm={(count: GuestCount) => {
          setGuestCount(count);
          setGuestSheetOpen(false);
          if (pendingNavigation) {
            const { realTourId, folderId, tourName, thumbnail, startTime } = pendingNavigation;
            setStoreTourId(realTourId);
            setStoreFolderId(folderId);
            // 투어 메타데이터를 스토어에 미리 저장 (checkout에서 사용)
            setStoreTour({
              _id: String(realTourId),
              tour_Id: realTourId,
              tour_name: tourName,
              tour_thumbnail: thumbnail,
              tour_date: startTime,
              tour_time: startTime
                ? formatKSTTime(startTime)
                : undefined,
            });
            router.push(`/cheiz/reserve/spots?tour_id=${realTourId}&folder_id=${folderId}`);
            setPendingNavigation(null);
          }
        }}
      />
    </div>
  );
}

export default function MyToursPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-[#0055FF] border-solid"></div>
        </div>
      }
    >
      <MyToursContent />
    </Suspense>
  );
}
