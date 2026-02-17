"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

type RewardEvent = {
  _id: string;
  title: string;
  subtitle?: string;
  credit_type: "PHOTO" | "AI" | "RETOUCH";
  credit_amount: number;
  image?: string;
  badge?: string;
  active: boolean;
  mission_type: "CLICK" | "PARTNER";
  gift_id?: number;
  target_url?: string;
  main_image?: string;
  benefit_desc?: string;
  content_detail?: string;
  condition_desc?: string;
  button_text?: string;
  sort_order?: number;
};

const CREDIT_TYPE_LABELS: Record<string, string> = {
  PHOTO: "사진 크레딧",
  AI: "AI 크레딧",
  RETOUCH: "리터치 크레딧",
};

const CREDIT_TYPE_COLORS: Record<string, string> = {
  PHOTO: "bg-blue-100 text-blue-700",
  AI: "bg-purple-100 text-purple-700",
  RETOUCH: "bg-pink-100 text-pink-700",
};

const EMPTY_FORM: Partial<RewardEvent> = {
  title: "",
  subtitle: "",
  credit_type: "PHOTO",
  credit_amount: 1,
  image: "",
  badge: "",
  active: true,
  mission_type: "CLICK",
  target_url: "",
  main_image: "",
  benefit_desc: "",
  content_detail: "",
  condition_desc: "",
  button_text: "참여하기",
  sort_order: 0,
};

export default function EventsAdminPage() {
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
      if (editId) {
        await fetch("/api/admin/events", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editId, ...form }),
        });
      } else {
        await fetch("/api/admin/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      setShowForm(false);
      setEditId(null);
      setForm(EMPTY_FORM);
      await fetchData();
    } catch (e) {
      console.error("저장 실패:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (evt: RewardEvent) => {
    setEditId(evt._id);
    setForm({
      title: evt.title,
      subtitle: evt.subtitle,
      credit_type: evt.credit_type,
      credit_amount: evt.credit_amount,
      image: evt.image,
      badge: evt.badge,
      active: evt.active,
      mission_type: evt.mission_type,
      target_url: evt.target_url,
      main_image: evt.main_image,
      benefit_desc: evt.benefit_desc,
      content_detail: evt.content_detail,
      condition_desc: evt.condition_desc,
      button_text: evt.button_text,
      sort_order: evt.sort_order,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    try {
      await fetch(`/api/admin/events?id=${id}`, { method: "DELETE" });
      await fetchData();
    } catch (e) {
      console.error("삭제 실패:", e);
    }
  };

  const handleToggleActive = async (evt: RewardEvent) => {
    try {
      await fetch("/api/admin/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: evt._id, active: !evt.active }),
      });
      await fetchData();
    } catch (e) {
      console.error("토글 실패:", e);
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
          <p className="text-sm text-gray-500 mt-1">Bubble DB reward_event 테이블</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY_FORM); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> 새 이벤트
        </button>
      </div>

      {/* 이벤트 목록 */}
      {events.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg mb-2">등록된 이벤트가 없습니다</p>
          <p className="text-sm">Bubble DB에 reward_event 테이블을 생성하고 데이터를 추가하세요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((evt) => (
            <div key={evt._id} className={`bg-white border rounded-xl p-4 flex items-center gap-4 transition-all ${evt.active ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
              {evt.image && (
                <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                  <img src={evt.image} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900 truncate">{evt.title}</h3>
                  {evt.badge && <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">{evt.badge}</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${CREDIT_TYPE_COLORS[evt.credit_type] || "bg-gray-100 text-gray-600"}`}>
                    {CREDIT_TYPE_LABELS[evt.credit_type] || evt.credit_type}
                  </span>
                </div>
                <p className="text-sm text-gray-500 truncate">{evt.subtitle}</p>
                <p className="text-xs text-gray-400 mt-1">+{evt.credit_amount} 크레딧 · {evt.mission_type}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => handleToggleActive(evt)} className="p-2 hover:bg-gray-100 rounded-lg" title={evt.active ? "비활성화" : "활성화"}>
                  {evt.active ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                </button>
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

      {/* 생성/수정 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-6">{editId ? "이벤트 수정" : "새 이벤트 등록"}</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">제목 *</label>
                  <input
                    value={form.title || ""}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    placeholder="환영 선물"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">부제목</label>
                  <input
                    value={form.subtitle || ""}
                    onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    placeholder="첫 가입 축하 크레딧"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">크레딧 타입</label>
                  <select
                    value={form.credit_type || "PHOTO"}
                    onChange={(e) => setForm({ ...form, credit_type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="PHOTO">사진 크레딧</option>
                    <option value="AI">AI 크레딧</option>
                    <option value="RETOUCH">리터치 크레딧</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">크레딧 수량</label>
                  <input
                    type="number"
                    value={form.credit_amount || 1}
                    onChange={(e) => setForm({ ...form, credit_amount: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    min={1}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">미션 타입</label>
                  <select
                    value={form.mission_type || "CLICK"}
                    onChange={(e) => setForm({ ...form, mission_type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="CLICK">클릭형</option>
                    <option value="PARTNER">파트너형</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">썸네일 이미지 URL</label>
                  <input
                    value={form.image || ""}
                    onChange={(e) => setForm({ ...form, image: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">메인 이미지 URL</label>
                  <input
                    value={form.main_image || ""}
                    onChange={(e) => setForm({ ...form, main_image: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">뱃지 텍스트</label>
                  <input
                    value={form.badge || ""}
                    onChange={(e) => setForm({ ...form, badge: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    placeholder="HOT"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">대상 URL</label>
                  <input
                    value={form.target_url || ""}
                    onChange={(e) => setForm({ ...form, target_url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    placeholder="/cheiz/..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">혜택 설명</label>
                <textarea
                  value={form.benefit_desc || ""}
                  onChange={(e) => setForm({ ...form, benefit_desc: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상세 내용</label>
                <textarea
                  value={form.content_detail || ""}
                  onChange={(e) => setForm({ ...form, content_detail: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">참여 조건</label>
                  <textarea
                    value={form.condition_desc || ""}
                    onChange={(e) => setForm({ ...form, condition_desc: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">버튼 텍스트</label>
                  <input
                    value={form.button_text || ""}
                    onChange={(e) => setForm({ ...form, button_text: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    placeholder="참여하기"
                  />
                  <label className="block text-sm font-medium text-gray-700 mb-1 mt-3">정렬 순서</label>
                  <input
                    type="number"
                    value={form.sort_order || 0}
                    onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
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
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
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
