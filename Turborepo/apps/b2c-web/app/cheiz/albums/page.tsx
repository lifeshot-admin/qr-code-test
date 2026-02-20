"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft, Image, Download, Camera, Loader2,
  Calendar, MapPin, FolderOpen, Clock, CheckCircle2, PenLine,
} from "lucide-react";
import SecureImage from "@/components/SecureImage";

type Album = {
  id: number | string;
  name: string;
  albumStatus: string;
  thumbnailUrl: string;
  downloadableDate: string;
  photoCount: number;
  location: string;
};

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  CHECKING: { label: "확인 중", color: "text-amber-600 bg-amber-50", icon: Clock },
  PROCESSING: { label: "처리 중", color: "text-cheiz-primary bg-cheiz-surface", icon: Loader2 },
  COMPLETED: { label: "완료", color: "text-emerald-600 bg-emerald-50", icon: CheckCircle2 },
  DOWNLOADABLE: { label: "다운로드 가능", color: "text-emerald-600 bg-emerald-50", icon: Download },
};

export default function AlbumsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewedAlbumIds, setReviewedAlbumIds] = useState<Set<string | number>>(new Set());

  useEffect(() => {
    if (status === "loading") return;

    (async () => {
      try {
        const res = await fetch("/api/backend/albums");
        const data = await res.json();
        console.log("[ALBUMS_PAGE] 응답:", JSON.stringify(data).substring(0, 500));

        if (data.success && Array.isArray(data.albums)) {
          const mapped: Album[] = data.albums.map((a: any) => ({
            id: a.id || a.albumId,
            name: a.name || a.albumName || "앨범",
            albumStatus: a.albumStatus || a.status || "CHECKING",
            thumbnailUrl: a.thumbnailUrl || a.coverUrl || "",
            downloadableDate: a.downloadableDate || a.completedAt || a.createdAt || "",
            photoCount: a.photoCount || a.totalPhotos || 0,
            location: a.location || a.spot || "",
          }));
          setAlbums(mapped);

          const reviewed = new Set<string | number>();
          await Promise.all(
            mapped.map(async (album) => {
              try {
                const reviewRes = await fetch(`/api/bubble/review?album_Id=${album.id}`);
                const reviewData = await reviewRes.json();
                if (reviewData.count > 0) reviewed.add(album.id);
              } catch {}
            }),
          );
          setReviewedAlbumIds(reviewed);
        }
      } catch (e: any) {
        console.error("[ALBUMS_PAGE] 로드 실패:", e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [status]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cheiz-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-md mx-auto px-5 py-3 flex items-center justify-between">
          <button onClick={() => router.push("/cheiz/mypage")}
            className="text-gray-500 text-sm flex items-center gap-1 active:scale-95">
            <ArrowLeft className="w-4 h-4" /> 뒤로
          </button>
          <h1 className="text-sm font-bold text-gray-900">나의 앨범</h1>
          <div className="w-12" />
        </div>
      </div>

      <div className="max-w-md mx-auto px-5 pt-4">
        {albums.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <Image className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-400 mb-1">아직 앨범이 없습니다</p>
            <p className="text-xs text-gray-300">사진을 결제하면 앨범이 자동 생성됩니다</p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 font-medium">총 {albums.length}개의 앨범</p>

            {albums.map((album, i) => {
              const statusInfo = STATUS_MAP[album.albumStatus.toUpperCase()] || STATUS_MAP.CHECKING;
              const StatusIcon = statusInfo.icon;

              return (
                <motion.div key={album.id}
                  initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

                  <button
                    onClick={() => router.push(`/cheiz/albums/${album.id}`)}
                    className="w-full flex items-center gap-4 p-4 text-left active:bg-gray-50 transition-colors">
                    {/* 썸네일 */}
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                      {album.thumbnailUrl ? (
                        <SecureImage src={album.thumbnailUrl} className="w-full h-full object-cover" watermark={false} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Camera className="w-6 h-6 text-gray-300" />
                        </div>
                      )}
                    </div>

                    {/* 정보 */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-900 truncate">{album.name}</h3>

                      {/* 상태 배지 */}
                      <div className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusInfo.color}`}>
                        <StatusIcon className={`w-3 h-3 ${album.albumStatus === "PROCESSING" ? "animate-spin" : ""}`} />
                        {statusInfo.label}
                      </div>

                      <div className="flex items-center gap-3 mt-1.5">
                        {album.photoCount > 0 && (
                          <span className="text-[11px] text-gray-400 flex items-center gap-1">
                            <FolderOpen className="w-3 h-3" /> {album.photoCount}장
                          </span>
                        )}
                        {album.downloadableDate && (
                          <span className="text-[11px] text-gray-300 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(album.downloadableDate).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                          </span>
                        )}
                        {album.location && (
                          <span className="text-[11px] text-gray-300 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {album.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* 리뷰 영역 */}
                  {album.albumStatus.toUpperCase() === "COMPLETED" ||
                  album.albumStatus.toUpperCase() === "DOWNLOADABLE" ? (
                    <div className="px-4 pb-3">
                      {reviewedAlbumIds.has(album.id) ? (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          리뷰 작성 완료
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/cheiz/reviews/write?albumId=${album.id}`);
                          }}
                          className="w-full flex items-center justify-center gap-1.5 border border-cheiz-border bg-white text-cheiz-text hover:border-cheiz-primary hover:text-cheiz-primary font-medium rounded-full py-2.5 px-4 text-xs active:scale-[0.98] transition-all"
                        >
                          <PenLine className="w-3.5 h-3.5" />
                          리뷰 쓰고 색감 보정 받기
                        </button>
                      )}
                    </div>
                  ) : null}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
