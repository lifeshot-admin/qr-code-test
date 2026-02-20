"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { ArrowLeft, Loader2, MapPin, Plus } from "lucide-react";
import { motion } from "framer-motion";
import Button from "@/components/ui/Button";

type FolderInfo = {
  id: number;
  scheduleId: number | null;
  name: string;
  personCount: number;
  hostUserId: number | null;
  status: string;
};

type AcceptedGuest = {
  userId: number;
  nickname: string;
  profileImageUrl: string;
};

export default function PhotoArrivePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const folderId = params?.folderId as string;

  const [folder, setFolder] = useState<FolderInfo | null>(null);
  const [coverPhoto, setCoverPhoto] = useState<string>("");
  const [photoCount, setPhotoCount] = useState(0);
  const [guests, setGuests] = useState<AcceptedGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationName, setLocationName] = useState("");
  const [imgError, setImgError] = useState(false);

  const nickname = (session?.user as any)?.nickname || (session?.user as any)?.name || "";
  const userImage = (session?.user as any)?.image || "";

  useEffect(() => {
    if (status === "loading" || !session || !folderId) return;
    setLoading(true);

    (async () => {
      try {
        const [folderRes, photosRes] = await Promise.all([
          fetch(`/api/backend/folder-detail?folderId=${folderId}`),
          fetch(`/api/backend/folder-photos?folderId=${folderId}`),
        ]);

        const folderData = await folderRes.json();
        if (folderData.success && folderData.folder) {
          setFolder(folderData.folder);
          setLocationName(folderData.folder.name || "");

          if (folderData.folder.scheduleId) {
            try {
              const invRes = await fetch(
                `/api/backend/folders/invitations/search?folderId=${folderId}&acceptanceStatusSet=ACCEPTED`
              );
              const invData = await invRes.json();
              const invitations = invData.data?.content || invData.data || [];
              if (Array.isArray(invitations)) {
                setGuests(
                  invitations.map((inv: any) => ({
                    userId: inv.inviteeUserId || inv.userId,
                    nickname: inv.inviteeNickname || inv.nickname || "게스트",
                    profileImageUrl: inv.inviteeProfileImageUrl || inv.profileImageUrl || "",
                  }))
                );
              }
            } catch {}
          }
        }

        const photosData = await photosRes.json();
        if (photosData.success && Array.isArray(photosData.photos)) {
          setPhotoCount(photosData.photos.length);
          if (photosData.photos.length > 0) {
            const first = photosData.photos[0];
            const url = first.thumbnailUrl || first.url || first.imageUrl || first.photoUrl || "";
            setCoverPhoto(url);
          }
        }
      } catch (e) {
        console.error("[ARRIVE] 데이터 로드 실패:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [status, session, folderId]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (!session) {
    router.replace("/auth/signin");
    return null;
  }

  const bgUrl = coverPhoto && !imgError ? coverPhoto : "";

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {/* 배경 사진 — CSS backgroundImage + fallback img */}
      {bgUrl ? (
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 w-full h-full bg-cover bg-center"
            style={{ backgroundImage: `url(${bgUrl})` }}
          />
          {/* hidden img to detect load failure and try proxy fallback */}
          <img
            src={bgUrl}
            alt=""
            className="hidden"
            onError={() => {
              if (!imgError) setImgError(true);
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: "rgba(0,0,0,0.45)",
            }}
          />
        </div>
      ) : (
        <div className="absolute inset-0 bg-cheiz-text" />
      )}

      {/* 상단 텍스트 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="absolute top-0 left-0 px-6 pt-14 z-10"
      >
        <p className="text-white font-bold text-3xl leading-tight">
          {nickname}님,
        </p>
        <p className="text-white font-bold text-3xl leading-tight mt-1">
          {locationName ? `${locationName}에서` : "폴더에서"}{" "}
        </p>
        <p className="text-white font-bold text-3xl leading-tight">
          <span className="text-cheiz-primary">{photoCount}장</span>의
        </p>
        <p className="text-white font-bold text-3xl leading-tight">
          사진이 도착했어요!
        </p>
      </motion.div>

      {/* 하단 정보 영역 */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="absolute bottom-0 left-0 w-full z-10 px-6 pb-10 space-y-4"
      >
        {/* 호스트 */}
        <div className="flex items-center gap-3">
          {userImage ? (
            <img src={userImage} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-white/30" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-sm">👤</div>
          )}
          <div>
            <p className="text-xs text-white/50 block">방장</p>
            <p className="text-sm text-white font-medium">{nickname}</p>
          </div>
        </div>

        {/* 게스트 + 초대 버튼 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {guests.length > 0 ? (
              <div className="flex -space-x-2">
                {guests.slice(0, 4).map((g, i) => (
                  <div key={i}>
                    {g.profileImageUrl ? (
                      <img src={g.profileImageUrl} alt={g.nickname} className="w-8 h-8 rounded-full object-cover border-2 border-black/40" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-white/10 border-2 border-black/40 flex items-center justify-center text-[10px] text-white/60">
                        {g.nickname[0]}
                      </div>
                    )}
                  </div>
                ))}
                {guests.length > 4 && (
                  <div className="w-8 h-8 rounded-full bg-white/20 border-2 border-black/40 flex items-center justify-center text-[10px] text-white font-bold">
                    +{guests.length - 4}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-sm">👤</div>
                <span className="text-sm text-white/60">아직 일행이 없어요</span>
              </div>
            )}
          </div>
          <button
            onClick={() => router.push(`/cheiz/folder/${folderId}/invite`)}
            className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 text-xs text-white font-medium flex items-center gap-1 active:scale-95 transition-transform"
          >
            <Plus className="w-3 h-3" /> 일행 초대하기
          </button>
        </div>

        {/* 촬영 장소 */}
        {locationName && (
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-white/60" />
            <span className="text-sm text-white/80">{locationName}</span>
          </div>
        )}

        {/* 버튼 */}
        <div className="mt-6 space-y-2">
          <Button
            onClick={() => router.push(`/cheiz/folder/${folderId}`)}
            className="w-full py-4 text-sm font-bold"
          >
            사진 확인하기
          </Button>
          <button
            onClick={() => router.back()}
            className="w-full text-center text-white/50 text-sm mt-2 py-2 flex items-center justify-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" /> 뒤로가기
          </button>
        </div>
      </motion.div>
    </div>
  );
}
