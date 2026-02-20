"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check } from "lucide-react";
import { useState } from "react";

interface QRModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrCodeUrl: string;
  reservationId: string;
  tourName: string;
}

export default function QRModal({ isOpen, onClose, qrCodeUrl, reservationId, tourName }: QRModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(reservationId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-2xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-[#1A1A1A]">QR 코드</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {/* Content */}
            <div className="text-center">
              <p className="text-cheiz-primary font-semibold mb-2">예약이 완료되었어요!</p>
              <p className="text-gray-600 text-sm mb-6">{tourName}</p>

              {/* QR Code */}
              {qrCodeUrl && (
                <div className="flex justify-center mb-6">
                  <div className="p-4 bg-gray-50 rounded-2xl">
                    <img
                      src={qrCodeUrl}
                      alt="QR Code"
                      className="w-48 h-48 mx-auto"
                    />
                  </div>
                </div>
              )}

              <p className="text-gray-600 text-sm mb-2">
                촬영 당일 이 QR코드를
              </p>
              <p className="text-gray-600 text-sm mb-6">
                포토그래퍼에게 보여주세요
              </p>

              {/* Reservation Number */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <p className="text-sm text-gray-500 mb-1">예약번호:</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-[#1A1A1A] font-mono text-sm">{reservationId}</span>
                  <button
                    onClick={handleCopy}
                    className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>

              {/* Button */}
              <button
                onClick={onClose}
                className="w-full h-12 bg-cheiz-primary hover:bg-cheiz-primary/90 text-white font-semibold rounded-xl transition-all"
              >
                확인
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
