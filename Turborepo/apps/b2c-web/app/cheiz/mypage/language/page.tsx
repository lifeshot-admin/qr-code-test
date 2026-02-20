"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, Loader2, Globe } from "lucide-react";

const LANGUAGES = [
  { code: "ko", label: "한국어", native: "Korean", flag: "🇰🇷" },
  { code: "en", label: "English", native: "영어", flag: "🇺🇸" },
  { code: "ja", label: "日本語", native: "일본어", flag: "🇯🇵" },
] as const;

type LangCode = (typeof LANGUAGES)[number]["code"];

export default function LanguageSettingsPage() {
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();
  const [selected, setSelected] = useState<LangCode>("ko");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const userLan = (session?.user as any)?.lan;
    if (userLan && ["ko", "en", "ja"].includes(userLan)) {
      setSelected(userLan as LangCode);
    }
  }, [session]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const handleSelect = async (lang: LangCode) => {
    if (lang === selected || saving) return;
    setSelected(lang);
    setSaving(true);
    try {
      const res = await fetch("/api/backend/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: lang }),
      });
      const data = await res.json();
      if (data.success) {
        await updateSession({ lan: lang });
        const label = LANGUAGES.find((l) => l.code === lang)?.label || lang;
        showToast(`언어가 ${label}(으)로 변경되었습니다.`);
        setTimeout(() => router.back(), 800);
      } else {
        showToast("언어 변경에 실패했습니다.");
      }
    } catch {
      showToast("오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-md mx-auto px-5 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors active:scale-95"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-sm font-bold text-gray-900 flex-1">언어 설정</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto px-5 pt-6 pb-24">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="w-4 h-4 text-gray-400" />
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Language
          </p>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          서비스에서 사용할 언어를 선택해주세요.
        </p>

        <div className="space-y-2.5">
          {LANGUAGES.map((lang, i) => {
            const isActive = selected === lang.code;
            return (
              <motion.button
                key={lang.code}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => handleSelect(lang.code)}
                disabled={saving}
                className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 transition-all active:scale-[0.98] ${
                  isActive
                    ? "border-cheiz-primary bg-blue-50/50 shadow-sm"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <span className="text-3xl">{lang.flag}</span>
                <div className="flex-1 text-left">
                  <p
                    className={`text-base font-bold ${
                      isActive ? "text-cheiz-primary" : "text-gray-900"
                    }`}
                  >
                    {lang.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{lang.native}</p>
                </div>
                {isActive && !saving && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-7 h-7 rounded-full bg-cheiz-primary flex items-center justify-center"
                  >
                    <Check className="w-4 h-4 text-white" />
                  </motion.div>
                )}
                {isActive && saving && (
                  <Loader2 className="w-5 h-5 text-cheiz-primary animate-spin" />
                )}
              </motion.button>
            );
          })}
        </div>

        <p className="text-xs text-gray-400 mt-6 text-center">
          언어 변경 시 자동으로 이전 페이지로 돌아갑니다.
        </p>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm font-medium px-6 py-3 rounded-full shadow-xl z-[110]"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
