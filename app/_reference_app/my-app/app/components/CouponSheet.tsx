"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, Ticket, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface CouponSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CouponSheet({ isOpen, onClose }: CouponSheetProps) {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [showCalendar, setShowCalendar] = useState(false);
  const [reservationNumber, setReservationNumber] = useState("");
  const [step, setStep] = useState<"input" | "success">("input");
  const [couponCode, setCouponCode] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCheck = () => {
    if (date && reservationNumber.length === 4) {
      // Generate random 6-digit coupon code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setCouponCode(code);
      setStep("success");
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(couponCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setStep("input");
    setDate(undefined);
    setReservationNumber("");
    setShowCalendar(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/50 z-50"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 max-h-[90vh] overflow-auto"
          >
            <div className="p-6">
              {/* Handle */}
              <div className="flex justify-center mb-4">
                <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-[#1A1A1A]">
                  {step === "input" ? "내 쿠폰 확인하기" : "쿠폰 확인 완료!"}
                </h2>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              {step === "input" ? (
                <div className="space-y-6">
                  {/* Date Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      촬영 일정 선택
                    </label>
                    <button
                      onClick={() => setShowCalendar(!showCalendar)}
                      className="w-full flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:border-[#0055FF] transition-colors"
                    >
                      <div className="w-10 h-10 rounded-lg bg-[#0055FF]/10 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-[#0055FF]" />
                      </div>
                      <span className="text-[#1A1A1A]">
                        {date
                          ? format(date, "yyyy년 MM월 dd일", { locale: ko })
                          : "날짜를 선택해주세요"}
                      </span>
                    </button>

                    {showCalendar && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-3 p-3 border border-gray-200 rounded-xl"
                      >
                        <CalendarComponent
                          mode="single"
                          selected={date}
                          onSelect={(d) => {
                            setDate(d);
                            setShowCalendar(false);
                          }}
                          locale={ko}
                          className="mx-auto"
                        />
                      </motion.div>
                    )}
                  </div>

                  {/* Reservation Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      예약번호 (4자리)
                    </label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2">
                        <Ticket className="w-5 h-5 text-gray-400" />
                      </div>
                      <Input
                        type="text"
                        maxLength={4}
                        placeholder="예: 1234"
                        value={reservationNumber}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, "");
                          setReservationNumber(value);
                        }}
                        className="pl-12 h-14 text-lg tracking-widest text-center border-gray-200 rounded-xl focus:border-[#0055FF] focus:ring-[#0055FF]"
                      />
                    </div>
                  </div>

                  {/* Check Button */}
                  <Button
                    onClick={handleCheck}
                    disabled={!date || reservationNumber.length !== 4}
                    className="w-full h-14 bg-[#0055FF] hover:bg-[#0055FF]/90 text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    확인하기
                  </Button>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6"
                >
                  {/* Success Icon */}
                  <div className="flex justify-center">
                    <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                      <Check className="w-10 h-10 text-green-600" />
                    </div>
                  </div>

                  {/* Coupon Code */}
                  <div className="text-center">
                    <p className="text-gray-600 mb-2">쿠폰 코드</p>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-4xl font-bold text-[#0055FF] tracking-widest">
                        {couponCode}
                      </span>
                      <button
                        onClick={handleCopy}
                        className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                      >
                        {copied ? (
                          <Check className="w-5 h-5 text-green-600" />
                        ) : (
                          <Copy className="w-5 h-5 text-gray-600" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
                    <p>촬영 당일 포토그래퍼에게 이 쿠폰 코드를 보여주세요.</p>
                  </div>

                  {/* Close Button */}
                  <Button
                    onClick={handleClose}
                    className="w-full h-14 bg-[#0055FF] hover:bg-[#0055FF]/90 text-white font-semibold rounded-xl"
                  >
                    닫기
                  </Button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
