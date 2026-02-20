"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, Ticket, Check, Copy } from "lucide-react";

interface CouponSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (tourDate: string, phone4Digits: string) => Promise<{
    found: boolean;
    coupon_name?: string;
    code?: string;
    tour_Id?: number;
    message?: string;
  }>;
}

export default function CouponSheet({ isOpen, onClose, onSearch }: CouponSheetProps) {
  const [tourDate, setTourDate] = useState("");
  const [phone4Digits, setPhone4Digits] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<{
    found: boolean;
    coupon_name?: string;
    code?: string;
    tour_Id?: number;
    message?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSearch = async () => {
    if (!tourDate || phone4Digits.length !== 4) return;
    setSearching(true);
    try {
      const data = await onSearch(tourDate, phone4Digits);
      setResult(data);
    } catch {
      setResult({ found: false, message: "쿠폰 조회 중 오류가 발생했습니다." });
    } finally {
      setSearching(false);
    }
  };

  const handleCopy = async () => {
    if (!result?.code) return;
    try {
      await navigator.clipboard.writeText(result.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = result.code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setResult(null);
    setTourDate("");
    setPhone4Digits("");
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
            <div className="p-6 max-w-md mx-auto">
              {/* Handle */}
              <div className="flex justify-center mb-4">
                <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-[#1A1A1A]">
                  {!result ? "내 쿠폰 확인하기" : result.found ? "쿠폰 확인 완료!" : "조회 결과"}
                </h2>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              {!result ? (
                <div className="space-y-6">
                  {/* Date Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      촬영 일정 선택
                    </label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2">
                        <div className="w-10 h-10 rounded-lg bg-cheiz-primary/10 flex items-center justify-center">
                          <Calendar className="w-5 h-5 text-cheiz-primary" />
                        </div>
                      </div>
                      <input
                        type="date"
                        value={tourDate}
                        onChange={(e) => setTourDate(e.target.value)}
                        className="w-full pl-[72px] pr-4 py-4 border border-gray-200 rounded-xl focus:outline-none focus:border-cheiz-primary text-[#1A1A1A] transition-colors"
                      />
                    </div>
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      전화번호 뒷 4자리
                    </label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2">
                        <Ticket className="w-5 h-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="예: 1234"
                        value={phone4Digits}
                        onChange={(e) => setPhone4Digits(e.target.value.replace(/\D/g, ""))}
                        className="w-full pl-12 h-14 text-lg tracking-widest text-center border border-gray-200 rounded-xl focus:outline-none focus:border-cheiz-primary text-[#1A1A1A] transition-colors placeholder:text-gray-400"
                      />
                    </div>
                  </div>

                  {/* Search Button */}
                  <button
                    onClick={handleSearch}
                    disabled={!tourDate || phone4Digits.length !== 4 || searching}
                    className="w-full h-14 bg-cheiz-primary hover:bg-cheiz-primary/90 text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {searching ? "조회 중..." : "확인하기"}
                  </button>
                </div>
              ) : result.found ? (
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

                  {/* Coupon Info */}
                  <div className="text-center">
                    {result.coupon_name && (
                      <p className="text-gray-600 mb-2">{result.coupon_name}</p>
                    )}
                    {result.code && (
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-4xl font-bold text-cheiz-primary tracking-widest">
                          {result.code}
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
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 text-center">
                    촬영 당일 포토그래퍼에게 이 쿠폰 코드를 보여주세요.
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleClose}
                      className="flex-1 h-12 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all"
                    >
                      닫기
                    </button>
                    <button
                      onClick={handleCopy}
                      className="flex-1 h-12 bg-cheiz-primary hover:bg-cheiz-primary/90 text-white font-semibold rounded-xl transition-all"
                    >
                      {copied ? "저장됨!" : "쿠폰코드 저장하기"}
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6 text-center"
                >
                  <div className="text-6xl">😢</div>
                  <h3 className="text-xl font-bold text-[#1A1A1A]">
                    일치하는 예약 정보가 없습니다
                  </h3>
                  <p className="text-gray-500 text-sm">
                    전화번호와 날짜를 다시 확인해 주세요.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleClose}
                      className="flex-1 h-12 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all"
                    >
                      닫기
                    </button>
                    <button
                      onClick={() => setResult(null)}
                      className="flex-1 h-12 bg-cheiz-primary hover:bg-cheiz-primary/90 text-white font-semibold rounded-xl transition-all"
                    >
                      다시 시도
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
