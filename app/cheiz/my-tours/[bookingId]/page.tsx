"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { getUserTours, type Tour } from "@/lib/api-client";
import { formatKSTTime, formatKSTDate, formatKST24Time } from "@/lib/utils";
import QRCode from "qrcode";
import {
  ChevronLeft, Calendar, MapPin, User, Clock,
  CreditCard, QrCode, AlertTriangle, X,
} from "lucide-react";
import { useModal } from "@/components/GlobalModal";

// ==================== Types ====================

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
  reserved_poses?: { id: string; spot_pose_Id: string }[];
};

// ==================== Main Component ====================

export default function BookingDetailPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const bookingId = params.bookingId as string;
  const { showSuccess, showError } = useModal();

  const [tour, setTour] = useState<Tour | null>(null);
  const [loading, setLoading] = useState(true);
  const [poseInfo, setPoseInfo] = useState<PoseReservationInfo | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // 투어 정보 로드
  useEffect(() => {
    if (authStatus === "loading") return;
    if (!session) {
      router.replace("/auth/signin?callbackUrl=/cheiz/my-tours");
      return;
    }
    loadBookingData();
  }, [authStatus, session, bookingId]);

  const loadBookingData = async () => {
    if (!session?.user?.id) return;
    setLoading(true);

    try {
      // 전체 투어 목록에서 해당 folderId 찾기
      const response = await getUserTours(session.user.id);
      const allTours: Tour[] =
        response.data?.content || response.content || response.data || [];

      const matched = allTours.find((t: any) => String(t.id) === String(bookingId));
      if (matched) {
        setTour(matched);
        // 포즈 예약 정보 조회
        fetchPoseReservation(matched.id);
      } else {
        console.warn(`[BookingDetail] folderId=${bookingId}에 해당하는 예약 없음`);
      }
    } catch (e) {
      console.error("[BookingDetail] 데이터 로드 실패:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPoseReservation = useCallback(async (folderId: number) => {
    try {
      const res = await fetch(`/api/bubble/pose-reservation-by-folder?folder_id=${folderId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setPoseInfo(data);
          // QR코드 자동 생성
          if (data.reservation?.id) {
            generateQR(data.reservation.id);
          }
        }
      }
    } catch (e) {
      console.error("[BookingDetail] 포즈 조회 실패:", e);
    }
  }, []);

  const generateQR = async (reservationId: string) => {
    try {
      const qrData = `${window.location.origin}/photographer/scan?reservation_id=${reservationId}`;
      const url = await QRCode.toDataURL(qrData, {
        width: 280,
        margin: 2,
        color: { dark: "#0055FF", light: "#FFFFFF" },
      });
      setQrDataUrl(url);
    } catch (e) {
      console.error("[BookingDetail] QR 생성 실패:", e);
    }
  };

  // 예약 취소
  const handleCancel = async () => {
    if (!poseInfo?.reservation?.id || !tour) return;
    setCancelling(true);

    try {
      // Step 1: Java 백엔드 폴더 CANCELED
      try {
        await fetch("/api/backend/cancel-folder", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderId: tour.id }),
        });
      } catch {}

      // Step 2: Bubble DB 삭제
      const res = await fetch("/api/bubble/cancel-reservation", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservation_id: poseInfo.reservation.id }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          await showSuccess("예약이 취소되었습니다.", { title: "취소 완료" });
          router.push("/cheiz/my-tours");
          return;
        }
      }
      await showError("취소에 실패했습니다. 다시 시도해주세요.");
    } catch (e) {
      console.error("[BookingDetail] 취소 실패:", e);
      await showError("취소 중 오류가 발생했습니다.");
    } finally {
      setCancelling(false);
      setShowCancelModal(false);
    }
  };

  // ==================== Loading ====================
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-[#0055FF] border-solid" />
      </div>
    );
  }

  if (!tour) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <p className="text-4xl mb-4">📭</p>
        <p className="text-gray-500 font-medium mb-4">예약 정보를 찾을 수 없습니다</p>
        <button
          onClick={() => router.push("/cheiz/my-tours")}
          className="text-[#0055FF] font-bold hover:underline"
        >
          ← 목록으로 돌아가기
        </button>
      </div>
    );
  }

  // ==================== Data Extraction ====================
  const startTime = tour.scheduleResponse?.startTime || "";
  const tourName = tour.name || "";
  const thumbnail = tour.scheduleResponse?.tourDTO?.thumbnailImageUrl || "";
  const hostName = tour.hostUser?.nickname || "";
  const hostImage = tour.hostUser?.profileImageUrl || "";
  const folderId = tour.id;
  const folderStatus = tour.status || "";
  const reservationId = poseInfo?.reservation?.id || "";
  const backupCode = reservationId.replace(/\D/g, "").slice(-6).padStart(6, "0");
  const isActionable = folderStatus === "RESERVED" || folderStatus === "PENDING";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ═══ 헤더 ═══ */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1">
            <ChevronLeft className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="font-bold text-base text-gray-900 flex-1 truncate">예약 상세</h1>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 py-6 space-y-5">
        {/* ═══ 투어 카드 ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100"
        >
          {thumbnail && (
            <div className="relative h-44 bg-gray-100">
              <img src={thumbnail} alt={tourName} className="w-full h-full object-cover" />
              {/* 상태 배지 */}
              <div className={`absolute top-3 right-3 px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm ${
                folderStatus === "CANCELED" ? "bg-red-500 text-white"
                : folderStatus === "COMPLETED" ? "bg-green-500 text-white"
                : "bg-[#0055FF] text-white"
              }`}>
                {folderStatus === "CANCELED" ? "취소됨"
                  : folderStatus === "COMPLETED" ? "이용 완료"
                  : folderStatus === "RESERVED" ? "예약 확정"
                  : folderStatus === "PENDING" ? "대기 중"
                  : folderStatus === "UPLOAD_COMPLETED" ? "업로드 완료"
                  : folderStatus}
              </div>
            </div>
          )}

          <div className="p-5">
            <h2 className="text-xl font-bold text-gray-900 mb-3 leading-tight">{tourName}</h2>

            <div className="space-y-2.5 text-sm">
              <div className="flex items-center gap-2.5 text-gray-600">
                <Calendar className="w-4 h-4 text-[#0055FF] flex-shrink-0" />
                <span className="font-medium">{formatKSTDate(startTime)}</span>
              </div>
              <div className="flex items-center gap-2.5 text-gray-600">
                <Clock className="w-4 h-4 text-[#0055FF] flex-shrink-0" />
                <span className="font-medium">{formatKST24Time(startTime)}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ═══ 예약자 정보 ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
        >
          <h3 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">예약자 정보</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-700">
                {session?.user?.nickname || session?.user?.name || "고객"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-700">
                {tour.scheduleResponse?.tourDTO?.location || ""}{" "}
                {tour.scheduleResponse?.tourDTO?.locationDetail || ""}
              </span>
            </div>
            {hostName && (
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 flex items-center justify-center">
                  {hostImage ? (
                    <img src={hostImage} alt="" className="w-4 h-4 rounded-full object-cover" />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-[#0055FF]/20 flex items-center justify-center text-[8px] text-[#0055FF] font-bold">
                      {hostName[0]}
                    </div>
                  )}
                </div>
                <span className="text-sm text-gray-700">호스트: {hostName}</span>
              </div>
            )}
            {poseInfo?.pose_count != null && poseInfo.pose_count > 0 && (
              <div className="flex items-center gap-3">
                <span className="w-4 h-4 text-center text-xs">📸</span>
                <span className="text-sm text-gray-700">선택 포즈: {poseInfo.pose_count}개</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* ═══ QR 코드 영역 ═══ */}
        {poseInfo?.has_reservation && reservationId && isActionable && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center"
          >
            <h3 className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wider">현장 확인용 QR 코드</h3>

            {qrDataUrl ? (
              <div className="bg-gray-50 rounded-2xl p-5 inline-block mb-4">
                <img src={qrDataUrl} alt="QR Code" className="w-56 h-56 mx-auto" />
              </div>
            ) : (
              <div className="bg-gray-50 rounded-2xl p-8 mb-4">
                <QrCode className="w-16 h-16 text-gray-300 mx-auto" />
              </div>
            )}

            <p className="text-xs text-gray-400 mb-4">포토그래퍼에게 이 QR 코드를 보여주세요</p>

            {/* 6자리 백업 코드 */}
            <div className="bg-gradient-to-r from-[#0055FF] to-[#3377FF] rounded-2xl p-4">
              <p className="text-[10px] text-white/60 mb-1">예약 코드 (QR이 안 될 경우)</p>
              <p className="text-2xl font-mono font-extrabold text-white tracking-[0.3em]">
                {backupCode}
              </p>
            </div>

            {/* 전체 예약 번호 */}
            <div className="mt-3 bg-gray-50 rounded-xl p-2.5">
              <p className="text-[10px] text-gray-400">예약 번호</p>
              <p className="text-[11px] font-mono text-gray-500 truncate">{reservationId}</p>
            </div>
          </motion.div>
        )}

        {/* ═══ 결제 정보 (있을 경우) ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
        >
          <h3 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">결제 정보</h3>
          <div className="flex items-center gap-3">
            <CreditCard className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-700">
              {tour.paymentType || "쿠폰 결제"}
            </span>
          </div>
          {tour.totalPrice != null && tour.totalPrice > 0 && (
            <div className="mt-2 flex items-center gap-3">
              <span className="w-4 h-4 text-center text-xs">💰</span>
              <span className="text-sm font-bold text-gray-900">
                {Number(tour.totalPrice).toLocaleString()}원
              </span>
            </div>
          )}
        </motion.div>

        {/* ═══ 예약 취소 버튼 (RESERVED/PENDING일 때만) ═══ */}
        {isActionable && poseInfo?.has_reservation && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="pt-2 pb-8"
          >
            <button
              onClick={() => setShowCancelModal(true)}
              className="w-full py-3 text-sm font-medium text-red-400 hover:text-red-500 transition-colors"
            >
              예약 취소하기
            </button>
          </motion.div>
        )}
      </div>

      {/* ═══ 예약 취소 확인 모달 ═══ */}
      <AnimatePresence>
        {showCancelModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
            onClick={() => setShowCancelModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-5">
                <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-gray-900 mb-1">예약을 취소하시겠습니까?</h3>
                <p className="text-sm text-gray-500">
                  선택한 포즈가 모두 삭제되며,<br />
                  취소 후 새로 예약해야 합니다.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50 transition-colors"
                >
                  돌아가기
                </button>
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {cancelling ? "취소 중..." : "예약 취소"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
