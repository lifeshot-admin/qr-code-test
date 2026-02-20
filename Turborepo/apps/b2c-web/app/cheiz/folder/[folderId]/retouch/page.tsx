"use client";

import { useState, useEffect, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft, Brush, ChevronRight, Star, Loader2,
  SkipForward, Sparkles, CheckCheck,
} from "lucide-react";
import SecureImage from "@/components/SecureImage";

// ━━━ 리터쳐 폴백 ━━━
const RETOUCHER_FB = {
  id: 7, name: "박환",
  avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80",
  title: "CHEIZ 전속 리터쳐",
  description: "10년 경력의 전문 리터칭 작가.",
  rating: 4.9, pricePerPhoto: 15000,
};

function RetouchSelectContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const folderId = params?.folderId as string;

  const downloadPhotoIds = (searchParams.get("photos") || "").split(",").filter(Boolean);
  const retoucherIdParam = searchParams.get("retoucherId") || "7";

  const [retouchOrder, setRetouchOrder] = useState<string[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [retoucher, setRetoucher] = useState(RETOUCHER_FB);

  // 사진 로드 (N장만)
  useEffect(() => {
    if (!session || downloadPhotoIds.length === 0) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/backend/folder-photos?folderId=${folderId}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.photos)) {
          const all = data.photos.map((p: any) => ({
            ...p,
            id: String(p.id ?? p.photoId ?? p._id ?? Math.random()),
            url: p.url || p.imageUrl || p.originalUrl || p.photoUrl || "",
            thumbnailUrl: p.thumbnailUrl || p.thumbUrl || p.thumbnailImageUrl || p.url || p.imageUrl || "",
          }));
          const filtered = downloadPhotoIds
            .map(id => all.find((p: any) => String(p.id) === id))
            .filter(Boolean);
          setPhotos(filtered);
        }
      } catch {}
      finally { setLoading(false); }
    })();
  }, [session, folderId]);

  // 리터쳐 API
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/backend/retouchers");
        const data = await res.json();
        if (data.success && data.retoucher) {
          setRetoucher(prev => ({ ...prev, ...data.retoucher }));
        }
      } catch (e: any) {
        console.error("[RETOUCH_SELECT] 에러:", e.message);
      }
    })();
  }, []);

  const toggleRetouchSelect = (id: string) => {
    setRetouchOrder(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const getRetouchIndex = (id: string) => {
    const idx = retouchOrder.indexOf(id);
    return idx >= 0 ? idx + 1 : 0;
  };

  const toggleAll = () => {
    if (retouchOrder.length === photos.length) setRetouchOrder([]);
    else setRetouchOrder(photos.map((p: any) => String(p.id)));
  };

  const goToRedeem = () => {
    const dlIds = downloadPhotoIds.join(",");
    const rtIds = retouchOrder.join(",");
    router.push(`/cheiz/folder/${folderId}/redeem?photos=${dlIds}&retouchPhotos=${rtIds}&retoucherId=${retoucher.id}`);
  };

  const skipRetouch = () => {
    const dlIds = downloadPhotoIds.join(",");
    router.push(`/cheiz/folder/${folderId}/redeem?photos=${dlIds}&retouchPhotos=&retoucherId=`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cheiz-primary animate-spin" />
      </div>
    );
  }

  const isAllSelected = photos.length > 0 && retouchOrder.length === photos.length;

  return (
    <div className="min-h-screen bg-[#FAFAF8] pb-40">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-md mx-auto px-5 py-3 flex items-center justify-between">
          <button onClick={() => router.back()} className="text-gray-500 text-sm flex items-center gap-1 active:scale-95">
            <ArrowLeft className="w-4 h-4" /> 뒤로
          </button>
          <h1 className="text-sm font-bold text-gray-900">리터칭 사진 선택</h1>
          <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
            {retouchOrder.length} / {photos.length}
          </span>
        </div>
      </div>

      <div className="max-w-md mx-auto px-5 pt-5">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 rounded-2xl border border-amber-200 p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Brush className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">
                {downloadPhotoIds.length}장 중 리터칭할 사진을 선택하세요
              </p>
              <p className="text-[10px] text-amber-600 mt-0.5">
                선택하지 않으면 다운로드만 진행됩니다
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 flex items-center gap-3 mb-4">
          <img src={retoucher.avatar || RETOUCHER_FB.avatar} alt="" className="w-9 h-9 rounded-full object-cover border-2 border-amber-200" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-bold text-gray-900">{retoucher.name} 작가</p>
              <Star className="w-3 h-3 text-amber-500 fill-current" />
              <span className="text-[10px] font-bold text-amber-600">{retoucher.rating}</span>
            </div>
            <p className="text-[9px] text-gray-400">{(retoucher.pricePerPhoto || 15000).toLocaleString()}원/장</p>
          </div>
          <Sparkles className="w-4 h-4 text-amber-400" />
        </motion.div>

        <div className="flex items-center justify-between mb-3">
          <button onClick={toggleAll}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95 ${
              isAllSelected ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}>
            <CheckCheck className="w-3.5 h-3.5" />
            {isAllSelected ? "전체 해제" : "모두 선택하기"}
          </button>
          <p className="text-xs text-gray-400">{retouchOrder.length}장 선택</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo: any, idx: number) => {
            const rtIdx = getRetouchIndex(String(photo.id));
            const isSelected = rtIdx > 0;
            return (
              <motion.div key={photo.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.03 }}
                className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 cursor-pointer"
                onClick={() => toggleRetouchSelect(String(photo.id))}>
                <SecureImage src={photo.thumbnailUrl || photo.url} className="w-full h-full object-cover" watermark={true} />

                {isSelected && <div className="absolute inset-0 bg-amber-500/20 pointer-events-none" />}

                <div className={`absolute top-1 right-1 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold transition-all ${
                  isSelected ? "bg-amber-500 text-white shadow-lg ring-2 ring-white" : "bg-white/80 text-gray-400 border border-gray-300"
                }`}>
                  {isSelected ? rtIdx : ""}
                </div>

                <div className="absolute bottom-1 left-1 bg-cheiz-primary/80 text-white text-[8px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {idx + 1}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-md mx-auto px-5 py-3 space-y-2">
          <button onClick={goToRedeem} disabled={retouchOrder.length === 0}
            className="w-full h-12 bg-amber-500 text-white text-sm font-bold rounded-xl disabled:opacity-40 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20">
            <Brush className="w-4 h-4" />
            {retouchOrder.length > 0
              ? `리터칭 ${retouchOrder.length}장 포함 — 결제하기`
              : "리터칭할 사진을 선택하세요"}
            {retouchOrder.length > 0 && <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          <button onClick={skipRetouch}
            className="w-full h-10 bg-gray-100 text-gray-500 text-xs font-medium rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 hover:bg-gray-200">
            <SkipForward className="w-3.5 h-3.5" /> 리터칭 없이 다운로드만 진행
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RetouchSelectPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-3 border-cheiz-primary border-solid" />
      </div>
    }>
      <RetouchSelectContent />
    </Suspense>
  );
}
