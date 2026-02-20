"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { Loader2, FolderOpen, Users, MessageCircle } from "lucide-react";
import toast from "react-hot-toast";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";

type SelectedUser = {
  id: number;
  nickname: string;
  profileImageUrl: string;
};

function InviteConfirmContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const folderId = params?.folderId as string;

  const [users, setUsers] = useState<SelectedUser[]>([]);
  const [message, setMessage] = useState("");
  const [folderName, setFolderName] = useState("");
  const [tourName, setTourName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const myNickname = (session?.user as any)?.nickname || (session?.user as any)?.name || "";
  const myUserId = Number((session?.user as any)?.id);

  useEffect(() => {
    const usersParam = searchParams.get("users");
    if (usersParam) {
      try {
        setUsers(JSON.parse(decodeURIComponent(usersParam)));
      } catch {}
    }
  }, [searchParams]);

  useEffect(() => {
    if (!folderId) return;
    (async () => {
      try {
        const res = await fetch(`/api/backend/folder-detail?folderId=${folderId}`);
        const data = await res.json();
        if (data.success && data.folder) {
          setFolderName(data.folder.name || `폴더 #${folderId}`);
          setTourName(data.folder.name || "");
        }
      } catch {}
    })();
  }, [folderId]);

  const handleInvite = async () => {
    if (users.length === 0 || submitting) return;
    setSubmitting(true);

    try {
      const inviteRes = await fetch(`/api/backend/folders/${folderId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIdList: users.map(u => u.id),
          message: message || "",
        }),
      });

      if (!inviteRes.ok) {
        const errStatus = inviteRes.status;
        if (errStatus === 409) {
          toast.error("이미 초대된 사용자가 있습니다");
        } else if (errStatus === 403) {
          toast.error("초대 권한이 없습니다");
        } else {
          toast.error("초대에 실패했습니다");
        }
        setSubmitting(false);
        return;
      }

      // 수신자별 알림 생성
      await Promise.allSettled(
        users.map((u) =>
          fetch("/api/bubble/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_Id: u.id,
              type: "INVITE_ARRIVE",
              title: `${myNickname}님이 초대를 보냈어요`,
              body: message || "",
              link_id: Number(folderId),
              is_read: false,
            }),
          })
        )
      );

      // 발신자 알림
      const bodyText =
        users.length === 1
          ? `${users[0].nickname}님에게 전송`
          : `${users[0].nickname} 외 ${users.length - 1}명에게 전송`;

      await fetch("/api/bubble/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_Id: myUserId,
          type: "INVITE_SENT",
          title: "초대를 전송했습니다",
          body: bodyText,
          link_id: Number(folderId),
          is_read: false,
        }),
      }).catch(() => {});

      toast.success("초대를 전송했습니다");
      router.push(`/cheiz/folder/${folderId}/arrive`);
    } catch {
      toast.error("초대에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading") {
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

      <div className="max-w-md mx-auto px-5 pt-4 space-y-5">
        {/* 폴더 정보 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-cheiz-text">
            <FolderOpen className="w-5 h-5 text-cheiz-primary" />
            <span className="text-lg font-bold">폴더 이름</span>
          </div>
          <p className="text-sm text-cheiz-sub pl-7">{folderName || "투어 이름!"}</p>
        </div>

        <div className="border-t border-gray-100" />

        {/* 초대 일행 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-cheiz-primary" />
            <span className="text-sm font-bold text-cheiz-text">👫 초대 일행 {users.length}명</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {users.map((u) => (
              <div key={u.id} className="flex flex-col items-center gap-1 flex-shrink-0">
                {u.profileImageUrl ? (
                  <img src={u.profileImageUrl} alt={u.nickname} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-cheiz-surface flex items-center justify-center text-xl">
                    🧸
                  </div>
                )}
                <span className="text-xs text-cheiz-text max-w-[60px] truncate">{u.nickname}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-100" />

        {/* 초대 메시지 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-cheiz-primary" />
            <span className="text-sm font-bold text-cheiz-text">💌 초대 메시지 (선택)</span>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="초대 메시지를 입력해주세요. 초대에 대한 상세 정보와 함께 초대 메시지가 일행에게 전달됩니다."
            className="w-full h-32 border-2 border-cheiz-border rounded-2xl p-4 text-sm outline-none resize-none focus:border-cheiz-primary transition-colors placeholder:text-cheiz-sub/60"
          />
        </div>
      </div>

      {/* 하단 고정 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-md mx-auto px-5 py-4">
          <Button
            onClick={handleInvite}
            disabled={users.length === 0 || submitting}
            loading={submitting}
            className="w-full py-3.5 text-sm font-bold"
          >
            일행 초대하기
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function InviteConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-cheiz-primary animate-spin" />
        </div>
      }
    >
      <InviteConfirmContent />
    </Suspense>
  );
}
