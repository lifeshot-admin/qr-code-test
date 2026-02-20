"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface QRModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservationId: string;
  tourName: string;
}

export default function QRModal({ isOpen, onClose, reservationId, tourName }: QRModalProps) {
  const [copied, setCopied] = useState(false);

  // Generate a mock QR code URL
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=cheiz-${reservationId}&bgcolor=87CEEB`;

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
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-3xl p-6 w-full max-w-sm"
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
              <p className="text-[#0055FF] font-semibold mb-2">예약이 완료되었어요!</p>
              <p className="text-gray-600 text-sm mb-6">{tourName}</p>

              {/* QR Code */}
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-[#87CEEB] rounded-2xl">
                  <img
                    src={qrCodeUrl}
                    alt="QR Code"
                    className="w-48 h-48"
                  />
                </div>
              </div>

              <p className="text-gray-600 text-sm mb-2">
                촬영 당일 이 QR코드를
              </p>
              <p className="text-gray-600 text-sm mb-6">
                포토그래퍼에게 보여주세요 📸
              </p>

              {/* Reservation Number */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <p className="text-sm text-gray-500 mb-1">예약번호:</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-[#1A1A1A] font-mono">{reservationId}</span>
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

              {/* Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={onClose}
                  variant="outline"
                  className="flex-1 h-12 rounded-xl border-gray-200"
                >
                  마이페이지로
                </Button>
                <Button
                  onClick={onClose}
                  className="flex-1 h-12 rounded-xl bg-[#0055FF] hover:bg-[#0055FF]/90 text-white"
                >
                  홈으로
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
