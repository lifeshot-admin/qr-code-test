"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, Suspense } from "react";
import { getUserTours, type Tour } from "@/lib/api-client";
import { useReservationStore } from "@/lib/reservation-store";
import QRCode from "qrcode";

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
  
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Check for access denied error
  useEffect(() => {
    const errorType = searchParams.get("error");
    const message = searchParams.get("message");
    
    if (errorType === "access_denied" && message) {
      // Show toast notification
      alert(`⛔ ${message}`);
      
      // Clean URL
      router.replace("/cheiz/my-tours");
    }
  }, [searchParams, router]);

  // Fetch user tours
  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/auth/signin");
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

      // ✅ SWAGGER SPEC: statusSet parameter (RESERVED only)
      // 🧪 [테스트] RESERVED 데이터가 0개라면 아래를 수정하여 테스트:
      // const response = await getUserTours(session.user.id); // statusSet 제거 (모든 상태)
      // const response = await getUserTours(session.user.id, "COMPLETED"); // 완료된 투어
      const response = await getUserTours(session.user.id, "RESERVED");
      
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
      console.log("📦 [My Tours] 최종 추출된 데이터:", toursData.length, "개");
      
      setTours(toursData);

      // ✅ [마이페이지 통합] 각 투어의 포즈 예약 상태 조회
      for (const t of toursData) {
        const fId = t.id; // folder_Id
        fetchPoseReservation(fId);
      }

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

  // ✅ [마이페이지 통합] 포즈 예약 취소
  const handleCancelReservation = async (reservationId: string, folderId: number) => {
    if (!confirm("정말로 포즈 예약을 취소하시겠습니까?\n선택한 포즈가 모두 삭제됩니다.")) return;

    setCancellingId(reservationId);
    try {
      const res = await fetch("/api/bubble/cancel-reservation", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservation_id: reservationId }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          alert("포즈 예약이 취소되었습니다.");
          // 상태 갱신
          setPoseReservations((prev) => ({
            ...prev,
            [folderId]: { has_reservation: false, reservation: null, pose_count: 0 },
          }));
        } else {
          alert("취소에 실패했습니다. 다시 시도해주세요.");
        }
      }
    } catch (e) {
      console.error("❌ [Cancel] 취소 실패:", e);
      alert("취소 중 오류가 발생했습니다.");
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
          dark: "#0EA5E9",
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
      alert("QR 코드 생성에 실패했습니다.");
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

  // Calculate D-day (ISO 8601 datetime 기준)
  const calculateDDay = (startTime: string): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const target = new Date(startTime); // ✅ SWAGGER: scheduleResponse.startTime (ISO 8601)
    target.setHours(0, 0, 0, 0);
    
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  // Format date (ISO 8601 datetime → "2026년 2월 11일")
  const formatDate = (startTime: string): string => {
    const date = new Date(startTime); // ✅ SWAGGER: scheduleResponse.startTime
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-skyblue border-solid mx-auto mb-4"></div>
          <p className="text-gray-600">투어 정보를 불러오는 중...</p>
        </motion.div>
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
              router.push("/auth/signin");
            }}
            className="bg-skyblue text-white font-bold py-4 px-8 rounded-3xl hover:bg-opacity-90 transition-all transform hover:scale-105 shadow-lg"
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
            className="bg-skyblue text-white font-bold py-4 px-8 rounded-3xl hover:bg-opacity-90 transition-all transform hover:scale-105 shadow-lg"
          >
            쿠폰 조회하기
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // Tours list
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Sub Navigation (레이아웃 헤더와 중복 제거) */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-2 flex items-center gap-2 text-sm text-gray-500">
          <button
            onClick={() => router.push("/cheiz")}
            className="hover:text-skyblue transition-colors"
          >
            ← 홈
          </button>
          <span className="text-gray-300">|</span>
          <span className="font-medium text-gray-700">마이페이지</span>
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
            마이페이지
          </h2>
          <p className="text-gray-600">
            예약된 투어를 확인하고 포즈를 선택해보세요 ✨
          </p>
        </motion.div>

        {/* Tours Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tours
            .sort((a, b) => new Date(a.scheduleResponse.startTime).getTime() - new Date(b.scheduleResponse.startTime).getTime())
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
                    if (!isPast) {
                      const poseInfo = poseReservations[folderId];
                      
                      // 예약이 없으면 포즈 선택 페이지로
                      if (!poseInfo?.has_reservation) {
                        logUserAction("포즈 고르러 가기", { folderId, realTourId, tourName });
                        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                        console.log("🎯 [Card Click] 포즈 선택 페이지로 이동:");
                        console.log("  📁 Folder ID (출입증):", folderId);
                        console.log("  🎫 Tour ID (버블):", realTourId);
                        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                        router.push(`/cheiz/reserve/spots?tour_id=${realTourId}&folder_id=${folderId}`);
                      }
                      // 예약이 있으면 카드 자체는 클릭 무시 (버튼으로 수정/취소)
                    }
                  }}
                  className={`bg-white rounded-3xl shadow-md overflow-hidden ${
                    !isPast ? "cursor-pointer hover:shadow-xl transition-shadow" : "opacity-60"
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
                      <div className="absolute top-4 right-4 bg-gradient-to-r from-skyblue to-blue-500 px-4 py-2 rounded-3xl text-white shadow-lg">
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
                    <div className="bg-gradient-to-r from-skyblue to-blue-500 p-6 text-white">
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
                    <h3 className="text-2xl font-bold text-gray-800 mb-3">
                      {tourName}
                    </h3>

                    <div className="space-y-2 text-gray-600 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-skyblue">📅</span>
                        <span className="font-medium">{formatDate(startTime)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-skyblue">📍</span>
                        <span className="font-medium capitalize">
                          {tour.status}
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
                          <div className="w-full h-full flex items-center justify-center bg-skyblue text-white text-lg font-bold">
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
                    {!isPast && (() => {
                      const poseInfo = poseReservations[folderId];
                      const isLoadingPose = loadingPoseInfo[folderId];

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
                                <span className="text-sm font-bold text-skyblue">
                                  {poseInfo.pose_count}개 포즈 선택됨
                                </span>
                              </div>
                            </div>

                            {/* QR코드 표시 (메인 버튼) + 포즈 수정 (보조 버튼) */}
                            {poseInfo.reservation.status === "pending" && (
                              <div className="space-y-2">
                                {/* 메인 버튼: QR코드 표시하기 */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleShowQRCode(poseInfo.reservation!.id, tourName);
                                  }}
                                  className="w-full py-3 px-4 bg-skyblue text-white font-bold rounded-2xl hover:bg-opacity-90 transition-all text-base shadow-md"
                                >
                                  📱 QR코드 표시하기
                                </button>

                                {/* 보조 버튼: 포즈 수정하기 + 취소 */}
                                <div className="flex gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      logUserAction("포즈 수정하기", { realTourId, folderId });
                                      handleEditReservation(realTourId, folderId);
                                    }}
                                    className="flex-1 py-2 px-3 border border-gray-300 text-gray-600 font-medium rounded-2xl hover:bg-gray-50 transition-all text-xs"
                                  >
                                    포즈 수정
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      logUserAction("예약 취소", { reservationId: poseInfo.reservation!.id, folderId });
                                      handleCancelReservation(poseInfo.reservation!.id, folderId);
                                    }}
                                    disabled={isCancelling}
                                    className="flex-1 py-2 px-3 border border-red-200 text-red-500 font-medium rounded-2xl hover:bg-red-50 transition-all text-xs disabled:opacity-50"
                                  >
                                    {isCancelling ? "취소 중..." : "예약 취소"}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }

                      // 포즈 예약이 없을 때
                      return (
                        <div className="space-y-2">
                          <p className="text-gray-400 text-sm text-center">
                            아직 포즈를 선택하지 않았습니다
                          </p>
                          <div className="bg-skyblue bg-opacity-10 rounded-2xl p-3 text-center">
                            <span className="text-skyblue font-bold text-sm">
                              포즈 고르러 가기 →
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </motion.div>
              );
            })}
        </div>

        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-3xl p-4 text-center">
            <p className="text-red-700">{error}</p>
            <button
              onClick={() => {
                logUserAction("다시 시도", {});
                fetchTours();
              }}
              className="mt-3 text-skyblue font-bold hover:underline"
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
              className="bg-white rounded-3xl p-8 md:p-12 max-w-md w-full text-center shadow-2xl"
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

              {/* 예약 번호 */}
              {qrModalData.reservationId && (
                <div className="bg-skyblue/10 rounded-2xl p-4 mb-6">
                  <p className="text-xs text-gray-500 mb-1">예약 번호</p>
                  <p className="text-sm font-mono font-bold text-gray-700">
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
                className="w-full bg-skyblue text-white py-3 rounded-2xl font-bold hover:bg-opacity-90 transition-all"
              >
                닫기
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function MyToursPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-skyblue border-solid"></div>
        </div>
      }
    >
      <MyToursContent />
    </Suspense>
  );
}
