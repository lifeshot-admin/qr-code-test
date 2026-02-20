"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Star, Check, Loader2, Camera, Info } from "lucide-react";
import toast from "react-hot-toast";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import SecureImage from "@/components/SecureImage";

type AlbumPhoto = {
  id: string;
  albumPhotoUrl: string;
  thumbnailUrl: string;
};

type AlbumMeta = {
  name: string;
  location: string;
  category: string;
  spotName: string;
  guestCount: number;
  tourId: string | number;
};

const MAX_PHOTOS = 3;
const MIN_TEXT_LENGTH = 10;

export default function ReviewWritePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const albumId = searchParams.get("albumId");

  const [photos, setPhotos] = useState<AlbumPhoto[]>([]);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(
    new Set(),
  );
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [albumMeta, setAlbumMeta] = useState<AlbumMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!albumId) return;

    (async () => {
      try {
        const [photosRes, albumsRes] = await Promise.all([
          fetch(
            `/api/backend/albums/${albumId}/photos?photoType=ALL&size=200`,
          ),
          fetch("/api/backend/albums"),
        ]);

        const photosData = await photosRes.json();
        if (photosData.success && Array.isArray(photosData.photos)) {
          setPhotos(
            photosData.photos.map((p: any) => ({
              id: String(p.id || p.albumPhotoId || p.photoId),
              albumPhotoUrl: p.albumPhotoUrl || p.url || p.imageUrl || "",
              thumbnailUrl:
                p.thumbnailUrl || p.albumPhotoUrl || p.url || "",
            })),
          );
        }

        const albumsData = await albumsRes.json();
        let albumLocation = "";
        let albumCategory = "";
        let albumSpotName = "";
        let albumGuestCount = 0;
        let albumTourId: string | number = "";
        let albumName = "앨범";

        if (albumsData.success && Array.isArray(albumsData.albums)) {
          const found = albumsData.albums.find(
            (a: any) => String(a.id || a.albumId) === albumId,
          );
          if (found) {
            albumName = found.name || found.albumName || "앨범";
            albumLocation = found.location || found.spot || "";
            albumCategory = found.category || found.tourType || "";
            albumGuestCount =
              found.guestCount || found.personCount || 0;
            albumTourId = found.tourId || found.tour_Id || "";
          }
        }

        if (albumTourId) {
          try {
            const [tourRes, spotsRes] = await Promise.all([
              fetch(`/api/bubble/tour/${albumTourId}`),
              fetch(`/api/bubble/spots/${albumTourId}`),
            ]);

            if (tourRes.ok) {
              const tourData = await tourRes.json();
              const tour = tourData?.tour || tourData?.response;
              if (tour) {
                if (!albumCategory && tour.tour_name) {
                  albumCategory = tour.tour_name;
                }
              }
            }

            if (spotsRes.ok) {
              const spotsData = await spotsRes.json();
              const spots: Array<{ spot_name?: string }> =
                spotsData?.spots ||
                spotsData?.response?.results ||
                [];
              if (spots.length > 0) {
                albumSpotName = spots
                  .map((s) => s.spot_name)
                  .filter(Boolean)
                  .join(", ");
                if (!albumLocation && albumSpotName) {
                  albumLocation = albumSpotName;
                }
              }
            }
          } catch (e) {
            console.error(
              "[ReviewWrite] Bubble tour/spot fetch error:",
              e,
            );
          }
        }

        setAlbumMeta({
          name: albumName,
          location: albumLocation,
          category: albumCategory,
          spotName: albumSpotName,
          guestCount: albumGuestCount,
          tourId: albumTourId,
        });
      } catch (e: any) {
        console.error("[ReviewWrite] Load error:", e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [albumId]);

  const togglePhoto = (photoId: string) => {
    setSelectedPhotoIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        if (next.size >= MAX_PHOTOS) {
          toast.error(
            `사진은 최대 ${MAX_PHOTOS}장까지 선택 가능합니다`,
          );
          return prev;
        }
        next.add(photoId);
      }
      return next;
    });
  };

  const isValid =
    rating > 0 &&
    reviewText.trim().length >= MIN_TEXT_LENGTH &&
    selectedPhotoIds.size > 0;

  const handleSubmit = async () => {
    if (!isValid || !albumId || submitting) return;

    const userId = (session?.user as any)?.id;
    if (!userId) {
      toast.error("로그인이 필요합니다");
      return;
    }

    setSubmitting(true);

    try {
      const reviewBody = {
        user_Id: userId,
        album_Id: albumId,
        tour_Id: albumMeta?.tourId || null,
        spot_name: albumMeta?.spotName || albumMeta?.location || "",
        category: albumMeta?.category || "",
        guest_count: albumMeta?.guestCount || 0,
        rating,
        text: reviewText.trim(),
        status: "pending",
        color_grade_status: "pending",
      };

      const reviewRes = await fetch("/api/bubble/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reviewBody),
      });

      const reviewResult = await reviewRes.json();
      if (!reviewRes.ok || !reviewResult.success) {
        throw new Error("리뷰 생성에 실패했습니다");
      }

      const reviewId = reviewResult.id;

      const selectedPhotos = photos.filter((p) =>
        selectedPhotoIds.has(p.id),
      );
      await Promise.all(
        selectedPhotos.map((photo, idx) =>
          fetch("/api/bubble/review-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              review_Id: reviewId,
              image: photo.albumPhotoUrl,
              order: idx + 1,
              original_photo_Id: photo.id,
            }),
          }),
        ),
      );

      toast.success(
        "리뷰가 등록되었습니다.\n색감 보정은 영업일 3일 이내 완료됩니다",
        { duration: 4000 },
      );
      router.push("/cheiz/albums");
    } catch (e: any) {
      console.error("[ReviewWrite] Submit error:", e.message);
      toast.error(e.message || "리뷰 등록에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  if (!albumId) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <p className="text-sm text-gray-400">앨범 정보가 없습니다</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cheiz-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] pb-32">
      <PageHeader title="리뷰 작성" backHref="/cheiz/albums" />

      <div className="max-w-md mx-auto px-5 pt-5 space-y-6">
        {/* 사진 첨부 섹션 */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 mb-1">
            사진 선택{" "}
            <span className="text-cheiz-primary font-normal">
              ({selectedPhotoIds.size}/{MAX_PHOTOS})
            </span>
          </h2>
          <p className="text-xs text-cheiz-sub mb-3">
            선택한 사진은 색감 보정 후 리뷰에 게시됩니다
          </p>

          {photos.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-2xl border border-gray-100">
              <Camera className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">
                앨범에 사진이 없습니다
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {photos.map((photo, idx) => {
                const isSelected = selectedPhotoIds.has(photo.id);
                return (
                  <motion.button
                    key={photo.id}
                    type="button"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.02 }}
                    onClick={() => togglePhoto(photo.id)}
                    className={`aspect-square rounded-xl overflow-hidden relative active:scale-[0.97] transition-all ${
                      isSelected
                        ? "ring-2 ring-cheiz-primary ring-offset-1"
                        : "ring-0"
                    }`}
                  >
                    <SecureImage
                      src={`/api/download?url=${encodeURIComponent(photo.thumbnailUrl || photo.albumPhotoUrl)}`}
                      className="w-full h-full object-cover"
                      watermark={false}
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-cheiz-primary/20 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full bg-cheiz-primary flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          )}

          <div className="mt-3 space-y-1">
            <p className="text-xs text-cheiz-sub">
              색감 보정은 영업일 3일 이내 완료됩니다
            </p>
            <p className="text-xs text-gray-400 flex items-start gap-1">
              <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
              색감 보정(무료)은 디테일 리터칭(유료)과 다릅니다
            </p>
          </div>
        </section>

        {/* 별점 섹션 */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 mb-2">별점</h2>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="p-0.5 active:scale-110 transition-transform"
              >
                <Star
                  className={`w-8 h-8 ${
                    star <= rating
                      ? "text-amber-400 fill-amber-400"
                      : "text-gray-200"
                  }`}
                />
              </button>
            ))}
            {rating > 0 && (
              <span className="ml-2 text-sm font-medium text-gray-600">
                {rating}점
              </span>
            )}
          </div>
          {rating === 0 && (
            <p className="text-xs text-red-400 mt-1">
              별점을 선택해 주세요
            </p>
          )}
        </section>

        {/* 리뷰 텍스트 섹션 */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 mb-2">리뷰</h2>
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="투어는 어떠셨나요?"
            rows={4}
            maxLength={500}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-cheiz-primary resize-none transition-colors"
          />
          <div className="flex items-center justify-between mt-1">
            <p
              className={`text-xs ${
                reviewText.trim().length > 0 &&
                reviewText.trim().length < MIN_TEXT_LENGTH
                  ? "text-red-400"
                  : "text-gray-300"
              }`}
            >
              최소 {MIN_TEXT_LENGTH}자 이상
            </p>
            <p className="text-xs text-gray-300">
              {reviewText.length}/500
            </p>
          </div>
        </section>

        {/* 공개 정보 섹션 */}
        {albumMeta && (
          <section>
            <h2 className="text-sm font-bold text-gray-900 mb-2">
              리뷰 공개 정보
            </h2>
            <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
              {albumMeta.location && (
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-xs text-gray-400">
                    촬영 장소
                  </span>
                  <span className="text-xs font-medium text-gray-700">
                    {albumMeta.location}
                  </span>
                </div>
              )}
              {albumMeta.category && (
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-xs text-gray-400">
                    카테고리
                  </span>
                  <span className="text-xs font-medium text-gray-700">
                    {albumMeta.category}
                  </span>
                </div>
              )}
              {albumMeta.guestCount > 0 && (
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-xs text-gray-400">인원</span>
                  <span className="text-xs font-medium text-gray-700">
                    {albumMeta.guestCount}명
                  </span>
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {/* 하단 제출 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-md mx-auto px-5 py-3">
          <Button
            variant="primary"
            loading={submitting}
            disabled={!isValid}
            onClick={handleSubmit}
            className="w-full"
          >
            리뷰 등록 &amp; 색감 보정 신청
          </Button>
        </div>
      </div>
    </div>
  );
}
