"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertCircle, CheckCircle, AlertTriangle, Info, MessageCircle } from "lucide-react";
import type { ErrorSeverity } from "@/lib/error-handler";

// ━━━ 카카오톡 문의 링크 ━━━
const KAKAO_CHANNEL_URL = "https://pf.kakao.com/_cheiz";

// ━━━ 타입 정의 ━━━
type ModalType = "alert" | "confirm" | "error" | "success" | "info";

interface ModalConfig {
  type: ModalType;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  showKakaoLink?: boolean;
  severity?: ErrorSeverity;
}

interface ModalContextValue {
  showAlert: (message: string, options?: Partial<ModalConfig>) => Promise<void>;
  showConfirm: (message: string, options?: Partial<ModalConfig>) => Promise<boolean>;
  showError: (message: string, options?: Partial<ModalConfig>) => Promise<void>;
  showSuccess: (message: string, options?: Partial<ModalConfig>) => Promise<void>;
}

const ModalContext = createContext<ModalContextValue | null>(null);

// ━━━ 타입별 기본 스타일 ━━━
const TYPE_CONFIG: Record<ModalType, {
  icon: typeof AlertCircle;
  iconColor: string;
  iconBg: string;
  defaultTitle: string;
  accentColor: string;
  buttonBg: string;
  buttonHover: string;
}> = {
  alert: {
    icon: AlertTriangle,
    iconColor: "text-amber-600",
    iconBg: "bg-amber-50",
    defaultTitle: "알림",
    accentColor: "border-amber-200",
    buttonBg: "bg-amber-500",
    buttonHover: "hover:bg-amber-600",
  },
  confirm: {
    icon: Info,
    iconColor: "text-cheiz-primary",
    iconBg: "bg-cheiz-surface",
    defaultTitle: "확인",
    accentColor: "border-cheiz-border",
    buttonBg: "bg-cheiz-primary",
    buttonHover: "hover:bg-cheiz-dark",
  },
  error: {
    icon: AlertCircle,
    iconColor: "text-red-500",
    iconBg: "bg-red-50",
    defaultTitle: "오류",
    accentColor: "border-red-200",
    buttonBg: "bg-red-500",
    buttonHover: "hover:bg-red-600",
  },
  success: {
    icon: CheckCircle,
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-50",
    defaultTitle: "완료",
    accentColor: "border-emerald-200",
    buttonBg: "bg-emerald-500",
    buttonHover: "hover:bg-emerald-600",
  },
  info: {
    icon: Info,
    iconColor: "text-cheiz-primary",
    iconBg: "bg-cheiz-surface",
    defaultTitle: "안내",
    accentColor: "border-cheiz-border",
    buttonBg: "bg-cheiz-primary",
    buttonHover: "hover:bg-cheiz-dark",
  },
};

// ━━━ 모달 컴포넌트 ━━━
function ModalRenderer({
  config,
  onConfirm,
  onCancel,
}: {
  config: ModalConfig;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const typeConfig = TYPE_CONFIG[config.type];
  const IconComp = typeConfig.icon;
  const title = config.title || typeConfig.defaultTitle;
  const isConfirm = config.type === "confirm";
  const showKakao = config.showKakaoLink || config.severity === "critical";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={onCancel}
    >
      {/* 배경 딤 */}
      <div className="absolute inset-0 bg-black/40" />

      {/* 모달 본체 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className={`relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden border ${typeConfig.accentColor}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 닫기 버튼 */}
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-gray-100 transition-colors z-10"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>

        {/* 컨텐츠 */}
        <div className="px-6 pt-6 pb-4">
          {/* 아이콘 */}
          <div className={`w-12 h-12 ${typeConfig.iconBg} rounded-full flex items-center justify-center mx-auto mb-4`}>
            <IconComp className={`w-6 h-6 ${typeConfig.iconColor}`} />
          </div>

          {/* 제목 */}
          <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
            {title}
          </h3>

          {/* 메시지 */}
          <p className="text-sm text-gray-600 text-center leading-relaxed whitespace-pre-line">
            {config.message}
          </p>
        </div>

        {/* 카카오톡 문의 (심각한 에러일 때) */}
        {showKakao && (
          <div className="mx-6 mb-3 p-3 bg-[#FEE500]/10 rounded-xl border border-[#FEE500]/30">
            <a
              href={KAKAO_CHANNEL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-sm font-medium text-[#3C1E1E] hover:opacity-80 transition-opacity"
            >
              <MessageCircle className="w-4 h-4" />
              카카오톡 고객센터로 문의하기
            </a>
          </div>
        )}

        {/* 버튼 영역 */}
        <div className={`px-6 pb-6 flex gap-3 ${isConfirm ? "" : "justify-center"}`}>
          {isConfirm && (
            <button
              onClick={onCancel}
              className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors"
            >
              {config.cancelText || "취소"}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`${isConfirm ? "flex-1" : "w-full"} py-3 px-4 ${typeConfig.buttonBg} text-white rounded-xl text-sm font-semibold ${typeConfig.buttonHover} transition-colors`}
          >
            {config.confirmText || "확인"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ━━━ Provider ━━━
export function GlobalModalProvider({ children }: { children: React.ReactNode }) {
  const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const openModal = useCallback((config: ModalConfig): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setModalConfig(config);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    resolveRef.current?.(true);
    resolveRef.current = null;
    setModalConfig(null);
  }, []);

  const handleCancel = useCallback(() => {
    resolveRef.current?.(false);
    resolveRef.current = null;
    setModalConfig(null);
  }, []);

  const showAlert = useCallback(async (message: string, options?: Partial<ModalConfig>) => {
    await openModal({ type: "alert", message, ...options });
  }, [openModal]);

  const showConfirm = useCallback(async (message: string, options?: Partial<ModalConfig>) => {
    return openModal({ type: "confirm", message, ...options });
  }, [openModal]);

  const showError = useCallback(async (message: string, options?: Partial<ModalConfig>) => {
    await openModal({ type: "error", message, showKakaoLink: true, ...options });
  }, [openModal]);

  const showSuccess = useCallback(async (message: string, options?: Partial<ModalConfig>) => {
    await openModal({ type: "success", message, ...options });
  }, [openModal]);

  return (
    <ModalContext.Provider value={{ showAlert, showConfirm, showError, showSuccess }}>
      {children}
      <AnimatePresence>
        {modalConfig && (
          <ModalRenderer
            config={modalConfig}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
          />
        )}
      </AnimatePresence>
    </ModalContext.Provider>
  );
}

// ━━━ 훅 ━━━
export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) {
    throw new Error("useModal must be used within GlobalModalProvider");
  }
  return ctx;
}

export function useAlert() {
  const { showAlert } = useModal();
  return showAlert;
}

export function useConfirm() {
  const { showConfirm } = useModal();
  return showConfirm;
}

export function useErrorModal() {
  const { showError } = useModal();
  return showError;
}

export function useSuccessModal() {
  const { showSuccess } = useModal();
  return showSuccess;
}
