"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2, Eye, EyeOff, Star, ArrowLeft, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

type Review = {
  _id: string;
  image?: string;
  "image-2"?: string;
  "image-3"?: string;
  review?: string;
  score?: number;
  title?: string;
  is_hidden?: boolean;
  user?: string;
  "Created Date"?: string;
  "Modified Date"?: string;
  _user_nickname?: string;
  _user_image?: string;
  [key: string]: any;
};

export default function ReviewsAdminPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reviews?limit=${limit}&offset=${page * limit}`);
      const json = await res.json();
      setReviews(json.data || []);
      setTotalCount(json.count || 0);
    } catch (e) {
      console.error("리뷰 목록 조회 실패:", e);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleToggleHidden = async (review: Review) => {
    setActionLoading(review._id);
    try {
      await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: review._id, is_hidden: !review.is_hidden }),
      });
      await fetchData();
    } catch (e) {
      console.error("토글 실패:", e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 리뷰를 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return;
    setActionLoading(id);
    try {
      await fetch(`/api/admin/reviews?id=${id}`, { method: "DELETE" });
      await fetchData();
    } catch (e) {
      console.error("삭제 실패:", e);
    } finally {
      setActionLoading(null);
    }
  };

  const totalPages = Math.ceil(totalCount / limit);

  const renderStars = (score?: number) => {
    const s = score || 0;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <Star key={i} className={`w-3.5 h-3.5 ${i <= s ? "text-yellow-400 fill-yellow-400" : "text-gray-200"}`} />
        ))}
        <span className="ml-1 text-xs text-gray-500">{s}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/content" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">리뷰 관리</h1>
          <p className="text-sm text-gray-500 mt-1">Bubble DB review 테이블 · 총 {totalCount}건</p>
        </div>
      </div>

      {reviews.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg mb-2">리뷰가 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => {
            const isProcessing = actionLoading === review._id;
            return (
              <div
                key={review._id}
                className={`bg-white border rounded-xl p-4 transition-all ${review.is_hidden ? "border-red-100 bg-red-50/30 opacity-70" : "border-gray-200"}`}
              >
                <div className="flex gap-4">
                  {/* 리뷰 이미지 */}
                  <div className="flex gap-1.5 flex-shrink-0">
                    {[review.image, review["image-2"], review["image-3"]].filter(Boolean).map((img, idx) => (
                      <div key={idx} className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden">
                        <img src={img!} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                    {![review.image, review["image-2"], review["image-3"]].filter(Boolean).length && (
                      <div className="w-16 h-16 rounded-lg bg-gray-50 flex items-center justify-center text-gray-300 text-xs">
                        No Image
                      </div>
                    )}
                  </div>

                  {/* 리뷰 내용 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">
                        {review._user_nickname || "익명"}
                      </span>
                      {renderStars(review.score)}
                      {review.is_hidden && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">비노출</span>
                      )}
                    </div>
                    {review.title && (
                      <p className="text-sm font-medium text-gray-800 mb-0.5">{review.title}</p>
                    )}
                    <p className="text-sm text-gray-600 line-clamp-2">{review.review || "내용 없음"}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {review["Created Date"] ? new Date(review["Created Date"]).toLocaleDateString("ko-KR") : "—"}
                    </p>
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleToggleHidden(review)}
                      disabled={isProcessing}
                      className={`p-2 rounded-lg transition-colors ${review.is_hidden ? "bg-green-50 hover:bg-green-100 text-green-600" : "bg-gray-50 hover:bg-gray-100 text-gray-500"}`}
                      title={review.is_hidden ? "노출하기" : "비노출하기"}
                    >
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : review.is_hidden ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(review._id)}
                      disabled={isProcessing}
                      className="p-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition-colors"
                      title="영구 삭제"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-gray-600">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
