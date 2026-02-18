"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Download, Sparkles, X, CheckCheck,
  ChevronRight, Eye, Loader2, Wand2, AlertCircle, Info,
} from "lucide-react";
import { useModal } from "@/components/GlobalModal";
import SecureImage from "@/components/SecureImage";

// ━━━ 타입 ━━━
type Photo = {
  id: string | number;
  url: string;
  thumbnailUrl?: string;
  aiUrl?: string;
  imageUrl?: string; originalUrl?: string; aiImageUrl?: string; photoUrl?: string;
  type?: string; status?: string; createdAt?: string;
};

type FolderDetail = {
  id: number;
  scheduleId: number | null;
  name: string;
  personCount: number;
  hostUserId: number | null;
  status?: string;
};

export default function FolderPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const folderId = params?.folderId as string;
  const { showAlert, showError } = useModal();

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  // ━━━ 폴더 상세 (scheduleId 추출용) ━━━
  const [folderDetail, setFolderDetail] = useState<FolderDetail | null>(null);
  const [resolvedScheduleId, setResolvedScheduleId] = useState<number | null>(null);

  // ━━━ 확인 모달 ━━━
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // ━━━ 상세 뷰어 ━━━
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"original" | "ai">("ai");
  const [slideDir, setSlideDir] = useState(0);
  const touchStartX = useRef(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const viewerLoadedRef = useRef(false);

  const slideVariants = {
    enter: (dir: number) => ({ x: dir >= 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir >= 0 ? -300 : 300, opacity: 0 }),
  };

  const viewerGoNext = () => {
    if (viewerIndex < photos.length - 1) { setSlideDir(1); setViewerIndex(viewerIndex + 1); }
  };
  const viewerGoPrev = () => {
    if (viewerIndex > 0) { setSlideDir(-1); setViewerIndex(viewerIndex - 1); }
  };

  const openViewer = (idx: number) => {
    setSlideDir(0);
    setViewerIndex(idx);
    setViewerOpen(true);
    window.history.pushState({ viewer: true }, "");
  };
  useEffect(() => {
    if (!viewerOpen) return;
    const onPopState = (e: PopStateEvent) => {
      if (viewerOpen) { e.preventDefault(); setViewerOpen(false); }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [viewerOpen]);

  // Blob URL: S3 원본 주소 은닉 → onLoad 시 즉시 파쇄
  useEffect(() => {
    if (!viewerOpen || !photos[viewerIndex]) { setBlobUrl(null); return; }
    const photo = photos[viewerIndex];
    const srcUrl = viewMode === "ai" && photo.aiUrl ? photo.aiUrl : photo.url;
    if (!srcUrl) { setBlobUrl(null); return; }

    viewerLoadedRef.current = false;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(srcUrl);
        if (cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setBlobUrl(url);
      } catch {
        if (!cancelled) setBlobUrl(srcUrl);
      }
    })();

    return () => { cancelled = true; };
  }, [viewerOpen, viewerIndex, viewMode, photos]);

  const handleViewerImageLoad = useCallback(() => {
    viewerLoadedRef.current = true;
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  // ━━━ 순서 기반 선택 ━━━
  const [selectedOrder, setSelectedOrder] = useState<(string | number)[]>([]);

  // ━━━ 스케줄 폴백 조회 ━━━
  const getFallbackScheduleId = useCallback(async (): Promise<number | null> => {
    console.log("[SCHEDULE_FALLBACK] 스케줄 폴백 조회 시작...");
    try {
      const res = await fetch("/api/backend/schedules");
      const data = await res.json();
      console.log("[SCHEDULE_FALLBACK] 응답:", JSON.stringify(data).substring(0, 300));
      if (data.success && data.latestScheduleId) {
        console.log(`[SCHEDULE_FALLBACK] 최신 scheduleId 확보: ${data.latestScheduleId}`);
        return Number(data.latestScheduleId);
      }
      console.warn("[SCHEDULE_FALLBACK] 폴백에서도 scheduleId를 찾지 못함");
      return null;
    } catch (e: any) {
      console.error("[SCHEDULE_FALLBACK] 에러:", e.message);
      return null;
    }
  }, []);

  // ━━━ 폴더 상세 정보 로드 (scheduleId 확보 + 폴백) ━━━
  useEffect(() => {
    if (status === "loading" || !session || !folderId) return;
    (async () => {
      try {
        console.log(`[FOLDER] 폴더 상세 조회 시작 — folderId: ${folderId}`);
        const res = await fetch(`/api/backend/folder-detail?folderId=${folderId}`);
        const data = await res.json();
        console.log("[FOLDER] 폴더 상세 응답:", JSON.stringify(data).substring(0, 500));

        if (data.success && data.folder) {
          setFolderDetail(data.folder);
          const sid = data.folder.scheduleId;
          console.log(`[FOLDER] 상세 로드 완료 — scheduleId: ${sid}, name: ${data.folder.name}, personCount: ${data.folder.personCount}`);

          if (sid) {
            setResolvedScheduleId(Number(sid));
            console.log(`[FOLDER] scheduleId 1차 확보 성공: ${sid}`);
          } else {
            console.warn("[FOLDER] scheduleId가 null — 스케줄 폴백 시도");
            const fallback = await getFallbackScheduleId();
            if (fallback) {
              setResolvedScheduleId(fallback);
              console.log(`[FOLDER] scheduleId 폴백 성공: ${fallback}`);
            } else {
              console.error("[FOLDER] scheduleId 확보 실패 — 1차(folder-detail)도 2차(schedules 폴백)도 실패");
              showError("일정 정보를 불러올 수 없습니다.\n잠시 후 다시 시도해주세요.", { showKakaoLink: true });
            }
          }
        } else {
          console.warn("[FOLDER] 폴더 상세 조회 자체 실패:", data.error);
          const fallback = await getFallbackScheduleId();
          if (fallback) setResolvedScheduleId(fallback);
        }
      } catch (e: any) {
        console.error("[FOLDER] 폴더 상세 에러:", e.message);
      }
    })();
  }, [status, session, folderId, getFallbackScheduleId]);

  // ━━━ 사진 로드 ━━━
  useEffect(() => {
    if (status === "loading" || !session) return;
    if (!folderId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/backend/folder-photos?folderId=${folderId}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.photos) && data.photos.length > 0) {
          setPhotos(data.photos.map((p: any) => ({
            ...p,
            id: p.id ?? p.photoId ?? p._id ?? `photo-${Math.random()}`,
            url: p.url || p.imageUrl || p.originalUrl || p.photoUrl || "",
            thumbnailUrl: p.thumbnailUrl || p.thumbUrl || p.thumbnailImageUrl || p.url || p.imageUrl || "",
            aiUrl: p.aiUrl || p.aiPhotoUrl || p.aiImageUrl || p.processedUrl || null,
          })));
        } else setPhotos([]);
      } catch { setPhotos([]); }
      finally { setLoading(false); }
    })();
  }, [status, session, folderId]);

  // ━━━ 선택 토글 ━━━
  const toggleSelect = (photoId: string | number) => {
    setSelectedOrder(prev =>
      prev.includes(photoId) ? prev.filter(id => id !== photoId) : [...prev, photoId]
    );
  };

  const getSelectionIndex = (photoId: string | number): number => {
    const idx = selectedOrder.indexOf(photoId);
    return idx >= 0 ? idx + 1 : 0;
  };

  // ━━━ 전체 선택 ━━━
  const toggleSelectAll = () => {
    if (selectedOrder.length === photos.length) setSelectedOrder([]);
    else setSelectedOrder(photos.map(p => p.id));
  };

  // ━━━ AI 보정 3단계 파이프라인 상태 ━━━
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrateStep, setMigrateStep] = useState("");
  const [migrateProgress, setMigrateProgress] = useState(0);
  const [migrateTotal, setMigrateTotal] = useState(0);
  const [migrateError, setMigrateError] = useState("");
  const [migrateDone, setMigrateDone] = useState(false);
  const [aiJobId, setAiJobId] = useState<number | null>(null);

  // ━━━ 다음: 2단계 (보정 옵션 선택) ━━━
  const goToNext = () => {
    const ids = selectedOrder.join(",");
    router.push(`/cheiz/folder/${folderId}/retoucher?photos=${ids}`);
  };

  // ━━━ AI 보정 버튼 클릭 → 확인 모달 표시 ━━━
  const onAiButtonClick = () => {
    console.log("[AI_BTN] 클릭됨 — 상태 점검:", {
      photosCount: photos.length,
      resolvedScheduleId,
      folderDetailExists: !!folderDetail,
      folderDetailScheduleId: folderDetail?.scheduleId,
      isMigrating,
    });

    if (photos.length === 0) {
      showAlert("사진이 없습니다. 폴더를 다시 확인해주세요.");
      return;
    }

    if (!resolvedScheduleId) {
      showError("일정 정보를 확인할 수 없습니다.\n잠시 후 다시 시도해주세요.", { showKakaoLink: true });
      return;
    }

    setShowConfirmModal(true);
  };

  // ━━━ AI 보정하기: 3단계 파이프라인 (모달 확인 후 실행) ━━━
  const handleAiMigration = async () => {
    setShowConfirmModal(false);

    if (isMigrating) return;

    // ━━━ scheduleId 최종 결정 (1차: folderDetail → 2차: 폴백) ━━━
    const realScheduleId = resolvedScheduleId;

    console.log("[AI_PIPE] === 파이프라인 시작 ===");
    console.log("[AI_PIPE] folderId:", folderId);
    console.log("[AI_PIPE] resolvedScheduleId:", realScheduleId);
    console.log("[AI_PIPE] folderDetail:", JSON.stringify(folderDetail));
    console.log("[AI_PIPE] 전체 사진 수:", photos.length);

    if (!realScheduleId) {
      const msg = `scheduleId를 확보할 수 없습니다.\nfolderId: ${folderId}\nfolderDetail: ${JSON.stringify(folderDetail)}`;
      setMigrateError(msg);
      console.error("[AI_PIPE] FATAL:", msg);
      showError("AI 보정에 실패했습니다.\n잠시 후 다시 시도해주세요.", { showKakaoLink: true });
      return;
    }

    setIsMigrating(true);
    setMigrateError("");
    setMigrateProgress(0);
    setMigrateDone(false);
    setAiJobId(null);

    // 전체 사진 사용 (개별 선택 무관 — 전체 보정)
    const allPhotosToProcess = photos;
    setMigrateTotal(allPhotosToProcess.length);

    console.log(`[AI_PIPE] 전체 ${allPhotosToProcess.length}장 보정 진행`);

    try {
      // ━━━ Step 1: AI 전용 폴더 생성 ━━━
      setMigrateStep("AI 폴더 생성 중...");

      const folderName = folderDetail?.name
        ? `[AI] ${folderDetail.name}`
        : `[AI] Folder_${realScheduleId}`;

      const hostUserId = folderDetail?.hostUserId || 0;

      console.log(`[AI_PIPE] Step 1: create-folder`);
      console.log(`[AI_PIPE]   scheduleId: ${realScheduleId}`);
      console.log(`[AI_PIPE]   name: ${folderName}`);
      console.log(`[AI_PIPE]   personCount: ${folderDetail?.personCount || 1}`);
      console.log(`[AI_PIPE]   hostUserId: ${hostUserId}`);
      console.log(`[AI_PIPE]   원본 folderId: ${folderId}`);

      const folderRes = await fetch("/api/backend/ai-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId: realScheduleId,
          name: folderName,
          personCount: folderDetail?.personCount || 1,
          hostUserId,
          sourceFolderId: Number(folderId),
        }),
      });

      const folderData = await folderRes.json();
      console.log("[AI_PIPE] Step 1 응답:", JSON.stringify(folderData).substring(0, 500));

      // 401 인증 만료 감지 → 즉시 중단 (버블 DB에 빈 데이터 쌓지 않음)
      if (folderData.code === "AUTH_EXPIRED" || folderRes.status === 401) {
        const authMsg = "인증이 만료되었습니다. 다시 로그인해주세요.";
        console.error("[AI_PIPE] Step 1 인증 만료:", authMsg);
        showError("인증이 만료되었습니다. 다시 로그인해주세요.");
        setIsMigrating(false);
        setMigrateStep("");
        router.replace("/auth/signin");
        return;
      }

      if (!folderData.success || !folderData.folderId) {
        const errMsg = folderData.error || "AI 폴더 생성 실패 (folderId 미수신)";
        console.error("[AI_PIPE] Step 1 실패:", errMsg);
        throw new Error(errMsg);
      }

      const aiFolderId = folderData.folderId;
      console.log(`[AI_PIPE] Step 1 성공 → aiFolderId: ${aiFolderId}`);

      // ━━━ Step 1.1: 상태 강제 리셋 → RESERVED (결제대기 잠금 해제) ━━━
      setMigrateStep("상태 초기화 중 (RESERVED)...");
      console.log(`[AI_PIPE] Step 1.1: PATCH 상태 → RESERVED 강제 설정 — aiFolderId: ${aiFolderId}`);

      // 먼저 현재 상태 확인
      let preStatus = "UNKNOWN";
      try {
        const detailRes = await fetch(`/api/backend/folder-detail?folderId=${aiFolderId}`);
        const detailData = await detailRes.json();
        preStatus = detailData.folder?.status || "UNKNOWN";
        console.log(`[AI_PIPE] Step 1.1 현재 상태 (변경 전): ${preStatus}`);
      } catch (e: any) {
        console.warn(`[AI_PIPE] Step 1.1 상태 조회 실패:`, e.message);
      }

      // RESERVED 강제 설정 (Query Parameter 방식)
      console.log(`[AI_PIPE] Step 1.1 PATCH 요청: folderId=${aiFolderId}, status=RESERVED`);

      const reservedRes = await fetch("/api/backend/folder-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: aiFolderId, status: "RESERVED" }),
      });
      const reservedData = await reservedRes.json();
      console.log("[AI_PIPE] Step 1.1 RESERVED PATCH 응답:", JSON.stringify(reservedData).substring(0, 500));

      if (!reservedData.success) {
        const httpStatus = reservedData.httpStatus || "?";
        const verdict = reservedData.verdict || "판정 불가";
        const serverMsg = reservedData.serverMessage || reservedData.error || "Unknown";
        const jwtRole = reservedData.jwtRole || "?";

        console.error(`[AI_PIPE] Step 1.1 RESERVED 전환 실패`);
        console.error(`[AI_PIPE]   HTTP: ${httpStatus}`);
        console.error(`[AI_PIPE]   판정: ${verdict}`);
        console.error(`[AI_PIPE]   서버 메시지: ${serverMsg}`);
        console.error(`[AI_PIPE]   JWT Role: ${jwtRole}`);
        console.error(`[AI_PIPE]   이전 상태: ${preStatus}`);

        const is403 = httpStatus === 403 || httpStatus === 401;
        showError(
          is403
            ? "권한이 부족합니다.\n관리자에게 문의해주세요."
            : "AI 보정 상태 변경에 실패했습니다.\n잠시 후 다시 시도해주세요.",
          { showKakaoLink: true }
        );
        throw new Error(
          `Step 1.1 실패 [HTTP ${httpStatus}] ${verdict} — ${serverMsg}`
        );
      }

      console.log(`[AI_PIPE] ✅ Step 1.1 성공: aiFolderId ${aiFolderId} → RESERVED (이전: ${preStatus})`);

      // 변경 후 재확인
      try {
        const verifyRes = await fetch(`/api/backend/folder-detail?folderId=${aiFolderId}`);
        const verifyData = await verifyRes.json();
        const postStatus = verifyData.folder?.status || "UNKNOWN";
        console.log(`[AI_PIPE] Step 1.1 상태 검증 (변경 후): ${postStatus}`);
        if (postStatus !== "RESERVED") {
          console.warn(`[AI_PIPE] Step 1.1 경고: 변경 후에도 ${postStatus} — RESERVED가 아님`);
        }
      } catch {
        console.warn("[AI_PIPE] Step 1.1 변경 후 검증 실패 (진행)");
      }

      // ━━━ Step 2: 사진 순차 전송 (재시도 포함) ━━━
      setMigrateStep("사진 전송 중...");
      const totalExpected = allPhotosToProcess.length;
      console.log(`[AI_PIPE] Step 2: ${totalExpected}장 전송 시작 → aiFolderId: ${aiFolderId}`);
      console.log(`[AI_PIPE] 카운트 매칭 기준: 원본 ${totalExpected}장 = AI 폴더 ${totalExpected}장`);

      let successCount = 0;
      let attemptedCount = 0;
      const MAX_RETRIES = 3;

      for (const photo of allPhotosToProcess) {
        attemptedCount++;
        const srcUrl = photo.url || photo.originalUrl || photo.imageUrl || "";
        let transferred = false;

        for (let retry = 0; retry <= MAX_RETRIES; retry++) {
          const tag = retry === 0
            ? `[${attemptedCount}/${totalExpected}]`
            : `[${attemptedCount}/${totalExpected}] (재시도 ${retry}/${MAX_RETRIES})`;

          console.log(`[AI_PIPE] Step 2 ${tag} photoId: ${photo.id}`);

          try {
            const res = await fetch("/api/backend/transfer-photo", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sourceOriginalUrl: srcUrl,
                sourceThumbnailUrl: photo.thumbnailUrl || "",
                targetFolderId: aiFolderId,
                photoId: photo.id,
              }),
            });
            const data = await res.json();

            if (data.success) {
              console.log(`[AI_PIPE] Step 2 OK ${tag} — uploadedId: ${data.uploadedId}`);
              transferred = true;
              break;
            } else {
              console.error(`[AI_PIPE] Step 2 실패 ${tag}:`, data.error);
            }
          } catch (e: any) {
            console.error(`[AI_PIPE] Step 2 에러 ${tag}:`, e.message);
          }

          if (retry < MAX_RETRIES) {
            const backoffMs = Math.pow(2, retry) * 1000;
            console.log(`[AI_PIPE] ${backoffMs}ms 후 재시도...`);
            await new Promise((r) => setTimeout(r, backoffMs));
          }
        }

        if (transferred) {
          successCount++;
        } else {
          console.error(`[AI_PIPE] FATAL — photoId ${photo.id}: ${MAX_RETRIES}회 재시도 후에도 전송 실패`);
          throw new Error(
            `사진 전송 실패 (photoId: ${photo.id}) — ${MAX_RETRIES}회 재시도 모두 실패\n` +
            `성공: ${successCount}/${totalExpected}, 실패 지점: ${attemptedCount}번째`
          );
        }

        setMigrateProgress(attemptedCount);
      }

      // ━━━ 카운트 매칭 최종 검증 ━━━
      console.log(`[AI_PIPE] Step 2 완료 — 성공: ${successCount}/${totalExpected}`);

      if (successCount !== totalExpected) {
        throw new Error(
          `카운트 불일치! 원본: ${totalExpected}장, 전송 성공: ${successCount}장\n` +
          `정확히 ${totalExpected}장이 필요합니다.`
        );
      }

      console.log(`[AI_PIPE] ✅ 카운트 매칭 확인: ${successCount} === ${totalExpected}`);

      // ━━━ Step 2.5: 수동 상태 변경 — RESERVED → PENDING ━━━
      setMigrateStep("상태 변경 중 (PENDING)...");
      console.log(`[AI_PIPE] Step 2.5: PATCH 상태 → PENDING — aiFolderId: ${aiFolderId}`);

      const pendingRes = await fetch("/api/backend/folder-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: aiFolderId, status: "PENDING" }),
      });
      const pendingData = await pendingRes.json();
      console.log("[AI_PIPE] Step 2.5 응답:", JSON.stringify(pendingData).substring(0, 500));

      if (!pendingData.success) {
        const httpSt = pendingData.httpStatus || "?";
        const verd = pendingData.verdict || "판정 불가";
        const srvMsg = pendingData.serverMessage || pendingData.error || "Unknown";
        console.error(`[AI_PIPE] Step 2.5 PENDING 전환 실패 [HTTP ${httpSt}] ${verd}: ${srvMsg}`);
        throw new Error(
          `PENDING 전환 실패 [HTTP ${httpSt}] ${verd}\n서버: ${srvMsg}\nfolderId: ${aiFolderId}, 전송: ${successCount}장`
        );
      }

      console.log(`[AI_PIPE] ✅ Step 2.5 성공: ${aiFolderId} → PENDING`);

      // ━━━ Step 3: AI 보정 Job 트리거 ━━━
      setMigrateStep("AI 보정 시작 중...");
      console.log(`[AI_PIPE] Step 3: trigger-ai — folderId: ${aiFolderId}`);

      const triggerRes = await fetch("/api/backend/ai-trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: aiFolderId }),
      });
      const triggerData = await triggerRes.json();
      console.log("[AI_PIPE] Step 3 응답:", JSON.stringify(triggerData).substring(0, 500));

      if (!triggerData.success) {
        const errDetail = triggerData.error || "AI 보정 트리거 실패";
        console.error(`[AI_PIPE] Step 3 실패: ${errDetail}`);
        throw new Error(`AI 보정 트리거 실패: ${errDetail}`);
      }

      const jobId = triggerData.jobId || null;
      console.log(`[AI_PIPE] ✅ Step 3 성공 → jobId: ${jobId}`);

      // ━━━ Step 4: 최종 상태 변경 — PENDING → COMPLETED ━━━
      setMigrateStep("최종 상태 변경 중...");
      console.log(`[AI_PIPE] Step 4: PATCH 상태 → COMPLETED — aiFolderId: ${aiFolderId}`);

      const completedRes = await fetch("/api/backend/folder-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: aiFolderId, status: "COMPLETED" }),
      });
      const completedData = await completedRes.json();
      console.log("[AI_PIPE] Step 4 응답:", JSON.stringify(completedData).substring(0, 500));

      if (!completedData.success) {
        const httpSt = completedData.httpStatus || "?";
        const verd = completedData.verdict || "판정 불가";
        const srvMsg = completedData.serverMessage || completedData.error || "Unknown";
        console.warn(`[AI_PIPE] Step 4 COMPLETED 전환 실패 (비치명적) [HTTP ${httpSt}] ${verd}: ${srvMsg}`);
      } else {
        console.log(`[AI_PIPE] ✅ Step 4 성공: ${aiFolderId} → COMPLETED`);
      }

      // ━━━ 파이프라인 완료 ━━━
      console.log("[AI_PIPE] ========================================");
      console.log(`[AI_PIPE] 파이프라인 완료 요약:`);
      console.log(`[AI_PIPE]   원본 폴더: ${folderId} (${totalExpected}장)`);
      console.log(`[AI_PIPE]   AI 폴더: ${aiFolderId}`);
      console.log(`[AI_PIPE]   전송: ${successCount}/${totalExpected} (카운트 매칭 OK)`);
      console.log(`[AI_PIPE]   상태: RESERVED → PENDING → COMPLETED`);
      console.log(`[AI_PIPE]   AI Job: ${jobId}`);
      console.log("[AI_PIPE] ========================================");

      setAiJobId(jobId);
      setMigrateDone(true);

      // ━━━ 파이프라인 완료 → 2초 후 my-tours로 이동 ━━━
      setTimeout(() => {
        router.push("/cheiz/my-tours");
      }, 2000);

    } catch (e: any) {
      console.error("[AI_PIPE] 파이프라인 에러:", e.message);
      setMigrateError(e.message);
    } finally {
      setIsMigrating(false);
      setMigrateStep("");
    }
  };

  // ━━━ 인증 가드 ━━━
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-3 border-[#0055FF] border-solid" />
      </div>
    );
  }
  if (!session) { router.replace("/auth/signin?callbackUrl=/cheiz/my-tours"); return null; }

  const currentPhoto = photos[viewerIndex];
  const isAllSelected = photos.length > 0 && selectedOrder.length === photos.length;

  // ━━━ AI 폴더 판별 ━━━
  const isAiFolder = folderDetail?.name?.startsWith("[AI]") ?? false;
  const hasAiPhotos = photos.some(p => !!p.aiUrl);
  const hideAiButton = isAiFolder || hasAiPhotos;

  return (
    <div className="min-h-screen bg-[#FAFAF8] pb-24">
      {/* ━━━ Header ━━━ */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-md mx-auto px-5 py-3 flex items-center justify-between">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-[#0055FF] text-sm flex items-center gap-1 active:scale-95 min-w-[48px]">
            <ArrowLeft className="w-4 h-4" /> 뒤로
          </button>
          <div className="text-center flex-1">
            <h1 className="text-base font-extrabold text-gray-900">사진 선택</h1>
            {selectedOrder.length > 0 && (
              <p className="text-xs text-[#0055FF] font-bold">{selectedOrder.length}장 선택됨</p>
            )}
          </div>
          <div className="min-w-[48px]" />
        </div>
      </div>

      {/* ━━━ 로딩 — 스켈레톤 그리드 ━━━ */}
      {loading && (
        <div className="px-5 pt-5">
          <div className="grid grid-cols-3 gap-1 animate-pulse">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="aspect-square bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      )}

      {/* ━━━ 사진 없음 ━━━ */}
      {!loading && photos.length === 0 && (
        <div className="max-w-md mx-auto px-5 pt-10 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <Eye className="w-8 h-8 text-gray-300" />
          </div>
          <h2 className="text-lg font-bold text-gray-700 mb-2">아직 사진이 없습니다</h2>
          <p className="text-sm text-gray-400">촬영이 완료되면 사진이 이곳에 업로드됩니다.</p>
        </div>
      )}

      {/* ━━━ 사진 그리드 ━━━ */}
      {!loading && photos.length > 0 && (
        <div className="max-w-md mx-auto px-5 pt-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-400">{selectedOrder.length} / {photos.length}장</p>
            <button onClick={toggleSelectAll}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95 ${
                isAllSelected ? "bg-[#0055FF] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
              <CheckCheck className="w-3.5 h-3.5" />
              {isAllSelected ? "전체 해제" : "모두 선택"}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo, idx) => {
              const selIndex = getSelectionIndex(photo.id);
              const isSelected = selIndex > 0;
              return (
                <motion.div key={photo.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.02 }}
                  className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 cursor-pointer"
                  onClick={() => openViewer(idx)}>
                  <SecureImage
                    src={photo.aiUrl || photo.thumbnailUrl || photo.url}
                    className="w-full h-full object-cover select-none"
                    watermark={true} />

                  {isSelected && <div className="absolute inset-0 bg-[#0055FF]/20 pointer-events-none z-[5]" />}

                  <button onClick={(e) => { e.stopPropagation(); toggleSelect(photo.id); }}
                    className="absolute top-1 right-1 w-9 h-9 flex items-center justify-center z-10">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold transition-all ${
                      isSelected ? "bg-[#0055FF] text-white shadow-lg scale-110 ring-2 ring-white" : "bg-white/80 text-gray-400 border border-gray-300"
                    }`}>
                      {isSelected ? selIndex : ""}
                    </div>
                  </button>

                  {photo.aiUrl && (
                    <div className="absolute bottom-2 left-2 bg-purple-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 z-[6]">
                      <Sparkles className="w-2.5 h-2.5" /> AI
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ━━━ 하단 바 ━━━ */}
      <AnimatePresence>
        {photos.length > 0 && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
            className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 pb-[env(safe-area-inset-bottom)]">
            <div className="max-w-md mx-auto px-5 py-3 space-y-2">

              {/* 다운로드 안내 (AI 보정 사진이 있는 경우) */}
              {photos.some(p => p.aiUrl) && selectedOrder.length > 0 && (
                <div className="flex items-center gap-1.5 bg-purple-50 rounded-lg px-3 py-1.5 mb-1">
                  <Info className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                  <p className="text-[11px] text-purple-700 font-medium">
                    원본과 AI 보정 사진이 각각 1장씩, 총 {selectedOrder.length * 2}장이 다운로드됩니다
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                {hideAiButton ? (
                  hasAiPhotos && !isAiFolder && (
                    <div className="flex-1 h-12 bg-green-50 border border-green-200 text-green-700 text-sm font-bold rounded-xl flex items-center justify-center gap-1.5">
                      <CheckCheck className="w-4 h-4" /> 보정 완료
                    </div>
                  )
                ) : (
                  <button onClick={onAiButtonClick}
                    disabled={isMigrating || photos.length === 0}
                    className="flex-1 h-12 bg-gradient-to-r from-purple-600 to-pink-500 text-white text-sm font-bold rounded-xl disabled:opacity-40 active:scale-[0.97] transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-purple-500/20">
                    {isMigrating ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> 전송 중...</>
                    ) : (
                      <><Wand2 className="w-4 h-4" /> AI 보정하기</>
                    )}
                  </button>
                )}

                <button onClick={goToNext}
                  disabled={selectedOrder.length === 0 || isMigrating}
                  className={`${hideAiButton ? "flex-[2]" : "flex-1"} h-12 bg-[#0055FF] text-white text-sm font-bold rounded-xl disabled:opacity-40 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/20`}>
                  <Download className="w-4 h-4" />
                  {selectedOrder.length > 0
                    ? `${selectedOrder.length}장 다음`
                    : "사진 선택"}
                  {selectedOrder.length > 0 && <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ━━━ 전체 화면 AI 보정 오버레이 ━━━ */}
      <AnimatePresence>
        {(isMigrating || migrateDone) && !migrateError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="max-w-sm w-full mx-6 text-center"
            >
              {/* 아이콘 */}
              <motion.div
                animate={migrateDone ? { scale: [1, 1.2, 1] } : { rotate: 360 }}
                transition={migrateDone ? { duration: 0.5 } : { duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
                style={{ background: migrateDone ? "linear-gradient(135deg, #22c55e, #16a34a)" : "linear-gradient(135deg, #9333ea, #ec4899)" }}
              >
                {migrateDone ? (
                  <CheckCheck className="w-10 h-10 text-white" />
                ) : (
                  <Wand2 className="w-10 h-10 text-white" />
                )}
              </motion.div>

              {/* 제목 */}
              <h2 className="text-xl font-bold text-white mb-2">
                {migrateDone ? "AI 보정 요청 완료!" : "AI가 사진을 분석하고 보정을 준비 중입니다..."}
              </h2>

              {/* 서브 텍스트 */}
              <p className="text-white/60 text-sm mb-6">
                {migrateDone
                  ? `${migrateTotal}장이 AI 보정 대기열에 등록되었습니다. 잠시 후 이동합니다...`
                  : migrateStep || "잠시만 기다려주세요..."}
              </p>

              {/* 프로그레스 바 */}
              {!migrateDone && migrateTotal > 0 && (
                <div className="mx-auto max-w-[280px]">
                  <div className="flex justify-between text-xs text-white/50 mb-2">
                    <span>진행률</span>
                    <span className="font-bold text-white/80">
                      {migrateProgress} / {migrateTotal}장 ({Math.round((migrateProgress / migrateTotal) * 100)}%)
                    </span>
                  </div>
                  <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: "linear-gradient(90deg, #9333ea, #ec4899, #f59e0b)" }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(migrateProgress / migrateTotal) * 100}%` }}
                      transition={{ ease: "easeOut", duration: 0.4 }}
                    />
                  </div>
                </div>
              )}

              {/* 스피너 (전송 전 단계) */}
              {!migrateDone && migrateTotal === 0 && (
                <div className="flex justify-center">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                </div>
              )}

              {/* 완료 후 Job ID */}
              {migrateDone && aiJobId && (
                <p className="text-white/30 text-xs mt-4 font-mono">
                  Job #{aiJobId}
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ━━━ AI 보정 에러 오버레이 ━━━ */}
      <AnimatePresence>
        {migrateError && !isMigrating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="max-w-sm w-full mx-6 text-center"
            >
              <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-lg font-bold text-white mb-2">AI 보정 중 오류 발생</h2>
              <p className="text-white/60 text-sm mb-6 break-words px-4">
                AI 보정 요청 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.
              </p>
              <button
                onClick={() => { setMigrateError(""); setMigrateDone(false); }}
                className="px-8 py-3 bg-white text-gray-900 rounded-xl font-bold text-sm active:scale-95 transition-all"
              >
                닫기
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ━━━ 확인 모달: 전체 보정 안내 ━━━ */}
      <AnimatePresence>
        {showConfirmModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] flex items-center justify-center px-6"
            onClick={() => setShowConfirmModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}>
              {/* 헤더 */}
              <div className="bg-gradient-to-r from-purple-600 to-pink-500 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Wand2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-base">AI 보정 실행</p>
                    <p className="text-white/70 text-xs">전체 사진 자동 보정</p>
                  </div>
                </div>
              </div>

              {/* 내용 */}
              <div className="px-5 py-4 space-y-3">
                <div className="bg-purple-50 rounded-xl p-3 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      현재 폴더 내 모든 사진({photos.length}장)을 보정합니다.
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      예상 소요 시간: 약 {Math.max(1, Math.ceil(photos.length * 0.05))}분
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 text-[11px] text-gray-400">
                  <p className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    1. AI 전용 폴더 생성
                  </p>
                  <p className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    1.1. 상태 초기화 (RESERVED 강제 설정)
                  </p>
                  <p className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    2. {photos.length}장 전체 전송 (실패 시 자동 재시도 3회)
                  </p>
                  <p className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    3. 카운트 매칭 후 PENDING → AI 트리거 → COMPLETED
                  </p>
                  <p className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    원본 사진은 그대로 유지됩니다
                  </p>
                </div>

                {/* 디버그 정보 */}
                <div className="bg-gray-50 rounded-lg p-2 text-[9px] text-gray-400 font-mono">
                  folderId: {folderId} | scheduleId: {resolvedScheduleId ?? "null"} | photos: {photos.length}
                </div>
              </div>

              {/* 버튼 */}
              <div className="px-5 pb-5 flex gap-2">
                <button onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium active:scale-[0.97] transition-all">
                  취소
                </button>
                <button onClick={handleAiMigration}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white text-sm font-bold active:scale-[0.97] transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-1.5">
                  <Wand2 className="w-4 h-4" /> 보정 시작
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ━━━ 상세 뷰어 (양방향 슬라이드 + 워터마크 + 저장 방지) ━━━ */}
      <AnimatePresence>
        {viewerOpen && currentPhoto && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-[100] flex flex-col"
            onContextMenu={(e) => e.preventDefault()}
            style={{ touchAction: "pan-y", WebkitTouchCallout: "none" } as React.CSSProperties}>

            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 pt-[env(safe-area-inset-top)] py-3 relative z-10">
              <button onClick={() => window.history.back()} className="p-2 rounded-xl bg-white/10 active:scale-95">
                <X className="w-5 h-5 text-white" />
              </button>
              <p className="text-white/60 text-sm font-medium">{viewerIndex + 1} / {photos.length}</p>
              <button
                onClick={(e) => { e.stopPropagation(); toggleSelect(currentPhoto.id); }}
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-extrabold transition-all active:scale-90 ${
                  getSelectionIndex(currentPhoto.id) > 0 ? "bg-[#0055FF] text-white ring-2 ring-white/50" : "bg-white/10 text-white/40 border border-white/20"
                }`}>
                {getSelectionIndex(currentPhoto.id) || ""}
              </button>
            </div>

            {/* 스와이프 + 양방향 슬라이드 이미지 영역 */}
            <div className="flex-1 relative overflow-hidden"
              onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
              onTouchEnd={(e) => {
                const dx = e.changedTouches[0].clientX - touchStartX.current;
                if (dx < -60) viewerGoNext();
                else if (dx > 60) viewerGoPrev();
              }}>

              <AnimatePresence initial={false} custom={slideDir} mode="wait">
                <motion.div
                  key={`${viewerIndex}-${viewMode}`}
                  custom={slideDir}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="absolute inset-0 flex items-center justify-center px-4"
                  style={{ WebkitUserSelect: "none", userSelect: "none" } as React.CSSProperties}
                  onClick={() => toggleSelect(currentPhoto.id)}>

                  {/* 이미지 + 워터마크 + 방패를 하나의 래퍼로 — 사진 크기에만 한정 */}
                  <div className="relative inline-block max-w-full max-h-full">
                    {/* 이미지 (Blob URL → onLoad 즉시 파쇄) */}
                    {blobUrl ? (
                      <img src={blobUrl} alt="" draggable={false}
                        onLoad={handleViewerImageLoad}
                        className="max-w-full max-h-[75vh] object-contain rounded-lg block"
                        style={{ pointerEvents: "none", WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" } as React.CSSProperties} />
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center">
                        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      </div>
                    )}

                    {/* 1단계: SVG 워터마크 — 사진 영역 내부에만 한정 */}
                    {blobUrl && (
                      <div className="absolute inset-0 pointer-events-none z-[2] rounded-lg overflow-hidden">
                        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                          <defs>
                            <pattern id="cheiz-wm" width="280" height="260" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
                              <text x="15" y="70" fill="white" fillOpacity="0.35" fontSize="34" fontWeight="700" fontFamily="system-ui, sans-serif">Cheiz</text>
                              <text x="140" y="190" fill="white" fillOpacity="0.3" fontSize="28" fontWeight="600" fontFamily="system-ui, sans-serif">Cheiz</text>
                            </pattern>
                          </defs>
                          <rect width="100%" height="100%" fill="url(#cheiz-wm)" />
                        </svg>
                      </div>
                    )}

                    {/* 2단계: 투명 방패 — 사진 영역 내부에만 한정 */}
                    <div className="absolute inset-0 z-[3] rounded-lg"
                      onContextMenu={(e) => e.preventDefault()}
                      style={{ WebkitTouchCallout: "none" } as React.CSSProperties} />
                  </div>

                  {/* 선택 시 반투명 오버레이 (전체 화면) */}
                  <AnimatePresence>
                    {getSelectionIndex(currentPhoto.id) > 0 && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/40 pointer-events-none flex items-center justify-center z-[4]">
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          className="bg-[#0055FF] rounded-full w-20 h-20 flex items-center justify-center shadow-2xl">
                          <span className="text-white text-3xl font-extrabold">{getSelectionIndex(currentPhoto.id)}</span>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* AI/원본 토글 스위치 */}
            {(currentPhoto.aiUrl || isAiFolder) && (
              <div className="px-5 pb-[env(safe-area-inset-bottom)] py-4">
                <div className="flex items-center justify-center gap-3">
                  <span className={`text-sm font-medium transition-all ${viewMode === "original" ? "text-white" : "text-white/40"}`}>
                    원본
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewMode(prev => prev === "ai" ? "original" : "ai");
                    }}
                    className="relative w-16 h-8 rounded-full transition-all duration-300 active:scale-95"
                    style={{ backgroundColor: viewMode === "ai" ? "#9333ea" : "#4b5563" }}>
                    <div
                      className="absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 flex items-center justify-center"
                      style={{ left: viewMode === "ai" ? "calc(100% - 28px)" : "4px" }}>
                      {viewMode === "ai" ? <Sparkles className="w-3.5 h-3.5 text-purple-600" /> : <Eye className="w-3.5 h-3.5 text-gray-500" />}
                    </div>
                  </button>
                  <span className={`text-sm font-medium transition-all flex items-center gap-1 ${viewMode === "ai" ? "text-purple-300" : "text-white/40"}`}>
                    <Sparkles className="w-3.5 h-3.5" /> AI 보정
                  </span>
                </div>
                {viewMode === "ai" && !currentPhoto.aiUrl && (
                  <p className="text-center text-white/40 text-xs mt-2">아직 AI 보정이 완료되지 않았습니다</p>
                )}
              </div>
            )}

            {/* 좌우 버튼 (데스크톱용) */}
            {viewerIndex > 0 && (
              <button onClick={(e) => { e.stopPropagation(); viewerGoPrev(); }}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-3 bg-white/10 rounded-full active:scale-95 z-10 hidden sm:flex">
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
            )}
            {viewerIndex < photos.length - 1 && (
              <button onClick={(e) => { e.stopPropagation(); viewerGoNext(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-white/10 rounded-full active:scale-95 rotate-180 z-10 hidden sm:flex">
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
