"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, Trash2, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useModal } from "@/components/GlobalModal";

type RewardEvent = {
  _id: string;
  title: string;
  subtitle?: string;
  badge_text?: string;
  benefit_desc?: string;
  conditions?: string;
  cta_text?: string;
  description?: string;
  image_url?: string;
  reward_amount: number;
  reward_type: string;
  sort_order: number;
  target_url?: string;
  thumbnail_url?: string;
  promotion?: string;
  expire_date?: string;
};

const REWARD_TYPE_LABELS: Record<string, string> = {
  PHOTO: "사진 크레딧",
  AI: "AI 크레딧",
  RETOUCH: "리터치 크레딧",
};

const REWARD_TYPE_COLORS: Record<string, string> = {
  PHOTO: "bg-blue-100 text-blue-700",
  AI: "bg-cheiz-primary/10 text-cheiz-dark",
  RETOUCH: "bg-pink-100 text-pink-700",
};

const EMPTY_FORM: Partial<RewardEvent> = {
  title: "",
  subtitle: "",
  badge_text: "",
  benefit_desc: "",
  conditions: "",
  cta_text: "참여하기",
  description: "",
  image_url: "",
  reward_amount: 1,
  reward_type: "PHOTO",
  sort_order: 0,
  target_url: "",
  thumbnail_url: "",
  promotion: "no",
  expire_date: "",
};

