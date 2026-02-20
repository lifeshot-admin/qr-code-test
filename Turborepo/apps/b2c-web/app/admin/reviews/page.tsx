"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, Eye, Download, CheckCircle2, Clock,
  Star, X, Upload, Send, Image as ImageIcon, Filter,
} from "lucide-react";
import { useModal } from "@/components/GlobalModal";

type ReviewItem = {
  _id: string;
  user_Id?: string;
  album_Id?: string;
  tour_Id?: string;
  spot_name?: string;
  category?: string;
  guest_count?: number;
  rating?: number;
  text?: string;
  review?: string;
  score?: number;
  status?: string;
  color_grade_status?: string;
  corrected_images?: string[];
  "Created Date"?: string;
  "Modified Date"?: string;
  _user_nickname?: string;
  _user_image?: string;
  user?: string;
  [key: string]: any;
};

type ReviewImage = {
  _id: string;
  review_Id?: string;
  image?: string;
  order?: number;
  original_photo_Id?: string;
};

type FilterTab = "all" | "pending" | "completed";

const FILTER_TABS: { key: FilterTab; label: string; icon: typeof Clock }[] = [
  { key: "all", label: "전체", icon: Filter },
  { key: "pending", label: "승인대기", icon: Clock },
  { key: "completed", label: "완료", icon: CheckCircle2 },
];

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: "대기", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  completed: { label: "완료", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  deleted: { label: "삭제", cls: "bg-red-50 text-red-500 border-red-200" },
  hide: { label: "숨김", cls: "bg-gray-100 text-gray-500 border-gray-200" },
};

