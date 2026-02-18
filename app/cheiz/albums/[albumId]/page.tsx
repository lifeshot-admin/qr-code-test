"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Download, Loader2, Camera, X,
  ChevronLeft, ChevronRight, ZoomIn,
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

export default function AlbumDetailPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const albumId = params?.albumId as string;

  const [photos, setPhotos] = useState<AlbumPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [albumName, setAlbumName] = useState("");
  const [showDownloader, setShowDownloader] = useState(false);
  const [activeTab, setActiveTab] = useState<"ALL" | "DETAIL" | "RAW">("ALL");
  const [hasDetail, setHasDetail] = useState(false);

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

  // 사진 로드 — activeTab 변경 시 재호출
  useEffect(() => {
    if (!albumId) return;
    setLoading(true);

    (async () => {
      try {
        const res = await fetch(`/api/backend/albums/${albumId}/photos?photoType=${activeTab}&size=200`);
        const data = await res.json();
        console.log(`[ALBUM_DETAIL] 응답 (${activeTab}):`, JSON.stringify(data).substring(0, 600));

        if (data.success && Array.isArray(data.photos)) {
          setPhotos(mapPhotos(data.photos));
          console.log(`[ALBUM_DETAIL] ✅ ${activeTab} 사진:`, data.photos.length, "장");
        } else {
          console.warn("[ALBUM_DETAIL] ⚠️ photos 없음:", JSON.stringify(data).substring(0, 300));
          setPhotos([]);
        }
      } catch (e: any) {
        console.error("[ALBUM_DETAIL] 로드 실패:", e.message);
        setPhotos([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [albumId, activeTab]);

  // 리터치 사진 유무 확인 (탭 표시/숨김 결정) — 최초 1회
  useEffect(() => {
    if (!albumId) return;
    (async () => {
      try {
        const res = await fetch(`/api/backend/albums/${albumId}/photos?photoType=DETAIL&page=1&size=1`);
        const data = await res.json();
        setHasDetail(data.success && Array.isArray(data.photos) && data.photos.length > 0);
      } catch {
        setHasDetail(false);
      }
    })();
  }, [albumId]);

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
    if (viewerIdx === null || viewerIdx >= photos.length - 1) return;
    setSlideDir(1);
    setViewerIdx(viewerIdx + 1);
  }, [viewerIdx, photos.length]);

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
          <span className="text-[11px] text-gray-400">{photos.length}장</span>
        </div>
      </div>

      {/* 사진 타입 탭: [전체] [리터치] [원본] — 리터치 없으면 숨김 */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-md mx-auto px-5 flex gap-1 py-2">
          {([
            { key: "ALL" as const, label: "전체" },
            ...(hasDetail ? [{ key: "DETAIL" as const, label: "리터치" }] : []),
            { key: "RAW" as const, label: "원본" },
          ]).map(({ key, label }) => {
            const isActive = activeTab === key;
            return (
              <button key={key} onClick={() => setActiveTab(key)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-[#0055FF] text-white shadow-sm"
                    : "bg-gray-50 text-gray-400 active:bg-gray-100"
                }`}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Photo Grid */}
      <div className="max-w-md mx-auto px-3 pt-3">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-[#0055FF] animate-spin" />
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-16">
            <Camera className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">
              {activeTab === "ALL" ? "아직 사진이 없습니다" : activeTab === "DETAIL" ? "리터치 사진이 없습니다" : "원본 사진이 없습니다"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {photos.map((photo, idx) => (
              <motion.button key={photo.id}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.02 }}
                onClick={() => openViewer(idx)}
                className="aspect-square rounded-lg overflow-hidden bg-gray-100 relative active:scale-[0.97] transition-transform">
                <SecureImage
                  src={photo.thumbnailUrl || photo.albumPhotoUrl}
                  className="w-full h-full object-cover"
                  watermark={false}
                />
                {photo.photoType === "DETAIL" && (
                  <span className="absolute top-1 left-1 bg-black/50 text-white text-[8px] px-1.5 py-0.5 rounded-full font-medium">
                    리터치
                  </span>
                )}
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* 하단 다운로드 버튼 */}
      {photos.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 pb-[env(safe-area-inset-bottom)]">
          <div className="max-w-md mx-auto px-5 py-3">
            <button onClick={() => setShowDownloader(true)}
              className="w-full h-12 bg-[#0055FF] text-white text-sm font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20">
              <Download className="w-4 h-4" /> 모든 사진 다운로드 ({photos.length}장)
            </button>
          </div>
        </div>
      )}

      {/* 다운로드 모달 */}
      {showDownloader && (
        <AlbumDownloader
          photos={photos.map(p => ({
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
        {viewerIdx !== null && photos[viewerIdx] && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black flex flex-col"
          >
            {/* 상단바 */}
            <div className="flex items-center justify-between px-4 py-3 text-white z-10">
              <button onClick={closeViewer} className="p-1 active:scale-90"><X className="w-6 h-6" /></button>
              <span className="text-sm font-medium">{viewerIdx + 1} / {photos.length}</span>
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
                      src={photos[viewerIdx].albumPhotoUrl}
                      alt=""
                      className="max-w-full max-h-[80vh] object-contain select-none"
                      draggable={false}
                      style={{ WebkitTouchCallout: "none", userSelect: "none" }}
                    />
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
              {viewerIdx < photos.length - 1 && (
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