export default function EventsAdminPage() {
  const { showConfirm, showSuccess, showError } = useModal();
  const [events, setEvents] = useState<RewardEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<RewardEvent>>(EMPTY_FORM);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/events");
      const json = await res.json();
      setEvents(json.data || []);
    } catch (e) {
      console.error("이벤트 목록 조회 실패:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        title: form.title || "",
        subtitle: form.subtitle || "",
        badge_text: form.badge_text || "",
        benefit_desc: form.benefit_desc || "",
        conditions: form.conditions || "",
        cta_text: form.cta_text || "참여하기",
        description: form.description || "",
        image_url: form.image_url || "",
        reward_amount: Number(form.reward_amount) || 0,
        reward_type: form.reward_type || "PHOTO",
        sort_order: Number(form.sort_order) || 0,
        target_url: form.target_url || "",
        thumbnail_url: form.thumbnail_url || "",
        promotion: form.promotion || "no",
        expire_date: form.expire_date || "",
      };

      const method = editId ? "PATCH" : "POST";
      const body = editId ? { id: editId, ...payload } : payload;

      const res = await fetch("/api/admin/events", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `HTTP ${res.status}`);
      }

      setShowForm(false);
      setEditId(null);
      setForm(EMPTY_FORM);
      await fetchData();
      showSuccess(editId ? "이벤트가 수정되었습니다." : "이벤트가 등록되었습니다.");
    } catch (e: any) {
      console.error("저장 실패:", e);
      showError(`이벤트 등록에 실패했습니다.\n${e?.message || "다시 시도해주세요."}`, { showKakaoLink: true });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (evt: RewardEvent) => {
    setEditId(evt._id);
    setForm({
      title: evt.title,
      subtitle: evt.subtitle,
      badge_text: evt.badge_text,
      benefit_desc: evt.benefit_desc,
      conditions: evt.conditions,
      cta_text: evt.cta_text,
      description: evt.description,
      image_url: evt.image_url,
      reward_amount: evt.reward_amount,
      reward_type: evt.reward_type,
      sort_order: evt.sort_order,
      target_url: evt.target_url,
      thumbnail_url: evt.thumbnail_url,
      promotion: evt.promotion || "no",
      expire_date: evt.expire_date || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await showConfirm("정말 삭제하시겠습니까?", { title: "이벤트 삭제", confirmText: "삭제", cancelText: "취소" });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/admin/events?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      await fetchData();
      showSuccess("이벤트가 삭제되었습니다.");
    } catch (e) {
      console.error("삭제 실패:", e);
      showError("이벤트 삭제에 실패했습니다.");
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
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
          <h1 className="text-2xl font-bold text-gray-900">이벤트 & 미션 관리</h1>
          <p className="text-sm text-gray-500 mt-1">Bubble DB reward_event 테이블 · 13개 필드</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY_FORM); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-cheiz-primary text-white rounded-lg hover:bg-cheiz-dark transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> 새 이벤트
        </button>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg mb-2">등록된 이벤트가 없습니다</p>
          <p className="text-sm">위의 &apos;새 이벤트&apos; 버튼을 눌러 이벤트를 추가하세요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((evt) => (
            <div key={evt._id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 transition-all">
              {evt.image_url && (
                <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                  <img src={evt.image_url} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900 truncate">{evt.title}</h3>
                  {evt.badge_text && <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">{evt.badge_text}</span>}
                  {evt.promotion === "yes" && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">프로모션</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${REWARD_TYPE_COLORS[evt.reward_type] || "bg-gray-100 text-gray-600"}`}>
                    {REWARD_TYPE_LABELS[evt.reward_type] || evt.reward_type}
                  </span>
                </div>
                <p className="text-sm text-gray-500 truncate">{evt.subtitle || "—"}</p>
                <p className="text-xs text-gray-400 mt-1">
                  +{evt.reward_amount} 크레딧 · 순서: {evt.sort_order}
                  {evt.expire_date && ` · 마감: ${evt.expire_date.slice(0, 10)}`}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => handleEdit(evt)} className="p-2 hover:bg-gray-100 rounded-lg" title="수정">
                  <Edit2 className="w-4 h-4 text-gray-500" />
                </button>
                <button onClick={() => handleDelete(evt._id)} className="p-2 hover:bg-red-50 rounded-lg" title="삭제">
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 생성/수정 모달 — 버블 DB reward_event 13개 필드 완전 매칭 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-6">{editId ? "이벤트 수정" : "새 이벤트 등록"}</h2>

            <div className="space-y-4">
              {/* 제목 / 부제목 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">제목 (title) *</label>
                  <input
                    value={form.title || ""}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-cheiz-primary"
                    placeholder="환영 선물"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">부제목 (subtitle)</label>
                  <input
                    value={form.subtitle || ""}
                    onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-cheiz-primary"
                    placeholder="첫 가입 축하 크레딧"
                  />
                </div>
              </div>

              {/* 리워드 타입 / 리워드 수량 / 정렬 순서 */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">리워드 타입 (reward_type)</label>
                  <select
                    value={form.reward_type || "PHOTO"}
                    onChange={(e) => setForm({ ...form, reward_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-cheiz-primary"
                  >
                    <option value="PHOTO">사진 크레딧</option>
                    <option value="AI">AI 크레딧</option>
                    <option value="RETOUCH">리터치 크레딧</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">리워드 수량 (reward_amount)</label>
                  <input
                    type="number"
                    value={form.reward_amount ?? 1}
                    onChange={(e) => setForm({ ...form, reward_amount: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-cheiz-primary"
                    min={0}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">정렬 순서 (sort_order)</label>
                  <input
                    type="number"
                    value={form.sort_order ?? 0}
                    onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-cheiz-primary"
                    min={0}
                  />
                </div>
              </div>

              {/* 프로모션 / 마감일 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">시즌 프로모션 (promotion)</label>
                  <div className="flex items-center gap-3 mt-1">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, promotion: form.promotion === "yes" ? "no" : "yes" })}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                        form.promotion === "yes" ? "bg-green-500" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow ${
                          form.promotion === "yes" ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                    <span className={`text-sm font-medium ${form.promotion === "yes" ? "text-green-600" : "text-gray-500"}`}>
                      {form.promotion === "yes" ? "Yes" : "No"}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">마감일 (expire_date)</label>
                  <input
                    type="date"
                    value={form.expire_date ? form.expire_date.slice(0, 10) : ""}
                    onChange={(e) => setForm({ ...form, expire_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-cheiz-primary"
                  />
                </div>
              </div>

              {/* 이미지 URL / 썸네일 URL */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">이미지 URL (image_url)</label>
                  <input
                    value={form.image_url || ""}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-cheiz-primary"
                    placeholder="https://..."
                  />
                  {form.image_url && (
                    <div className="mt-1 w-full h-20 rounded bg-gray-50 overflow-hidden">
                      <img src={form.image_url} alt="미리보기" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">썸네일 URL (thumbnail_url)</label>
                  <input
                    value={form.thumbnail_url || ""}
                    onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-cheiz-primary"
                    placeholder="https://..."
                  />
                  {form.thumbnail_url && (
                    <div className="mt-1 w-full h-20 rounded bg-gray-50 overflow-hidden">
                      <img src={form.thumbnail_url} alt="썸네일" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              {/* 뱃지 텍스트 / 대상 URL */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">뱃지 텍스트 (badge_text)</label>
                  <input
                    value={form.badge_text || ""}
                    onChange={(e) => setForm({ ...form, badge_text: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-cheiz-primary"
                    placeholder="HOT, NEW 등"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">대상 URL (target_url)</label>
                  <input
                    value={form.target_url || ""}
                    onChange={(e) => setForm({ ...form, target_url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-cheiz-primary"
                    placeholder="/cheiz/..."
                  />
                </div>
              </div>

              {/* CTA 텍스트 / 혜택 설명 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">버튼 텍스트 (cta_text)</label>
                  <input
                    value={form.cta_text || ""}
                    onChange={(e) => setForm({ ...form, cta_text: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-cheiz-primary"
                    placeholder="참여하기"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">혜택 설명 (benefit_desc)</label>
                  <input
                    value={form.benefit_desc || ""}
                    onChange={(e) => setForm({ ...form, benefit_desc: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-cheiz-primary"
                    placeholder="사진 크레딧 3장 지급"
                  />
                </div>
              </div>

              {/* 상세 설명 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상세 내용 (description)</label>
                <textarea
                  value={form.description || ""}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-cheiz-primary"
                  placeholder="이벤트에 대한 상세 설명을 입력하세요"
                />
              </div>

              {/* 참여 조건 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">참여 조건 (conditions)</label>
                <textarea
                  value={form.conditions || ""}
                  onChange={(e) => setForm({ ...form, conditions: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-cheiz-primary"
                  placeholder="예: 신규 가입 회원만 참여 가능"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t">
              <button
                onClick={() => { setShowForm(false); setEditId(null); setForm(EMPTY_FORM); }}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.title}
                className="flex-1 py-2.5 bg-cheiz-primary text-white rounded-lg text-sm font-medium hover:bg-cheiz-dark disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editId ? "수정 저장" : "등록"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
