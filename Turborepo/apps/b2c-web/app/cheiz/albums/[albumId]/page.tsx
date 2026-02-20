"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Download, Loader2, Camera, X,
  ChevronLeft, ChevronRight, Sparkles, Gift,
} from "lucide-react";
import SecureImage from "@/components/SecureImage";
import AlbumDownloader from "@/components/AlbumDownloader";

type AlbumPhoto = {
  id: string;
  albumPhotoUrl: string;
  albumPhotoDownloadUrl: string;
  photoType: string;
  thumbnailUrl: string;
};

type TabKey = "ALL" | "RETOUCH" | "RAW" | "EVENT";

export default function AlbumDetailPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const albumId = params?.albumId as string;

  const [allPhotos, setAllPhotos] = useState<AlbumPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [albumName, setAlbumName] = useState("");
  const [showDownloader, setShowDownloader] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("ALL");

  // 이벤트(리뷰 보정본) 탭 데이터
  const [eventImages, setEventImages] = useState<string[]>([]);
  const [hasEventTab, setHasEventTab] = useState(false);

  // 뷰어
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);
  const [slideDir, setSlideDir] = useState(0);

  const nickname = (session?.user as any)?.nickname || (session?.user as any)?.name || "";

  const mapPhotos = (raw: any[]): AlbumPhoto[] =>
    raw.map((p: any) => ({
      id: String(p.id || p.albumPhotoId || p.photoId),
      albumPhotoUrl: p.albumPhotoUrl || p.url || p.imageUrl || "",
      albumPhotoDownloadUrl: p.albumPhotoDownloadUrl || p.downloadUrl || p.albumPhotoUrl || p.url || "",
      photoType: p.photoType || "RAW",
      thumbnailUrl: p.thumbnailUrl || p.albumPhotoUrl || p.url || "",
    }));

  // 전체 사진 1회 fetch (COLOR 제외)
  useEffect(() => {
    if (!albumId) return;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/backend/albums/${albumId}/photos?photoType=ALL&size=200`);
        const data = await res.json();
        if (data.success && Array.isArray(data.photos)) {
          const mapped = mapPhotos(data.photos).filter(p => p.photoType !== "COLOR");
          setAllPhotos(mapped);
        } else {
          setAllPhotos([]);
        }
      } catch {
        setAllPhotos([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [albumId]);

  // 이벤트 탭 데이터: Bubble 리뷰 보정본 조회
  useEffect(() => {
    if (!albumId) return;
    (async () => {
      try {
        const res = await fetch(`/api/bubble/review?album_Id=${albumId}`);
        const data = await res.json();
        const reviews = data.reviews || [];
        const completed = reviews.find(
          (r: any) => r.color_grade_status === "completed" && Array.isArray(r.corrected_images) && r.corrected_images.length > 0
        );
        if (completed) {
          setEventImages(completed.corrected_images);
          setHasEventTab(true);
        }
      } catch {}
    })();
  }, [albumId]);

  // 클라이언트 필터링
  const hasRetouch = useMemo(
    () => allPhotos.some(p => p.photoType === "DETAIL" || p.photoType === "VERIFICATION"),
    [allPhotos]
  );

  const filteredPhotos = useMemo(() => {
    switch (activeTab) {
      case "RAW":
        return allPhotos.filter(p => p.photoType === "RAW");
      case "RETOUCH":
        return allPhotos.filter(p => p.photoType === "DETAIL" || p.photoType === "VERIFICATION");
      case "ALL":
      default:
        return allPhotos;
    }
  }, [allPhotos, activeTab]);

  // 앨범 정보 (이름) — 최초 1회
  useEffect(() => {
    if (!albumId) return;
    (async () => {
      try {
        const res = await fetch("/api/backend/albums");
        const data = await res.json();
        if (data.success && Array.isArray(data.albums)) {
          const found = data.albums.find((a: any) => String(a.id || a.albumId) === albumId);
          if (found) setAlbumName(found.name || found.albumName || "앨범");
        }
      } catch {}
    })();
  }, [albumId]);

  const openViewer = useCallback((idx: number) => {
    setViewerIdx(idx);
    history.pushState({ viewer: true }, "");
  }, []);

  const closeViewer = useCallback(() => setViewerIdx(null), []);

  const goNext = useCallback(() => {
    if (viewerIdx === null || viewerIdx >= filteredPhotos.length - 1) return;
    setSlideDir(1);
    setViewerIdx(viewerIdx + 1);
  }, [viewerIdx, filteredPhotos.length]);

  const goPrev = useCallback(() => {
    if (viewerIdx === null || viewerIdx <= 0) return;
    setSlideDir(-1);
    setViewerIdx(viewerIdx - 1);
  }, [viewerIdx]);

  useEffect(() => {
    const handler = () => {
      if (viewerIdx !== null) setViewerIdx(null);
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [viewerIdx]);

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
  };

  const displayPhotos = activeTab === "EVENT" ? [] : filteredPhotos;
  const displayCount = activeTab === "EVENT" ? eventImages.length : displayPhotos.length;

  return (
    <div className="min-h-screen bg-[#FAFAF8] pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-md mx-auto px-5 py-3 flex items-center justify-between">
          <button onClick={() => router.push("/cheiz/albums")}
            className="text-gray-500 text-sm flex items-center gap-1 active:scale-95">
            <ArrowLeft className="w-4 h-4" /> 뒤로
          </button>
          <h1 className="text-sm font-bold text-gray-900 truncate max-w-[200px]">
            {albumName || `앨범 #${albumId}`}
          </h1>
          <span className="text-[11px] text-gray-400">{displayCount}장</span>
        </div>
      </div>

      {/* 탭: [전체] [리터치?] [원본] [이벤트?] */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-md mx-auto px-5 flex gap-1 py-2">
          {([
            { key: "ALL" as TabKey, label: "전체" },
            ...(hasRetouch ? [{ key: "RETOUCH" as TabKey, label: "리터치" }] : []),
            { key: "RAW" as TabKey, label: "원본" },
            ...(hasEventTab ? [{ key: "EVENT" as TabKey, label: "이벤트" }] : []),
          ]).map(({ key, label }) => {
            const isActive = activeTab === key;
            const isEvent = key === "EVENT";
            return (
              <button key={key} onClick={() => setActiveTab(key)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                  isActive
                    ? isEvent ? "bg-purple-600 text-white shadow-sm" : "bg-cheiz-primary text-white shadow-sm"
                    : "bg-gray-50 text-gray-400 active:bg-gray-100"
                }`}>
                {isEvent && <Gift className="w-3 h-3" />}
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 이벤트 탭 콘텐츠 */}
      {activeTab === "EVENT" && (
        <div className="max-w-md mx-auto px-3 pt-3">
          {eventImages.length === 0 ? (
            <div className="text-center py-16">
              <Gift className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400">아직 이벤트 보정본이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-3 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <Gift className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-purple-900">리뷰 보너스 보정본</p>
                  <p className="text-[10px] text-purple-500">리뷰 작성 감사 이벤트로 제공된 사진입니다</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {eventImages.map((url, idx) => (
                  <div key={idx} className="relative rounded-xl overflow-hidden bg-gray-100 shadow-sm">
                    <img src={url} alt={`보정본 ${idx + 1}`} className="w-full object-cover" style={{ minHeight: 180 }} />
                    <div className="absolute top-2 left-2 bg-purple-600/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" /> 보정 완료
                    </div>
                    <a href={url} download target="_blank" rel="noopener noreferrer"
                      className="absolute bottom-2 right-2 flex items-center gap-1 bg-white/90 backdrop-blur-sm text-gray-800 text-[10px] font-medium px-2.5 py-1.5 rounded-lg shadow-sm active:scale-95 transition-transform">
                      <Download className="w-3 h-3" /> 다운로드
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Photo Grid (전체 / 리터치 / 원본) */}
      {activeTab !== "EVENT" && (
        <div className="max-w-md mx-auto px-3 pt-3">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-cheiz-primary animate-spin" />
            </div>
          ) : displayPhotos.length === 0 ? (
            <div className="text-center py-16">
              <Camera className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400">
                {activeTab === "ALL" ? "아직 사진이 없습니다" : activeTab === "RETOUCH" ? "리터치 사진이 없습니다" : "원본 사진이 없습니다"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {displayPhotos.map((photo, idx) => (
                <motion.button key={photo.id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.02 }}
                  onClick={() => openViewer(idx)}
                  className="aspect-square rounded-lg overflow-hidden bg-gray-100 relative active:scale-[0.97] transition-transform">
                  <SecureImage
                    src={`/api/download?url=${encodeURIComponent(photo.thumbnailUrl || photo.albumPhotoUrl)}`}
                    className="w-full h-full object-cover"
                    watermark={false}
                  />
                  {photo.photoType === "DETAIL" && (
                    <span className="absolute top-1 left-1 bg-black/50 text-white text-[8px] px-1.5 py-0.5 rounded-full font-medium">
                      리터치
                    </span>
                  )}
                  {photo.photoType === "VERIFICATION" && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="text-center">
                        <Loader2 className="w-5 h-5 text-white/80 animate-spin mx-auto mb-1" />
                        <span className="text-[9px] text-white/90 font-medium">디테일 보정 중</span>
                      </div>
                    </div>
                  )}
                </motion.button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 하단 다운로드 버튼 (이벤트 탭에서는 숨김) */}
      {activeTab !== "EVENT" && displayPhotos.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 pb-[env(safe-area-inset-bottom)]">
          <div className="max-w-md mx-auto px-5 py-3">
            <button onClick={() => setShowDownloader(true)}
              className="w-full h-12 bg-cheiz-primary text-white text-sm font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-cheiz-primary/20">
              <Download className="w-4 h-4" /> 모든 사진 다운로드 ({displayPhotos.length}장)
            </button>
          </div>
        </div>
      )}

      {/* 다운로드 모달 */}
      {showDownloader && (
        <AlbumDownloader
          photos={displayPhotos.map(p => ({
            id: p.id,
            url: p.albumPhotoDownloadUrl || p.albumPhotoUrl,
          }))}
          locationName={albumName}
          nickname={nickname}
          onClose={() => setShowDownloader(false)}
        />
      )}

      {/* 사진 뷰어 */}
      <AnimatePresence>
        {viewerIdx !== null && displayPhotos[viewerIdx] && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black flex flex-col"
          >
            {/* 상단바 */}
            <div className="flex items-center justify-between px-4 py-3 text-white z-10">
              <button onClick={closeViewer} className="p-1 active:scale-90"><X className="w-6 h-6" /></button>
              <span className="text-sm font-medium">{viewerIdx + 1} / {displayPhotos.length}</span>
              <div className="w-8" />
            </div>

            {/* 이미지 */}
            <div className="flex-1 relative overflow-hidden flex items-center justify-center">
              <AnimatePresence initial={false} custom={slideDir} mode="wait">
                <motion.div
                  key={viewerIdx}
                  custom={slideDir}
                  variants={slideVariants}
                  initial="enter" animate="center" exit="exit"
                  transition={{ duration: 0.25 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <div className="relative inline-block max-w-full max-h-full overflow-hidden">
                    <img
                      src={`/api/download?url=${encodeURIComponent(displayPhotos[viewerIdx].albumPhotoUrl)}`}
                      alt=""
                      className="max-w-full max-h-[80vh] object-contain select-none"
                      draggable={false}
                      style={{ WebkitTouchCallout: "none", userSelect: "none" }}
                    />
                    {displayPhotos[viewerIdx].photoType === "VERIFICATION" && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="text-center">
                          <Loader2 className="w-6 h-6 text-white/80 animate-spin mx-auto mb-1.5" />
                          <span className="text-xs text-white/90 font-medium">디테일 보정 중</span>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* 좌우 이동 */}
              {viewerIdx > 0 && (
                <button onClick={goPrev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center active:scale-90 z-10">
                  <ChevronLeft className="w-6 h-6 text-white" />
                </button>
              )}
              {viewerIdx < displayPhotos.length - 1 && (
                <button onClick={goNext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center active:scale-90 z-10">
                  <ChevronRight className="w-6 h-6 text-white" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
