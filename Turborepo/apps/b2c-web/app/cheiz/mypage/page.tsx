"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  LogOut,
  Ticket,
  ChevronRight,
  FileText,
  Shield,
  MessageCircle,
  Menu,
  X,
  UserX,
  Pencil,
  Check,
  Camera,
  Globe,
  Loader2,
  FolderOpen,
  Image,
} from "lucide-react";
import { useModal } from "@/components/GlobalModal";

export default function MyPage() {
  const { data: session, status, update: updateSession } = useSession();
  const router = useRouter();
  const { showConfirm } = useModal();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // ━━━ 카운트 ━━━
  const [couponCount, setCouponCount] = useState(0);
  const [tourCount, setTourCount] = useState(0);
  const [albumCount, setAlbumCount] = useState(0);

  // ━━━ 프로필 편집 ━━━
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [nicknameAvailable, setNicknameAvailable] = useState<boolean | null>(null);
  const [nicknameChecking, setNicknameChecking] = useState(false);
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [profileUploading, setProfileUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ━━━ 언어 ━━━
  const [language, setLanguage] = useState("ko");
  const [langSaving, setLangSaving] = useState(false);

  // ━━━ 회원탈퇴 ━━━
  const [withdrawalOpen, setWithdrawalOpen] = useState(false);
  const [withdrawalReasons, setWithdrawalReasons] = useState<string[]>([]);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [customReason, setCustomReason] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);

  // ━━━ 토스트 ━━━
  const [toast, setToast] = useState("");
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  // ━━━ /api/v1/user/me를 통한 프로필 동기화 함수 ━━━
  const syncProfileFromServer = useCallback(async () => {
    try {
      console.log("━━━ [SYNC_PROFILE] /me API 호출 시작 ━━━");
      const res = await fetch("/api/backend/user?action=me");
      const data = await res.json();

      if (!data.success || !data.user) {
        console.error("[SYNC_PROFILE] ❌ /me 응답 실패:", data);
        return null;
      }

      const { nickname, image, name, lan } = data.user;
      console.log("[SYNC_PROFILE] 📋 서버 최신 데이터:");
      console.log(`  🏷️ nickname: "${nickname}"`);
      console.log(`  🖼️ image: "${image ? image.substring(0, 60) + '...' : '없음'}"`);
      console.log(`  ✅ "음!" 포함: ${(nickname || '').includes("음!") ? "YES" : "NO"}`);
      console.log(`  ✅ "정윤식" 포함: ${(nickname || '').includes("정윤식") ? "YES" : "NO"}`);

      // ✅ updateSession에 최신 데이터를 직접 전달하여 JWT 토큰을 갱신
      await updateSession({ nickname, image, name: nickname, lan });

      console.log("[SYNC_PROFILE] ✅ 세션 갱신 완료! (nickname + image → JWT 반영)");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      return data.user;
    } catch (err: any) {
      console.error("[SYNC_PROFILE] ❌ 동기화 실패:", err?.message);
      return null;
    }
  }, [updateSession]);

  // ━━━ 데이터 로드 ━━━
  useEffect(() => {
    if (status === "loading" || !session) return;

    async function fetchCouponCount() {
      try {
        const res = await fetch("/api/backend/issued-coupons");
        const data = await res.json();
        if (data.success && Array.isArray(data.coupons)) {
          const activeCount = data.coupons.filter((c: any) => !c.isUsed).length;
          setCouponCount(activeCount);
        }
      } catch {}
    }

    async function fetchTourCount() {
      try {
        const { getUserTours } = await import("@/lib/api-client");
        const userId = (session as any)?.user?.id || (session as any)?.userId;
        if (!userId) {
          console.warn("[MYPAGE] userId 없음 — 카운트 스킵");
          return;
        }
        const res = await getUserTours(String(userId));

        console.log("━━━ [MYPAGE] 예약 카운트 디버그 ━━━");
        console.log("[MYPAGE] userId:", userId);
        console.log("[MYPAGE] res 전체 키:", Object.keys(res || {}));
        console.log("[MYPAGE] res.data 키:", res?.data ? Object.keys(res.data) : "N/A");
        console.log("[MYPAGE] res.statusCode:", (res as any)?.statusCode);
        console.log("[MYPAGE] res.message:", (res as any)?.message);
        console.log("[MYPAGE] res.data?.content 존재:", !!(res?.data?.content));
        console.log("[MYPAGE] res.data?.content 길이:", res?.data?.content?.length ?? "N/A");
        console.log("[MYPAGE] res 전체 (300자):", JSON.stringify(res)?.substring(0, 300));

        // 다양한 응답 구조 대응
        let tours: any[] = [];
        if (res?.data?.content && Array.isArray(res.data.content)) {
          tours = res.data.content;
          console.log("[MYPAGE] 추출경로: res.data.content →", tours.length, "개");
        } else if ((res as any)?.content && Array.isArray((res as any).content)) {
          tours = (res as any).content;
          console.log("[MYPAGE] 추출경로: res.content →", tours.length, "개");
        } else if (Array.isArray(res?.data)) {
          tours = res.data;
          console.log("[MYPAGE] 추출경로: res.data(배열) →", tours.length, "개");
        } else if (Array.isArray(res)) {
          tours = res;
          console.log("[MYPAGE] 추출경로: res 자체(배열) →", tours.length, "개");
        } else {
          console.warn("[MYPAGE] 배열 추출 실패! res.data:", JSON.stringify(res?.data)?.substring(0, 300));
        }

        if (Array.isArray(tours) && tours.length > 0) {
          // 각 투어의 status 원본 값을 개별 출력
          console.log("[MYPAGE] 전체 투어 status 목록:");
          tours.forEach((t: any, i: number) => {
            console.log(`  [${i}] id=${t.id}, status="${t.status}", name="${t.name?.substring(0, 20)}"`);
          });

          // 상태별 분포
          const statusMap: Record<string, number> = {};
          tours.forEach((t: any) => {
            const s = t.status || "UNKNOWN";
            statusMap[s] = (statusMap[s] || 0) + 1;
          });
          console.log("[MYPAGE] 상태별 분포:", JSON.stringify(statusMap));

          // 유효 상태 필터 (대소문자 무시, BOOKED/CONFIRMED도 포함)
          const excludeStatuses = ["CANCELED", "CANCELLED", "NOSHOW", "NO_SHOW", "EXPIRED", "DELETED"];
          const validTours = tours.filter((t: any) => {
            const s = (t.status || "").toUpperCase().trim();
            return s.length > 0 && !excludeStatuses.includes(s);
          });
          console.log(`[MYPAGE] 유효 예약: ${validTours.length}개 (전체 ${tours.length}개, 제외: ${tours.length - validTours.length}개)`);
          setTourCount(validTours.length);
        } else {
          console.warn("[MYPAGE] tours가 비어있음 또는 배열 아님");
          setTourCount(0);
        }
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      } catch (e: any) {
        console.error("[MYPAGE] fetchTourCount 에러:", e?.message);
        setTourCount(0);
      }
    }

    async function fetchAlbumCount() {
      try {
        const res = await fetch("/api/backend/albums");
        const data = await res.json();
        if (data.success && typeof data.count === "number") {
          setAlbumCount(data.count);
        } else if (data.success && Array.isArray(data.albums)) {
          setAlbumCount(data.albums.length);
        }
      } catch {}
    }

    Promise.all([fetchCouponCount(), fetchTourCount(), fetchAlbumCount()]);
  }, [status, session]);

  // 외부 클릭으로 메뉴 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  // ━━━ 닉네임 중복 검사 (디바운스) ━━━
  const checkNicknameRef = useRef<NodeJS.Timeout | null>(null);
  const checkNickname = useCallback((name: string) => {
    if (checkNicknameRef.current) clearTimeout(checkNicknameRef.current);
    if (!name.trim() || name.trim().length < 2) { setNicknameAvailable(null); return; }
    setNicknameChecking(true);
    checkNicknameRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/backend/user?action=check-nickname&nickname=${encodeURIComponent(name.trim())}`);
        const data = await res.json();
        setNicknameAvailable(data.available ?? null);
      } catch { setNicknameAvailable(null); }
      finally { setNicknameChecking(false); }
    }, 500);
  }, []);

  // ━━━ 닉네임 저장 (성공 시 /me → updateSession 체인) ━━━
  const saveNickname = async () => {
    if (!nicknameInput.trim() || nicknameAvailable === false) return;
    setNicknameSaving(true);
    try {
      console.log(`[NICKNAME] PATCH 시작: "${nicknameInput.trim()}"`);
      const res = await fetch("/api/backend/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nicknameInput.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        console.log("[NICKNAME] ✅ PATCH 성공! → /me 동기화 시작...");
        setEditingNickname(false);
        // ✅ /me API → updateSession 체인으로 전역 세션 즉시 갱신
        await syncProfileFromServer();
        showToast("닉네임이 변경되었습니다.");
      }
      else showToast(data.error || "닉네임 변경 실패");
    } catch { showToast("오류가 발생했습니다."); }
    finally { setNicknameSaving(false); }
  };

  // ━━━ 프로필 이미지 업로드 (성공 시 /me → updateSession 체인) ━━━
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      console.log(`[PROFILE_IMG] 업로드 시작: name=${file.name}, size=${file.size}, type=${file.type}`);

      const res = await fetch("/api/backend/user/profile-image", { method: "PATCH", body: formData });
      const data = await res.json();
      if (data.success) {
        console.log("[PROFILE_IMG] ✅ 업로드 성공! → /me 동기화 시작...");
        // ✅ /me API → updateSession 체인으로 전역 세션 즉시 갱신
        await syncProfileFromServer();
        showToast("프로필 사진이 변경되었습니다.");
      }
      else showToast(data.error || "업로드 실패");
    } catch { showToast("이미지 업로드 중 오류"); }
    finally { setProfileUploading(false); }
  };

  // ━━━ 언어 변경 ━━━
  const handleLanguageChange = async (lang: string) => {
    setLanguage(lang);
    setLangSaving(true);
    try {
      await fetch("/api/backend/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: lang }),
      });
      showToast(`언어가 ${lang === "ko" ? "한국어" : lang === "ja" ? "日本語" : "English"}로 변경되었습니다.`);
    } catch {} finally { setLangSaving(false); }
  };

  // ━━━ 회원탈퇴 플로우 ━━━
  const openWithdrawal = async () => {
    setMenuOpen(false);
    setWithdrawalOpen(true);
    try {
      const res = await fetch("/api/backend/user?action=withdrawal-reasons");
      const data = await res.json();
      setWithdrawalReasons(
        Array.isArray(data.reasons) && data.reasons.length > 0
          ? data.reasons
          : ["서비스 이용이 불편해서", "다른 서비스를 이용하려고", "콘텐츠 부족", "개인정보 보호 우려", "기타"]
      );
    } catch {
      setWithdrawalReasons(["서비스 이용이 불편해서", "다른 서비스를 이용하려고", "콘텐츠 부족", "개인정보 보호 우려", "기타"]);
    }
  };

  // "기타" 선택 시 5글자 미만이면 탈퇴 불가
  const isOtherSelected = selectedReasons.includes("기타");
  const isCustomReasonValid = !isOtherSelected || customReason.trim().length >= 5;
  const canWithdraw = selectedReasons.length > 0 && isCustomReasonValid;

  const executeWithdrawal = async () => {
    if (!canWithdraw) {
      if (isOtherSelected && customReason.trim().length < 5) {
        showToast("기타 사유를 5글자 이상 입력해주세요.");
      } else {
        showToast("탈퇴 사유를 선택해주세요.");
      }
      return;
    }
    const confirmed = await showConfirm("정말 회원을 탈퇴하시겠습니까?\n탈퇴 시 모든 데이터가 삭제되며 복구할 수 없습니다.", { title: "회원 탈퇴", confirmText: "탈퇴하기", cancelText: "돌아가기" });
    if (!confirmed) return;
    setWithdrawing(true);
    try {
      // customReason을 reasons 쿼리에 함께 전달
      const allReasons = [...selectedReasons];
      if (isOtherSelected && customReason.trim()) {
        // "기타"를 "기타: (상세 내용)"으로 교체
        const idx = allReasons.indexOf("기타");
        if (idx >= 0) allReasons[idx] = `기타: ${customReason.trim()}`;
      }
      const res = await fetch(`/api/backend/user?reasons=${encodeURIComponent(allReasons.join(","))}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) { showToast("회원 탈퇴가 완료되었습니다."); await signOut({ callbackUrl: "/cheiz" }); }
      else showToast(data.error || "탈퇴 처리 실패");
    } catch { showToast("오류가 발생했습니다."); }
    finally { setWithdrawing(false); }
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    const confirmed = await showConfirm("로그아웃 하시겠습니까?", { title: "로그아웃" });
    if (confirmed) signOut({ callbackUrl: "/cheiz" });
  };

  // ━━━ 로딩 — 스켈레톤 UI ━━━
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 max-w-md mx-auto animate-pulse">
        <div className="bg-white px-5 pt-12 pb-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-[18px] bg-gray-200 rounded w-32" />
              <div className="h-3 bg-gray-200 rounded w-48" />
            </div>
          </div>
        </div>
        <div className="bg-white mt-2 px-5 py-4 flex gap-3">
          {[1,2,3].map(i => <div key={i} className="h-11 bg-gray-200 rounded-xl flex-1" />)}
        </div>
        <div className="bg-white mt-2 px-5 py-4 space-y-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="flex items-center justify-between">
              <div className="h-4 bg-gray-200 rounded w-28" />
              <div className="h-4 w-4 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-sm w-full text-center">
          <div className="text-6xl mb-6">🔒</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-3">로그인이 필요합니다</h1>
          <p className="text-gray-500 mb-8">마이페이지를 이용하려면 로그인해주세요.</p>
          <button onClick={() => router.push("/auth/signin?callbackUrl=/cheiz/mypage")}
            className="w-full bg-cheiz-primary text-white font-bold py-4 rounded-2xl hover:bg-opacity-90 transition-all shadow-sm active:scale-[0.98]">로그인 하기</button>
        </motion.div>
      </div>
    );
  }

  const userName = (session.user as any)?.nickname || session.user?.name || "사용자";
  const userEmail = session.user?.email || "";
  const userImage = session.user?.image || "";

  return (
    <div className="min-h-screen bg-[#FAFAF8] pb-24">
      {/* ━━━ Header + 햄버거 ━━━ */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-md mx-auto px-5 py-3 flex items-center justify-between">
          <button onClick={() => router.push("/cheiz")} className="text-gray-500 hover:text-cheiz-primary transition-colors text-sm flex items-center gap-1 active:scale-95">
            <span className="text-lg">&#8249;</span> 홈
          </button>
          <h1 className="text-sm font-bold text-gray-900">마이페이지</h1>
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen(!menuOpen)} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors active:scale-95">
              {menuOpen ? <X className="w-5 h-5 text-gray-600" /> : <Menu className="w-5 h-5 text-gray-600" />}
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div initial={{ opacity: 0, y: -8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.95 }} transition={{ duration: 0.15 }}
                  className="absolute right-0 top-12 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-[60] overflow-hidden">
                  <button onClick={() => { setMenuOpen(false); window.open("https://www.notion.so/lifeshot/1e0a8a3e31868006b02cd4b04aa37ecf", "_blank"); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100"><FileText className="w-4 h-4 text-gray-400" />서비스 이용약관</button>
                  <button onClick={() => { setMenuOpen(false); window.open("https://www.notion.so/lifeshot/1e0a8a3e318680a4b91bcdb8ce8a7af4", "_blank"); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100"><Shield className="w-4 h-4 text-gray-400" />개인정보 처리방침</button>
                  <div className="my-1 border-t border-gray-100" />
                  <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-500 hover:bg-gray-50 active:bg-gray-100"><LogOut className="w-4 h-4 text-gray-400" />로그아웃</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ━━━ 프로필 카드 ━━━ */}
      <div className="max-w-md mx-auto px-5 pt-5 pb-2">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <button onClick={() => fileInputRef.current?.click()}
              className="relative w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-cheiz-primary to-[#3377FF] flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform">
              {profileUploading ? (<Loader2 className="w-6 h-6 text-white animate-spin" />) : userImage ? (
                <img src={userImage} alt={userName} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (<User className="w-8 h-8 text-white" />)}
              <div className="absolute bottom-0 right-0 w-5 h-5 bg-white rounded-full shadow-md flex items-center justify-center border border-gray-200">
                <Camera className="w-3 h-3 text-gray-500" />
              </div>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

            <div className="flex-1 min-w-0">
              {editingNickname ? (
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <input type="text" value={nicknameInput} autoFocus
                      onChange={(e) => { setNicknameInput(e.target.value); checkNickname(e.target.value); }}
                      className="flex-1 text-lg font-bold text-gray-900 border-b-2 border-cheiz-primary bg-transparent outline-none px-0 py-1" placeholder="새 닉네임" />
                    <button onClick={saveNickname} disabled={nicknameSaving || nicknameAvailable === false || !nicknameInput.trim()}
                      className="px-3 py-1 bg-cheiz-primary text-white text-xs font-bold rounded-lg disabled:opacity-40 active:scale-95">
                      {nicknameSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    </button>
                    <button onClick={() => setEditingNickname(false)} className="px-2 py-1 text-gray-400 text-xs active:scale-95">취소</button>
                  </div>
                  {nicknameChecking && <p className="text-[10px] text-gray-400">확인 중...</p>}
                  {nicknameAvailable === true && <p className="text-[10px] text-green-600">사용 가능한 닉네임입니다</p>}
                  {nicknameAvailable === false && <p className="text-[10px] text-red-500">이미 사용 중인 닉네임입니다</p>}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-extrabold text-gray-900 truncate">{userName}</h2>
                  <button onClick={() => { setNicknameInput(userName); setEditingNickname(true); setNicknameAvailable(null); }}
                    className="p-1 rounded-lg hover:bg-gray-100 transition-colors active:scale-95"><Pencil className="w-3.5 h-3.5 text-gray-400" /></button>
                </div>
              )}
              {userEmail && <p className="text-sm text-gray-400 truncate mt-0.5">{userEmail}</p>}
            </div>
          </div>

          {/* 언어 설정 — 전용 페이지 링크 */}
          <button
            onClick={() => router.push("/cheiz/mypage/language")}
            className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between w-full hover:bg-gray-50 rounded-lg transition-colors -mx-1 px-1"
          >
            <div className="flex items-center gap-2 text-sm text-gray-500"><Globe className="w-4 h-4" /><span>언어</span></div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">
                {language === "ko" ? "한국어" : language === "en" ? "English" : "日本語"}
              </span>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </div>
          </button>
        </motion.div>
      </div>

      {/* ━━━ 상단 가로형 3버튼 (나의 예약 / 앨범 / 쿠폰) ━━━ */}
      <div className="max-w-md mx-auto px-5 py-2">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="grid grid-cols-3 gap-2.5">
          <button onClick={() => router.push("/cheiz/my-tours")}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3.5 text-center active:scale-95 transition-transform hover:shadow-md">
            <div className="w-9 h-9 mx-auto mb-1.5 rounded-xl bg-cheiz-primary/10 flex items-center justify-center">
              <FolderOpen className="w-4.5 h-4.5 text-cheiz-primary" />
            </div>
            <p className="text-lg font-bold text-gray-900">{tourCount}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">나의 예약</p>
          </button>
          <button onClick={() => router.push("/cheiz/albums")}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3.5 text-center active:scale-95 transition-transform hover:shadow-md relative">
            <div className="w-9 h-9 mx-auto mb-1.5 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Image className="w-4.5 h-4.5 text-emerald-600" />
            </div>
            <p className="text-lg font-bold text-gray-900">{albumCount}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">앨범</p>
            {albumCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                {albumCount > 99 ? "99+" : albumCount}
              </span>
            )}
          </button>
          <button onClick={() => router.push("/cheiz/coupons")}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3.5 text-center active:scale-95 transition-transform hover:shadow-md">
            <div className="w-9 h-9 mx-auto mb-1.5 rounded-xl bg-amber-50 flex items-center justify-center">
              <Ticket className="w-4.5 h-4.5 text-amber-500" />
            </div>
            <p className="text-lg font-bold text-gray-900">{couponCount}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">쿠폰</p>
          </button>
        </motion.div>
      </div>

      {/* 보유 크레딧은 쿠폰함 전용 페이지로 이동 → 마이페이지에서 제거 */}

      {/* ━━━ 지원 메뉴 ━━━ */}
      <div className="max-w-md mx-auto px-5 py-2">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <button onClick={() => window.open("https://pf.kakao.com/_ZxoMxnG", "_blank")}
            className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors active:bg-gray-100">
            <div className="w-9 h-9 rounded-lg bg-[#FEE500] flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-5 h-5 text-[#3C1E1E]" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-semibold text-gray-900">고객센터</p>
              <p className="text-xs text-gray-400 mt-0.5">카카오톡 1:1 상담</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
          </button>
        </motion.div>
      </div>

      <div className="max-w-md mx-auto px-5 py-6 text-center space-y-3">
        <p className="text-xs text-gray-300">CHEIZ v1.0.0</p>
        <button onClick={openWithdrawal}
          className="text-[11px] text-gray-300 hover:text-gray-400 transition-colors underline underline-offset-2">
          회원탈퇴
        </button>
      </div>

      {/* ━━━ 회원탈퇴 모달 ━━━ */}
      <AnimatePresence>
        {withdrawalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-end justify-center sm:items-center p-0 sm:p-6"
            onClick={(e) => { if (e.target === e.currentTarget) setWithdrawalOpen(false); }}>
            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">회원 탈퇴</h3>
                <button onClick={() => setWithdrawalOpen(false)} className="p-2 rounded-xl hover:bg-gray-100 active:scale-95"><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <p className="text-sm text-gray-600 mb-4">탈퇴 사유를 선택해주세요. (복수 선택 가능)</p>
              <div className="space-y-2 mb-4">
                {withdrawalReasons.map((reason) => (
                  <button key={reason} onClick={() => setSelectedReasons(prev => prev.includes(reason) ? prev.filter(r => r !== reason) : [...prev, reason])}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all active:scale-[0.98] ${selectedReasons.includes(reason) ? "bg-red-50 border-2 border-red-200 text-red-700 font-medium" : "bg-gray-50 border-2 border-transparent text-gray-600 hover:bg-gray-100"}`}>
                    {selectedReasons.includes(reason) ? "✓ " : ""}{reason}
                  </button>
                ))}
              </div>
              {/* "기타" 선택 시 상세 사유 입력 (5글자 이상 필수) */}
              <AnimatePresence>
                {isOtherSelected && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    className="mb-4 overflow-hidden">
                    <textarea value={customReason} onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="구체적인 사유를 입력해주세요 (5글자 이상)"
                      rows={3}
                      className={`w-full px-4 py-3 rounded-xl text-sm border-2 resize-none outline-none transition-colors ${
                        customReason.trim().length > 0 && customReason.trim().length < 5
                          ? "border-red-300 bg-red-50/50 focus:border-red-400"
                          : customReason.trim().length >= 5
                          ? "border-green-300 bg-green-50/50 focus:border-green-400"
                          : "border-gray-200 bg-gray-50 focus:border-gray-300"
                      }`} />
                    <p className={`text-[10px] mt-1 ${
                      customReason.trim().length > 0 && customReason.trim().length < 5
                        ? "text-red-500" : "text-gray-400"
                    }`}>
                      {customReason.trim().length}/5글자 이상 {customReason.trim().length >= 5 ? "✓" : "필수"}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="bg-red-50 rounded-xl p-4 mb-6">
                <p className="text-xs text-red-600 font-medium">탈퇴 시 모든 데이터가 영구 삭제되며 복구할 수 없습니다.</p>
                <p className="text-xs text-red-400 mt-1">보유 크레딧, 쿠폰, 예약 내역이 모두 사라집니다.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setWithdrawalOpen(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 active:scale-[0.98]">취소</button>
                <button onClick={executeWithdrawal} disabled={withdrawing || !canWithdraw}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-bold disabled:opacity-40 hover:bg-red-600 active:scale-[0.98] flex items-center justify-center gap-2">
                  {withdrawing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
                  {withdrawing ? "처리 중..." : "탈퇴하기"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ━━━ 토스트 ━━━ */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm font-medium px-6 py-3 rounded-full shadow-xl z-[110]">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
