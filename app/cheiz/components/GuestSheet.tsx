"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus, Users, Camera, Loader2 } from "lucide-react";
import { useState } from "react";
import {
  useReservationStore,
  type GuestCount,
  type PersonaCategory,
  PERSONA_OPTIONS,
} from "@/lib/reservation-store";

type GuestSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (count: GuestCount) => void;
};

export default function GuestSheet({ isOpen, onClose, onConfirm }: GuestSheetProps) {
  const { guestCount, persona, setPersona } = useReservationStore();
  const [adults, setAdults] = useState(guestCount.adults);
  const [selectedPersona, setSelectedPersona] = useState<PersonaCategory>(persona);
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = () => {
    setConfirming(true);
    setPersona(selectedPersona);
    onConfirm({ adults, children: 0 });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-[100]"
          />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-[101] max-h-[80vh] overflow-auto"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            {/* Header */}
            <div className="px-6 pt-3 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-[#0055FF]" />
                <h3 className="text-lg font-bold text-gray-900">예약 정보</h3>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* 촬영 인원 */}
            <div className="px-6 pb-2">
              <div className="flex items-center justify-between py-4">
                <div>
                  <p className="font-semibold text-gray-900">촬영 인원</p>
                  <p className="text-xs text-gray-400">함께 촬영할 총 인원을 선택해주세요</p>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setAdults(Math.max(1, adults - 1))}
                    disabled={adults <= 1}
                    className={`w-9 h-9 rounded-full flex items-center justify-center border transition-colors ${
                      adults <= 1
                        ? "border-gray-200 text-gray-300 cursor-not-allowed"
                        : "border-gray-300 text-gray-600 hover:border-[#0055FF] hover:text-[#0055FF]"
                    }`}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-lg font-bold w-6 text-center text-gray-900">
                    {adults}
                  </span>
                  <button
                    onClick={() => setAdults(Math.min(10, adults + 1))}
                    disabled={adults >= 10}
                    className={`w-9 h-9 rounded-full flex items-center justify-center border transition-colors ${
                      adults >= 10
                        ? "border-gray-200 text-gray-300 cursor-not-allowed"
                        : "border-gray-300 text-gray-600 hover:border-[#0055FF] hover:text-[#0055FF]"
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* 카테고리 (페르소나) */}
            <div className="px-6 pb-4">
              <p className="font-semibold text-gray-900 mb-1">촬영 유형</p>
              <p className="text-xs text-gray-400 mb-3">촬영 스타일에 맞는 유형을 선택해주세요</p>
              <div className="grid grid-cols-4 gap-2">
                {PERSONA_OPTIONS.map((opt) => {
                  const isActive = selectedPersona === opt.value;
                  return (
                    <motion.button
                      key={opt.value}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedPersona(opt.value)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-all ${
                        isActive
                          ? "border-[#0055FF] bg-blue-50 shadow-sm"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <span className="text-2xl">{opt.emoji}</span>
                      <span
                        className={`text-xs font-semibold ${
                          isActive ? "text-[#0055FF]" : "text-gray-600"
                        }`}
                      >
                        {opt.label}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Summary + CTA */}
            <div className="px-6 pb-8 pt-2">
              <div className="flex items-center justify-center gap-3 mb-4 text-sm text-gray-500">
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  <span>
                    <strong className="text-gray-900">{adults}명</strong>
                  </span>
                </div>
                <span className="text-gray-300">|</span>
                <span>
                  {PERSONA_OPTIONS.find((o) => o.value === selectedPersona)?.emoji}{" "}
                  <strong className="text-gray-900">
                    {PERSONA_OPTIONS.find((o) => o.value === selectedPersona)?.label}
                  </strong>
                </span>
              </div>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleConfirm}
                disabled={confirming}
                className={`w-full py-4 rounded-2xl font-bold text-base shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 ${
                  confirming ? "bg-[#0044CC] text-white/80" : "bg-[#0055FF] text-white"
                }`}
              >
                {confirming ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    이동 중...
                  </>
                ) : (
                  <>{adults}명 · {PERSONA_OPTIONS.find((o) => o.value === selectedPersona)?.label} 예약하기</>
                )}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
