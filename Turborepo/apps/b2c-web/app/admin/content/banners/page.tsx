"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, Trash2, GripVertical, Loader2, ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useModal } from "@/components/GlobalModal";

type HomeBanner = {
  _id: string;
  title: string;
  subtitle?: string;
  image_url: string;
  target_url?: string;
  sort_order: number;
};

const EMPTY_FORM: Partial<HomeBanner> = {
  title: "",
  subtitle: "",
  image_url: "",
  target_url: "",
  sort_order: 0,
};

export default function BannersAdminPage() {
  const { showConfirm, showSuccess, showError } = useModal();
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<HomeBanner>>(EMPTY_FORM);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/banners");
      const json = await res.json();
      setBanners(json.data || []);
    } catch (e) {
      console.error("배너 목록 조회 실패:", e);
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
        image_url: form.image_url || "",
        target_url: form.target_url || "",
        sort_order: Number(form.sort_order) || 0,
      };

      const method = editId ? "PATCH" : "POST";
      const body = editId ? { id: editId, ...payload } : payload;

      const res = await fetch("/api/admin/banners", {
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
      showSuccess(editId ? "배너가 수정되었습니다." : "배너가 등록되었습니다.");
    } catch (e: any) {
      console.error("저장 실패:", e);
      showError(`배너 저장에 실패했습니다.\n${e?.message || ""}`, { showKakaoLink: true });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (banner: HomeBanner) => {
    setEditId(banner._id);
    setForm({
      title: banner.title,
      subtitle: banner.subtitle,
      image_url: banner.image_url,
      target_url: banner.target_url,
      sort_order: banner.sort_order,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await showConfirm("정말 삭제하시겠습니까?", { title: "배너 삭제", confirmText: "삭제", cancelText: "취소" });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/admin/banners?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      await fetchData();
      showSuccess("배너가 삭제되었습니다.");
    } catch (e) {
      console.error("삭제 실패:", e);
      showError("배너 삭제에 실패했습니다.");
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
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
          <h1 className="text-2xl font-bold text-gray-900">홈 배너 관리</h1>
          <p className="text-sm text-gray-500 mt-1">Bubble DB home_banner 테이블 · 메인 슬라이더에 노출</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY_FORM); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-cheiz-primary text-white rounded-lg hover:bg-cheiz-dark transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> 새 배너
        </button>
      </div>

      {banners.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg mb-2">등록된 배너가 없습니다</p>
          <p className="text-sm">위의 &apos;새 배너&apos; 버튼을 눌러 배너를 추가하세요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map((banner, idx) => (
            <div key={banner._id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 transition-all">
              <div className="flex-shrink-0 text-gray-300">
                <GripVertical className="w-5 h-5" />
              </div>
              <div className="w-24 h-14 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                {banner.image_url ? (
                  <img src={banner.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">No Image</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">#{idx + 1}</span>
                  <h3 className="font-semibold text-gray-900 truncate">{banner.title || "(제목 없음)"}</h3>
                </div>
                <p className="text-sm text-gray-500 truncate">{banner.subtitle || "—"}</p>
                {banner.target_url && (
                  <div className="flex items-center gap-1 mt-1">
                    <ExternalLink className="w-3 h-3 text-cheiz-primary" />
                    <span className="text-xs text-cheiz-primary truncate">{banner.target_url}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => handleEdit(banner)} className="p-2 hover:bg-gray-100 rounded-lg" title="수정">
                  <Edit2 className="w-4 h-4 text-gray-500" />
                </button>
                <button onClick={() => handleDelete(banner._id)} className="p-2 hover:bg-red-50 rounded-lg" title="삭제">
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
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-6">{editId ? "배너 수정" : "새 배너 등록"}</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제목 (title) *</label>
                <input
                  value={form.title || ""}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-cheiz-primary"
                  placeholder="후지산과 벚꽃"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">부제목 (subtitle)</label>
                <input
                  value={form.subtitle || ""}
                  onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-cheiz-primary"
                  placeholder="봄의 아름다움을 담아보세요"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이미지 URL (image_url) *</label>
                <input
                  value={form.image_url || ""}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-cheiz-primary"
                  placeholder="https://..."
                />
                {form.image_url && (
                  <div className="mt-2 w-full h-32 rounded-lg overflow-hidden bg-gray-50">
                    <img src={form.image_url} alt="미리보기" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">연결 링크 (target_url)</label>
                <input
                  value={form.target_url || ""}
                  onChange={(e) => setForm({ ...form, target_url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-cheiz-primary"
                  placeholder="/cheiz/events 또는 https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">노출 순서 (sort_order)</label>
                <input
                  type="number"
                  value={form.sort_order ?? 0}
                  onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-cheiz-primary"
                  min={0}
                />
                <p className="text-xs text-gray-400 mt-1">숫자가 작을수록 앞에 표시됩니다</p>
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
                disabled={saving || !form.title || !form.image_url}
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
