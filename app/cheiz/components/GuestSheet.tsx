"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus, Users, Camera, Loader2, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
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
  const [selectedPersona, setSelectedPersona] = useState<PersonaCategory | null>(persona);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAdults(guestCount.adults);
      setSelectedPersona(persona);
      setConfirming(false);
    }
  }, [isOpen, guestCount.adults, persona]);

  const canConfirm = adults >= 1 && selectedPersona !== null;

  const handleConfirm = () => {
    if (!canConfirm) return;
    setConfirming(true);
    setPersona(selectedPersona);
    onConfirm({ adults, children: 0 });
  };

  const selectedOption = PERSONA_OPTIONS.find((o) => o.value === selectedPersona);

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
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-[101] max-h-[85vh] overflow-auto"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            {/* Header */}
            <div className="px-6 pt-3 pb-2 flex items-center justify-between">
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
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">촬영 인원</p>
                  <p className="text-xs text-gray-400 mt-0.5">함께 촬영할 총 인원을 선택해주세요</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setAdults(Math.max(0, adults - 1))}
                    disabled={adults <= 0}
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                      adults <= 0
                        ? "border-gray-200 text-gray-300 cursor-not-allowed"
                        : "border-gray-300 text-gray-600 hover:border-[#0055FF] hover:text-[#0055FF] active:scale-90"
                    }`}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span
                    className={`text-2xl font-bold w-8 text-center tabular-nums transition-colors ${
                      adults === 0 ? "text-gray-300" : "text-gray-900"
                    }`}
                  >
                    {adults}
                  </span>
                  <button
                    onClick={() => setAdults(Math.min(10, adults + 1))}
                    disabled={adults >= 10}
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                      adults >= 10
                        ? "border-gray-200 text-gray-300 cursor-not-allowed"
                        : "border-gray-300 text-gray-600 hover:border-[#0055FF] hover:text-[#0055FF] active:scale-90"
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {adults === 0 && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-amber-500 mt-2 flex items-center gap-1"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  인원을 1명 이상 선택해주세요
                </motion.p>
              )}
            </div>

            {/* 촬영 유형 (페르소나) */}
            <div className="px-6 py-4">
              <p className="font-semibold text-gray-900 mb-1">촬영 유형</p>
              <p className="text-xs text-gray-400 mb-4">촬영 스타일에 맞는 유형을 선택해주세요</p>
              <div className="grid grid-cols-4 gap-2.5">
                {PERSONA_OPTIONS.map((opt) => {
                  const isActive = selectedPersona === opt.value;
                  return (
                    <motion.button
                      key={opt.value}
                      whileTap={{ scale: 0.92 }}
                      animate={isActive ? { scale: 1.03 } : { scale: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      onClick={() => setSelectedPersona(opt.value)}
                      className={`relative flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all duration-200 ${
                        isActive
                          ? "border-[#0055FF] bg-gradient-to-b from-blue-50 to-white shadow-md shadow-blue-100"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="persona-glow"
                          className="absolute inset-0 rounded-2xl bg-[#0055FF]/5"
                          transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        />
                      )}
                      <span className="text-[28px] relative z-10">{opt.emoji}</span>
                      <span
                        className={`text-[11px] font-bold relative z-10 leading-tight text-center ${
                          isActive ? "text-[#0055FF]" : "text-gray-500"
                        }`}
                      >
                        {opt.label}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
              {!selectedPersona && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-amber-500 mt-3 flex items-center gap-1"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  촬영 유형을 선택해주세요
                </motion.p>
              )}
            </div>

            {/* Summary + CTA */}
            <div className="px-6 pb-8 pt-2">
              {canConfirm ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-center gap-3 mb-4 text-sm text-gray-500"
                >
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    <strong className="text-gray-900">{adults}명</strong>
                  </div>
                  <span className="text-gray-300">|</span>
                  <span>
                    {selectedOption?.emoji}{" "}
                    <strong className="text-gray-900">{selectedOption?.label}</strong>
                  </span>
                </motion.div>
              ) : (
                <p className="text-center text-xs text-gray-400 mb-4">
                  인원과 촬영 유형을 모두 선택해주세요
                </p>
              )}
              <motion.button
                whileTap={canConfirm ? { scale: 0.98 } : {}}
                onClick={handleConfirm}
                disabled={!canConfirm || confirming}
                className={`w-full py-4 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-2 ${
                  !canConfirm
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : confirming
                    ? "bg-[#0044CC] text-white/80 shadow-lg shadow-blue-500/25"
                    : "bg-[#0055FF] text-white shadow-lg shadow-blue-500/25"
                }`}
              >
                {confirming ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    이동 중...
                  </>
                ) : canConfirm ? (
                  <>
                    {adults}명 · {selectedOption?.label} 예약하기
                  </>
                ) : (
                  "인원과 유형을 선택해주세요"
                )}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
