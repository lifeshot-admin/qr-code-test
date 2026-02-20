"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, Search, Loader2, Check, UserPlus, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";

type SearchUser = {
  id: number;
  nickname: string;
  profileImageUrl: string;
};

type InvitedUser = {
  userId: number;
  status: string; // PENDING | ACCEPTED | REJECTED | EXPELLED
};

export default function InvitePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const folderId = params?.folderId as string;

  const [keyword, setKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<SearchUser[]>([]);
  const [invitedUsers, setInvitedUsers] = useState<InvitedUser[]>([]);
  const [loadingInvited, setLoadingInvited] = useState(true);
  const [showStoreModal, setShowStoreModal] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.replace("/auth/signin");
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `/api/backend/folders/invitations/search?folderId=${folderId}&acceptanceStatusSet=PENDING,ACCEPTED,EXPELLED`
        );
        const data = await res.json();
        const invitations = data.data?.content || data.data || [];
        if (Array.isArray(invitations)) {
          setInvitedUsers(
            invitations.map((inv: any) => ({
              userId: inv.inviteeUserId || inv.userId,
              status: inv.acceptanceStatus || inv.status || "PENDING",
            }))
          );
        }
      } catch {}
      setLoadingInvited(false);
    })();
  }, [status, session, folderId, router]);

  const searchUsers = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `/api/backend/user-search-nickname?nickname=${encodeURIComponent(q)}`
      );
      const data = await res.json();

      let users: SearchUser[] = [];
      const rawList = data?.content || [];
      if (Array.isArray(rawList)) {
        users = rawList.map((u: any) => ({
          id: u.id || u.userId,
          nickname: u.nickname || u.name || "",
          profileImageUrl: u.profileImageUrl || u.profileImage || "",
        }));
      }

      const myId = Number((session?.user as any)?.id);
      setSearchResults(users.filter(u => u.id !== myId));
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  }, [session]);

  const onKeywordChange = (val: string) => {
    setKeyword(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchUsers(val), 400);
  };

  const getInviteStatus = (userId: number): string | null => {
    const found = invitedUsers.find(u => u.userId === userId);
    return found ? found.status : null;
  };

  const toggleUser = (user: SearchUser) => {
    const inviteStatus = getInviteStatus(user.id);
    if (inviteStatus === "PENDING" || inviteStatus === "ACCEPTED" || inviteStatus === "EXPELLED") return;
    setSelectedUsers((prev) =>
      prev.some(u => u.id === user.id) ? prev.filter(u => u.id !== user.id) : [...prev, user]
    );
  };

  const isSelected = (userId: number) => selectedUsers.some(u => u.id === userId);

  const handleNext = () => {
    if (selectedUsers.length === 0) return;
    const encoded = encodeURIComponent(JSON.stringify(selectedUsers));
    router.push(`/cheiz/folder/${folderId}/invite/confirm?users=${encoded}`);
  };

  const handleAppInviteLink = () => {
    const userLang = navigator.language || (navigator as any).languages?.[0] || "ko";
    const isKorean = userLang.startsWith("ko");

    const googlePlayUrl =
      "https://play.google.com/store/apps/details?id=me.lifeshot.cheiz&hl=" +
      (isKorean ? "ko" : "en");
    const appStoreUrl =
      "https://apps.apple.com/kr/app/%EC%97%AC%ED%96%89%EC%97%90-%EC%82%AC%EC%A7%84%EC%9D%B4-%ED%95%84%EC%9A%94%ED%95%A0-%EB%95%8C-%EC%B9%98%EC%9D%B4%EC%A6%88/id6743669106";

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);

    if (isIOS) {
      window.open(appStoreUrl, "_blank");
    } else if (isAndroid) {
      window.open(googlePlayUrl, "_blank");
    } else {
      setShowStoreModal(true);
    }
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case "PENDING": return { text: "초대됨", class: "bg-yellow-100 text-yellow-700" };
      case "ACCEPTED": return { text: "수락됨", class: "bg-green-100 text-green-700" };
      case "EXPELLED": return { text: "추방됨", class: "bg-red-100 text-red-700" };
      default: return { text: s, class: "bg-gray-100 text-gray-600" };
    }
  };

  if (loadingInvited) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cheiz-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-32">
      <PageHeader
        breadcrumb={{ home: "뒤로", current: "일행 초대하기" }}
        onBack={() => router.back()}
      />

      <div className="max-w-md mx-auto px-5 pt-4">
        {/* 선택된 유저 칩 */}
        {selectedUsers.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {selectedUsers.map((u) => (
              <div key={u.id} className="flex items-center gap-1 bg-cheiz-surface rounded-full px-3 py-1">
                {u.profileImageUrl ? (
                  <img src={u.profileImageUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-cheiz-primary/10 flex items-center justify-center text-[10px]">🧸</div>
                )}
                <span className="text-xs text-cheiz-text font-medium">{u.nickname}</span>
                <button
                  onClick={() => setSelectedUsers((prev) => prev.filter((s) => s.id !== u.id))}
                  className="ml-0.5 p-0.5 rounded-full hover:bg-gray-200 transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-cheiz-sub" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 검색 */}
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cheiz-sub" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            placeholder="일행 닉네임"
            className="w-full pl-10 pr-4 py-3 border-2 border-cheiz-primary/40 rounded-xl text-sm outline-none focus:border-cheiz-primary transition-colors"
          />
        </div>

        {/* 검색 결과 */}
        {keyword && (
          <div className="mb-4">
            <p className="text-xs text-cheiz-sub mb-2">검색결과</p>
            <div className="border-t border-gray-100">
              {searching ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="w-5 h-5 text-cheiz-primary animate-spin" />
                </div>
              ) : searchResults.length === 0 ? (
                <div className="py-8 text-center text-sm text-cheiz-sub">검색 결과가 없습니다</div>
              ) : (
                searchResults.map((user) => {
                  const invStatus = getInviteStatus(user.id);
                  const disabled = !!invStatus;
                  const selected = isSelected(user.id);

                  return (
                    <button
                      key={user.id}
                      onClick={() => toggleUser(user)}
                      disabled={disabled}
                      className={`w-full flex items-center gap-3 px-2 py-3 border-b border-gray-50 transition-colors ${
                        disabled ? "opacity-50 cursor-not-allowed" : "active:bg-gray-50"
                      }`}
                    >
                      {user.profileImageUrl ? (
                        <img src={user.profileImageUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-cheiz-surface flex items-center justify-center text-lg">
                          🧸
                        </div>
                      )}
                      <span className="flex-1 text-sm text-cheiz-text text-left">{user.nickname}</span>

                      {invStatus ? (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadge(invStatus).class}`}>
                          {statusBadge(invStatus).text}
                        </span>
                      ) : (
                        <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                          selected ? "bg-cheiz-primary border-cheiz-primary" : "border-gray-300"
                        }`}>
                          {selected && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* 하단 고정 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-md mx-auto px-5 py-4 space-y-2">
          <button
            onClick={handleAppInviteLink}
            className="w-full text-center text-sm text-cheiz-sub flex items-center justify-center gap-1.5 py-2"
          >
            <UserPlus className="w-4 h-4" /> 일행에게 앱 초대링크 보내기 🐹
          </button>
          <Button
            onClick={handleNext}
            disabled={selectedUsers.length === 0}
            className={`w-full py-3.5 text-sm font-bold ${
              selectedUsers.length === 0 ? "!bg-gray-200 !text-gray-400" : ""
            }`}
          >
            다음
          </Button>
        </div>
      </div>
      {/* 데스크톱: 스토어 선택 모달 */}
      <AnimatePresence>
        {showStoreModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
            onClick={() => setShowStoreModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-cheiz-text text-center mb-2">치이즈 앱 다운로드</h3>
              <p className="text-sm text-cheiz-sub text-center mb-5">일행에게 아래 링크를 공유해주세요</p>
              <div className="space-y-3">
                <a
                  href="https://apps.apple.com/kr/app/%EC%97%AC%ED%96%89%EC%97%90-%EC%82%AC%EC%A7%84%EC%9D%B4-%ED%95%84%EC%9A%94%ED%95%A0-%EB%95%8C-%EC%B9%98%EC%9D%B4%EC%A6%88/id6743669106"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 rounded-xl bg-cheiz-text text-white font-bold text-sm flex items-center justify-center gap-2"
                >
                  🍎 App Store
                </a>
                <a
                  href={`https://play.google.com/store/apps/details?id=me.lifeshot.cheiz&hl=${
                    (navigator.language || "ko").startsWith("ko") ? "ko" : "en"
                  }`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 rounded-xl bg-green-600 text-white font-bold text-sm flex items-center justify-center gap-2"
                >
                  🤖 Google Play
                </a>
              </div>
              <button
                onClick={() => setShowStoreModal(false)}
                className="w-full mt-3 py-2 text-sm text-cheiz-sub"
              >
                닫기
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
