"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { getUserTours, type Tour } from "@/lib/api-client";
import { formatKSTDate, formatKST24Time } from "@/lib/utils";
import QRCode from "qrcode";
import {
  ChevronLeft, MapPin, QrCode, AlertTriangle, Edit3,
} from "lucide-react";
import { useModal } from "@/components/GlobalModal";
import { useReservationStore } from "@/lib/reservation-store";
import Button from "@/components/ui/Button";

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

  const { setEditMode, setTourId, setFolderId, clearSelections } = useReservationStore();

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
        color: { dark: "var(--cheiz-primary)", light: "#FFFFFF" },
      });
      setQrDataUrl(url);
    } catch (e) {
      console.error("[BookingDetail] QR 생성 실패:", e);
    }
  };

  // 예약 취소 (Java folder status → Bubble pose_reservation cancel)
  const handleCancel = async () => {
    if (!tour) return;
    setCancelling(true);

    try {
      // Step 1: Java PATCH /api/v1/folders/{folderId}/status?status=CANCELED
      const patchRes = await fetch(`/api/backend/folders/${tour.id}/status?status=CANCELED`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });

      if (!patchRes.ok) {
        const errStatus = patchRes.status;
        if (errStatus === 403) {
          await showError("취소 권한이 없습니다");
        } else {
          await showError("취소 중 오류가 발생했습니다.");
        }
        return;
      }

      // Step 2: Bubble pose_reservation → canceled
      try {
        await fetch("/api/bubble/pose-reservation-cancel", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderId: tour.id }),
        });
      } catch (bubbleErr) {
        console.warn("[BookingDetail] Bubble 상태 변경 실패 (Java는 성공):", bubbleErr);
      }

      await showSuccess("예약이 취소되었습니다.", { title: "취소 완료" });
      router.push("/cheiz/my-tours");
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
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-cheiz-primary border-solid" />
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
          className="text-cheiz-primary font-bold hover:underline"
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
  const folderId = tour.id;
  const folderStatus = tour.status || "";
  const reservationId = poseInfo?.reservation?.id || "";
  const backupCode = reservationId.replace(/\D/g, "").slice(-6).padStart(6, "0");
  const isActionable = folderStatus === "RESERVED" || folderStatus === "PENDING";

  const location = tour.scheduleResponse?.tourDTO?.location || "";
  const locationDetail = tour.scheduleResponse?.tourDTO?.locationDetail || "";
  const dateObj = startTime ? new Date(startTime) : null;

  const statusLabel: Record<string, { text: string; cls: string }> = {
    RESERVED: { text: "예약완료", cls: "bg-green-100 text-green-700" },
    PENDING: { text: "대기중", cls: "bg-yellow-100 text-yellow-700" },
    CANCELED: { text: "취소됨", cls: "bg-red-100 text-red-700" },
    COMPLETED: { text: "촬영완료", cls: "bg-cheiz-primary/10 text-cheiz-primary" },
    UPLOAD_COMPLETED: { text: "촬영완료", cls: "bg-cheiz-primary/10 text-cheiz-primary" },
  };
  const badge = statusLabel[folderStatus] || { text: folderStatus, cls: "bg-gray-100 text-gray-600" };

  const guestCount = (tour as any).personCount || 1;
  const persona = (tour as any).persona || "";
  const isCanceled = folderStatus === "CANCELED";

  const infoRows = [
    { icon: "📅", label: "예약일", value: dateObj ? formatKSTDate(startTime) : "-" },
    { icon: "⏰", label: "촬영 시간", value: dateObj ? formatKST24Time(startTime) : "-" },
    { icon: "📍", label: "촬영 장소", value: [location, locationDetail].filter(Boolean).join(" ") || "-" },
    { icon: "🏷️", label: "상품명", value: tourName || "-" },
    { icon: "👤", label: "예약자", value: session?.user?.nickname || session?.user?.name || "고객" },
    { icon: "👥", label: "인원", value: `${guestCount}명` },
    { icon: "🎭", label: "페르소나", value: persona || "미선택" },
  ];

  return (
    <div className="min-h-screen bg-cheiz-bg pb-8">
      {/* ═══ PageHeader ═══ */}
      <div className="sticky top-0 bg-white z-30 flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
          <ChevronLeft className="w-5 h-5 text-cheiz-text" />
        </button>
        <h1 className="text-base font-bold text-cheiz-text">예약 상세</h1>
      </div>

      <div className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* ═══ 컴팩트 투어 헤더 ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-4"
        >
          <div className="flex items-start gap-3">
            {thumbnail ? (
              <img src={thumbnail} alt={tourName} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-cheiz-surface flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 text-cheiz-sub/40" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h2 className="font-bold text-cheiz-text text-[15px] leading-snug truncate">{tourName}</h2>
                <span className={`flex-shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full ${badge.cls}`}>
                  {badge.text}
                </span>
              </div>
              <p className="text-xs text-cheiz-sub leading-relaxed">
                {dateObj ? `${formatKSTDate(startTime)} · ${formatKST24Time(startTime)}` : "-"}
              </p>
              {(location || locationDetail) && (
                <p className="text-xs text-cheiz-sub leading-relaxed flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{[location, locationDetail].filter(Boolean).join(" ")}</span>
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* ═══ 예약 정보 카드 ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl overflow-hidden"
        >
          <p className="text-sm font-bold text-cheiz-sub px-4 pt-4 pb-2">예약 정보</p>
          {infoRows.map((row, i) => (
            <div
              key={i}
              className={`flex justify-between items-center px-4 py-3 ${
                i < infoRows.length - 1 ? "border-b border-cheiz-border" : ""
              }`}
            >
              <span className="text-sm text-cheiz-sub">{row.icon} {row.label}</span>
              <span className="text-sm font-medium text-cheiz-text text-right max-w-[55%] truncate">{row.value}</span>
            </div>
          ))}
        </motion.div>

        {/* ═══ QR / 예약코드 섹션 (RESERVED / PENDING 상태만) ═══ */}
        {poseInfo?.has_reservation && reservationId && isActionable && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-4"
          >
            <p className="text-sm text-cheiz-sub text-center mb-3">현장 확인용 QR 코드</p>
            <div className="flex justify-center">
              {qrDataUrl ? (
                <div className="bg-cheiz-bg rounded-2xl p-5 inline-block">
                  <img src={qrDataUrl} alt="QR Code" className="w-48 h-48 mx-auto" />
                </div>
              ) : (
                <div className="bg-cheiz-bg rounded-2xl p-8 inline-block">
                  <QrCode className="w-16 h-16 text-gray-300 mx-auto" />
                </div>
              )}
            </div>
            <p className="text-xs text-cheiz-sub text-center mt-2">포토그래퍼에게 이 QR 코드를 보여주세요</p>

            <div className="border-t border-cheiz-border mt-3 pt-3">
              <div className="bg-cheiz-primary rounded-2xl py-4 text-center">
                <p className="text-xs text-white/70">예약 코드</p>
                <p className="text-3xl font-bold text-white tracking-widest mt-1">{backupCode}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══ 포즈 수정 (RESERVED / PENDING 상태만) ═══ */}
        {isActionable && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Button
              variant="secondary"
              onClick={() => {
                const realTourId = tour.scheduleResponse?.tourDTO?.id;
                const reservedPoseIds = poseInfo?.reserved_poses?.map((p: any) => p.spot_pose_Id).filter(Boolean) || [];
                clearSelections();
                setTourId(realTourId);
                setFolderId(folderId);
                setEditMode(true, reservationId || null, reservedPoseIds);
                router.push(`/cheiz/reserve/spots?tour_id=${realTourId}&folder_id=${folderId}&mode=edit`);
              }}
              className="w-full flex items-center justify-center gap-2"
            >
              <Edit3 className="w-4 h-4" /> ✏️ 포즈 수정하기
            </Button>
          </motion.div>
        )}

        {/* ═══ 예약 취소 (PENDING 상태에서만 노출) ═══ */}
        {folderStatus === "PENDING" && (
          <div className="pt-4 pb-8">
            <button
              onClick={() => setShowCancelModal(true)}
              className="w-full py-3 text-center text-red-400 text-sm font-medium"
            >
              예약 취소하기
            </button>
          </div>
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
                <h3 className="text-lg font-bold text-gray-900 mb-1">예약을 취소할까요?</h3>
                <p className="text-sm text-gray-500">
                  취소된 예약은 복구할 수 없어요.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50 transition-colors"
                >
                  닫기
                </button>
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="flex-1 py-3 rounded-xl bg-red-400 text-white font-bold text-sm transition-colors disabled:opacity-50"
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