const COLOR_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: "보정 대기", cls: "bg-purple-50 text-purple-700 border-purple-200" },
  completed: { label: "보정 완료", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i < count ? "fill-amber-400 text-amber-400" : "text-gray-200"}`}
        />
      ))}
    </div>
  );
}

export default function AdminReviewsPage() {
  const { showConfirm, showSuccess, showError } = useModal();

  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [totalCount, setTotalCount] = useState(0);

  // 상세 모달
  const [selectedReview, setSelectedReview] = useState<ReviewItem | null>(null);
  const [reviewImages, setReviewImages] = useState<ReviewImage[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // 보정본 URL 입력
  const [correctedUrls, setCorrectedUrls] = useState<string[]>(["", "", ""]);
  const [approving, setApproving] = useState(false);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reviews?limit=100&sort=Created Date&descending=true");
      const json = await res.json();
      setReviews(json.data || []);
      setTotalCount(json.count || 0);
    } catch (e) {
      console.error("리뷰 목록 조회 실패:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const filteredReviews = reviews.filter((r) => {
    if (filter === "all") return true;
    const reviewStatus = r.status || "pending";
    return reviewStatus === filter;
  });

  const openDetail = async (review: ReviewItem) => {
    setSelectedReview(review);
    setReviewImages([]);
    setCorrectedUrls(
      Array.isArray(review.corrected_images) && review.corrected_images.length > 0
        ? [...review.corrected_images, "", "", ""].slice(0, 3)
        : ["", "", ""]
    );
    setDetailLoading(true);

    try {
      const res = await fetch(`/api/admin/reviews/${review._id}`);
      const json = await res.json();
      if (json.images) setReviewImages(json.images);
      if (json.review) {
        setSelectedReview(json.review);
        if (Array.isArray(json.review.corrected_images) && json.review.corrected_images.length > 0) {
          setCorrectedUrls([...json.review.corrected_images, "", "", ""].slice(0, 3));
        }
      }
    } catch (e) {
      console.error("리뷰 상세 조회 실패:", e);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedReview(null);
    setReviewImages([]);
    setCorrectedUrls(["", "", ""]);
  };

  const handleApprove = async () => {
    if (!selectedReview) return;

    const validUrls = correctedUrls.filter((u) => u.trim() !== "");
    if (validUrls.length === 0) {
      showError("보정본 URL을 최소 1개 이상 입력해주세요.");
      return;
    }

    const confirmed = await showConfirm(
      "이 리뷰를 승인하고 보정본을 전달하시겠습니까?\n유저에게 이메일 알림이 발송됩니다.",
      { title: "리뷰 승인", confirmText: "승인 및 전달", cancelText: "취소" }
    );
    if (!confirmed) return;

    setApproving(true);
    try {
      const userEmail = selectedReview.user_email || selectedReview.email || "";
      const userNickname = selectedReview._user_nickname || "고객";

      const res = await fetch(`/api/admin/reviews/${selectedReview._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          color_grade_status: "completed",
          corrected_images: validUrls,
          user_email: userEmail,
          user_nickname: userNickname,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `HTTP ${res.status}`);
      }

      showSuccess("리뷰가 승인되었고 보정본이 전달되었습니다.");
      closeDetail();
      await fetchReviews();
    } catch (e: any) {
      console.error("리뷰 승인 실패:", e);
      showError(`승인 처리에 실패했습니다.\n${e?.message || "다시 시도해주세요."}`);
    } finally {
      setApproving(false);
    }
  };

  const getReviewText = (r: ReviewItem): string =>
    r.text || r.review || "";

  const getRating = (r: ReviewItem): number =>
    r.rating || r.score || 0;

  const getNickname = (r: ReviewItem): string =>
    r._user_nickname || "치이즈 고객님";

  const getDate = (r: ReviewItem): string => {
    const d = r["Created Date"];
    if (!d) return "—";
    return new Date(d).toLocaleDateString("ko-KR", {
      year: "numeric", month: "2-digit", day: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">리뷰 관리</h1>
          <p className="text-sm text-gray-500 mt-1">
            총 {totalCount}건 · Bubble DB review 테이블
          </p>
        </div>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-2 mb-6">
        {FILTER_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === key
                ? "bg-cheiz-primary text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {key !== "all" && (
              <span className={`ml-1 text-xs rounded-full px-1.5 py-0.5 ${
                filter === key ? "bg-white/20" : "bg-gray-200"
              }`}>
                {reviews.filter(r => (r.status || "pending") === key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 테이블 */}
      {filteredReviews.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg mb-2">해당 조건의 리뷰가 없습니다</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-500">작성일</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">닉네임</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">별점</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">리뷰 요약</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">리뷰 상태</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">보정 상태</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredReviews.map((r) => {
                const sBadge = STATUS_BADGE[r.status || "pending"] || STATUS_BADGE.pending;
                const cBadge = COLOR_BADGE[r.color_grade_status || "pending"] || COLOR_BADGE.pending;
                return (
                  <tr key={r._id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{getDate(r)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {r._user_image ? (
                          <img src={r._user_image} alt="" className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-[10px] text-gray-400">👤</span>
                          </div>
                        )}
                        <span className="font-medium text-gray-800 truncate max-w-[120px]">
                          {getNickname(r)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Stars count={getRating(r)} /></td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700 truncate max-w-[240px]">
                        {getReviewText(r) || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border ${sBadge.cls}`}>
                        {sBadge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border ${cBadge.cls}`}>
                        {cBadge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openDetail(r)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-cheiz-primary/10 text-cheiz-primary rounded-lg text-xs font-medium hover:bg-cheiz-primary/20 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" /> 상세
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ━━━ 상세 모달 ━━━ */}
      {selectedReview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            {/* 모달 헤더 */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="text-lg font-bold text-gray-900">리뷰 상세</h2>
              <button onClick={closeDetail} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {detailLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-cheiz-primary" />
                </div>
              ) : (
                <>
                  {/* 리뷰 정보 */}
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {selectedReview._user_image ? (
                          <img src={selectedReview._user_image} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-400">👤</div>
                        )}
                        <div>
                          <p className="font-semibold text-gray-900">{getNickname(selectedReview)}</p>
                          <p className="text-xs text-gray-400">{getDate(selectedReview)}</p>
                        </div>
                      </div>
                      <Stars count={getRating(selectedReview)} />
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {getReviewText(selectedReview) || "리뷰 텍스트 없음"}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                      {selectedReview.spot_name && (
                        <span className="bg-white px-2 py-1 rounded-lg border">📍 {selectedReview.spot_name}</span>
                      )}
                      {selectedReview.category && (
                        <span className="bg-white px-2 py-1 rounded-lg border">🏷️ {selectedReview.category}</span>
                      )}
                      {selectedReview.guest_count != null && (
                        <span className="bg-white px-2 py-1 rounded-lg border">👥 {selectedReview.guest_count}인</span>
                      )}
                      {selectedReview.album_Id && (
                        <span className="bg-white px-2 py-1 rounded-lg border">📂 앨범: {selectedReview.album_Id}</span>
                      )}
                    </div>
                  </div>

                  {/* 유저 선택 사진 */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-cheiz-primary" />
                      유저가 선택한 사진 ({reviewImages.length}장)
                    </h3>
                    {reviewImages.length > 0 ? (
                      <div className="grid grid-cols-3 gap-3">
                        {reviewImages.map((img, idx) => (
                          <div key={img._id} className="relative group">
                            <div className="aspect-square rounded-xl overflow-hidden bg-gray-100">
                              {img.image ? (
                                <img
                                  src={img.image}
                                  alt={`리뷰 사진 ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-300">
                                  <ImageIcon className="w-8 h-8" />
                                </div>
                              )}
                            </div>
                            {img.image && (
                              <a
                                href={img.image}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 rounded-xl transition-opacity"
                              >
                                <span className="flex items-center gap-1.5 bg-white text-gray-800 text-xs font-medium px-3 py-1.5 rounded-lg shadow">
                                  <Download className="w-3.5 h-3.5" /> 원본 다운로드
                                </span>
                              </a>
                            )}
                            <span className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                              #{idx + 1}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-400 text-sm">
                        연결된 리뷰 이미지가 없습니다
                      </div>
                    )}
                  </div>

                  {/* 보정본 업로드 영역 */}
                  <div className="border-t border-gray-100 pt-6">
                    <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5">
                      <Upload className="w-4 h-4 text-purple-600" />
                      보정본 URL 입력 (최대 3장)
                    </h3>
                    <p className="text-xs text-gray-400 mb-4">
                      색감 보정된 사진의 호스팅 URL을 입력해주세요. S3, Cloudflare 등에 업로드 후 URL을 붙여넣기 하세요.
                    </p>
                    <div className="space-y-3">
                      {correctedUrls.map((url, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center mt-1">
                            {idx + 1}
                          </span>
                          <div className="flex-1 space-y-2">
                            <input
                              type="url"
                              value={url}
                              onChange={(e) => {
                                const next = [...correctedUrls];
                                next[idx] = e.target.value;
                                setCorrectedUrls(next);
                              }}
                              placeholder="https://example.com/corrected-photo.jpg"
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400 transition-colors"
                            />
                            {url.trim() && (
                              <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                                <img
                                  src={url}
                                  alt={`보정본 ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = "none";
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 기존 보정본 표시 */}
                  {Array.isArray(selectedReview.corrected_images) &&
                    selectedReview.corrected_images.length > 0 && (
                      <div className="bg-emerald-50 rounded-xl p-4">
                        <h4 className="text-sm font-bold text-emerald-700 mb-3 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          이미 업로드된 보정본
                        </h4>
                        <div className="grid grid-cols-3 gap-3">
                          {selectedReview.corrected_images.map((imgUrl: string, idx: number) => (
                            <div key={idx} className="aspect-square rounded-xl overflow-hidden bg-white">
                              <img src={imgUrl} alt={`보정본 ${idx + 1}`} className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </>
              )}
            </div>

            {/* 모달 푸터 */}
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex gap-3 rounded-b-2xl">
              <button
                onClick={closeDetail}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                닫기
              </button>
              <button
                onClick={handleApprove}
                disabled={approving || correctedUrls.every((u) => !u.trim())}
                className="flex-1 py-2.5 bg-cheiz-primary text-white rounded-lg text-sm font-medium hover:bg-cheiz-dark disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {approving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> 처리 중...</>
                ) : (
                  <><Send className="w-4 h-4" /> 승인 및 보정본 전달</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
