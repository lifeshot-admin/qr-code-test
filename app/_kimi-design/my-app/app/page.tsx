"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ticket,
  Camera,
  MessageCircle,
  ChevronRight,
  Star,
  MapPin,
  Calendar,
  QrCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import EventSlider from "./components/EventSlider";
import CouponSheet from "./components/CouponSheet";
import QRModal from "./components/QRModal";

// Mock data for reviews
const reviews = [
  {
    id: 1,
    image: "https://kimi-web-img.moonshot.cn/img/rimage.gnst.jp/7944601e5203cef6d063f09e5253447d28b80df7.jpg",
    text: "정말 예쁘게 나왔어요! 포토그래퍼님이 친절하게 가이드해주셔서 자연스러운 사진을 얻을 수 있었어요.",
    author: "지연님",
    rating: 5,
    location: "아라시야마 대나무숲",
  },
  {
    id: 2,
    image: "https://kimi-web-img.moonshot.cn/img/media.triple.guide/da3f6881aff143aa548d0b20ad6cbd5cac801f18.jpeg",
    text: "인생샷 건졌습니다! 교토 여행의 하이라이트였어요. 다음에 또 이용할게요!",
    author: "민지님",
    rating: 5,
    location: "금각사",
  },
  {
    id: 3,
    image: "https://kimi-web-img.moonshot.cn/img/www.kyototourism.org/ecaed41b85a87c996f3ec83f2cf91458880fa833.jpg",
    text: "벚꽃 시즌에 예약했는데 정말 꿈같은 사진들을 받았어요. 강추합니다!",
    author: "수진님",
    rating: 5,
    location: "교토 벚꽃",
  },
];

export default function Home() {
  const [isCouponOpen, setIsCouponOpen] = useState(false);
  const [currentView, setCurrentView] = useState<"home" | "reservations" | "poses">("home");
  const [selectedReservation, setSelectedReservation] = useState<string>("");
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrData, setQrData] = useState<{ id: string; name: string }>({ id: "", name: "" });

  // Mock reservation data
  const reservations = [
    {
      id: "RES001",
      tourName: "교토 벚꽃 투어",
      date: "2026.03.25",
      dDay: 7,
      poseCount: 5,
      totalPoses: 10,
      status: "poses_selected" as const,
      image: "https://kimi-web-img.moonshot.cn/img/www.kyototourism.org/ecaed41b85a87c996f3ec83f2cf91458880fa833.jpg",
    },
    {
      id: "RES002",
      tourName: "오사카 야경 투어",
      date: "2026.04.10",
      dDay: 23,
      poseCount: 0,
      totalPoses: 8,
      status: "poses_needed" as const,
      image: "https://kimi-web-img.moonshot.cn/img/rimage.savorjapan.com/06ef7ddf913f2dcc7c841eb9657064f6f43689c9.jpg",
    },
    {
      id: "RES003",
      tourName: "후지산 일출 투어",
      date: "2026.02.01",
      dDay: -10,
      poseCount: 6,
      totalPoses: 6,
      status: "completed" as const,
      image: "https://kimi-web-img.moonshot.cn/img/rimage.gnst.jp/ee3fdde7a5584072a7ea481827b196ca92b7b1e6.jpg",
    },
  ];

  const handleReservationClick = (reservationId: string, status: string) => {
    if (status === "poses_needed" || status === "poses_selected") {
      setSelectedReservation(reservationId);
      setCurrentView("poses");
    }
  };

  const handleQRView = (e: React.MouseEvent, reservationId: string, tourName: string) => {
    e.stopPropagation();
    setQrData({ id: reservationId, name: tourName });
    setQrModalOpen(true);
  };

  // Poses Selection View
  if (currentView === "poses") {
    return (
      <PosesSelection 
        reservationId={selectedReservation}
        onBack={() => setCurrentView("reservations")}
      />
    );
  }

  // Reservations List View
  if (currentView === "reservations") {
    return (
      <div className="min-h-screen bg-white">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
          <div className="max-w-md mx-auto px-4 h-14 flex items-center">
            <button
              onClick={() => setCurrentView("home")}
              className="flex items-center gap-2 text-[#1A1A1A]"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
              <span className="font-medium">홈으로</span>
            </button>
            <h1 className="flex-1 text-center font-bold text-lg">내 예약 목록</h1>
            <div className="w-16" />
          </div>
        </header>

        {/* Reservations List */}
        <main className="max-w-md mx-auto px-4 py-6">
          {/* Upcoming Tours */}
          <section className="mb-8">
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#0055FF]" />
              다가오는 투어
            </h2>
            <div className="space-y-4">
              {reservations
                .filter((r) => r.status !== "completed")
                .map((reservation) => (
                  <motion.div
                    key={reservation.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm"
                  >
                    <div className="relative h-32">
                      <img
                        src={reservation.image}
                        alt={reservation.tourName}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-3 left-3">
                        <span className="px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-sm font-semibold text-[#0055FF]">
                          D-{reservation.dDay}
                        </span>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-[#1A1A1A] mb-1">
                        {reservation.tourName}
                      </h3>
                      <p className="text-sm text-gray-500 mb-3">
                        {reservation.date} · 포즈 {reservation.poseCount}개 선택
                      </p>

                      {/* Status Badge */}
                      <div className="mb-4">
                        {reservation.status === "poses_needed" ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 text-red-600 rounded-full text-sm">
                            포즈 선택 필요
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-600 rounded-full text-sm">
                            준비 완료
                          </span>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        {reservation.status === "poses_selected" && (
                          <Button
                            onClick={(e) => handleQRView(e, reservation.id, reservation.tourName)}
                            variant="outline"
                            className="flex-1 h-10 rounded-xl border-[#0055FF] text-[#0055FF]"
                          >
                            <QrCode className="w-4 h-4 mr-1" />
                            QR코드
                          </Button>
                        )}
                        <Button
                          onClick={() => handleReservationClick(reservation.id, reservation.status)}
                          className={`h-10 rounded-xl ${
                            reservation.status === "poses_needed"
                              ? "flex-1 bg-[#0055FF] hover:bg-[#0055FF]/90 text-white"
                              : "flex-1 bg-gray-100 hover:bg-gray-200 text-[#1A1A1A]"
                          }`}
                        >
                          {reservation.status === "poses_needed"
                            ? "포즈 예약하기"
                            : "포즈 수정하기"}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
            </div>
          </section>

          {/* Completed Tours */}
          <section>
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-4 flex items-center gap-2">
              <Camera className="w-5 h-5 text-gray-400" />
              완료된 투어
            </h2>
            <div className="space-y-4">
              {reservations
                .filter((r) => r.status === "completed")
                .map((reservation) => (
                  <motion.div
                    key={reservation.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-50 rounded-2xl overflow-hidden"
                  >
                    <div className="flex">
                      <div className="w-24 h-24 flex-shrink-0">
                        <img
                          src={reservation.image}
                          alt={reservation.tourName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-4 flex-1">
                        <h3 className="font-bold text-[#1A1A1A] mb-1">
                          {reservation.tourName}
                        </h3>
                        <p className="text-sm text-gray-500 mb-2">
                          {reservation.date} · 촬영 완료
                        </p>
                        <button className="text-sm text-[#0055FF] font-medium flex items-center gap-1">
                          사진 보기
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
            </div>
          </section>
        </main>

        {/* QR Modal */}
        <QRModal
          isOpen={qrModalOpen}
          onClose={() => setQrModalOpen(false)}
          reservationId={qrData.id}
          tourName={qrData.name}
        />
      </div>
    );
  }

  // Home View
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="font-bold text-lg text-[#1A1A1A]">
            안녕하세요! <span className="text-[#0055FF]">Cheiz</span> (지연)
          </h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-8">
        {/* Event Slider */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-[#1A1A1A]">
              인생샷으로 남길 특별한 순간
            </h2>
          </div>
          <EventSlider />
        </section>

        {/* Quick Menu */}
        <section>
          <h2 className="text-lg font-bold text-[#1A1A1A] mb-4">
            어떤 걸 원하시나요?
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {/* Coupon Check */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsCouponOpen(true)}
              className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-[#0055FF]/5 to-[#0055FF]/10 rounded-2xl border border-[#0055FF]/10"
            >
              <div className="w-12 h-12 rounded-xl bg-[#0055FF] flex items-center justify-center">
                <Ticket className="w-6 h-6 text-white" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-sm text-[#1A1A1A]">내 쿠폰</p>
                <p className="font-semibold text-sm text-[#1A1A1A]">확인하기!</p>
                <p className="text-xs text-gray-500 mt-0.5">쿠폰을 받으셨으면 확인!</p>
              </div>
            </motion.button>

            {/* Pose Reservation */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setCurrentView("reservations")}
              className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-[#FF4B2B]/5 to-[#FF4B2B]/10 rounded-2xl border border-[#FF4B2B]/10"
            >
              <div className="w-12 h-12 rounded-xl bg-[#FF4B2B] flex items-center justify-center">
                <Camera className="w-6 h-6 text-white" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-sm text-[#1A1A1A]">촬영 포즈</p>
                <p className="font-semibold text-sm text-[#1A1A1A]">예약하기</p>
                <p className="text-xs text-gray-500 mt-0.5">우리는 어떤 포즈로 촬영할까?</p>
              </div>
            </motion.button>

            {/* Contact */}
            <motion.a
              href="https://pf.kakao.com"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-2xl border border-yellow-200"
            >
              <div className="w-12 h-12 rounded-xl bg-[#FEE500] flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-[#391B1B]" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-sm text-[#1A1A1A]">궁금한 점이</p>
                <p className="font-semibold text-sm text-[#1A1A1A]">있나요?</p>
                <p className="text-xs text-gray-500 mt-0.5">09:00 ~ 19:00</p>
              </div>
            </motion.a>
          </div>
          <p className="text-center text-xs text-gray-500 mt-2">
            카카오 1:1문의로 언제든지 연락 주세요!
          </p>
        </section>

        {/* Photo Reviews */}
        <section>
          <h2 className="text-lg font-bold text-[#1A1A1A] mb-4 flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#0055FF]" />
            사진리뷰
          </h2>
          <div className="space-y-4">
            {reviews.map((review, index) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm"
              >
                <div className="flex">
                  <div className="w-28 h-28 flex-shrink-0">
                    <img
                      src={review.image}
                      alt={review.location}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4 flex-1">
                    <div className="flex items-center gap-1 mb-2">
                      {[...Array(review.rating)].map((_, i) => (
                        <Star
                          key={i}
                          className="w-4 h-4 fill-yellow-400 text-yellow-400"
                        />
                      ))}
                    </div>
                    <p className="text-sm text-[#1A1A1A] line-clamp-2 mb-2">
                      &ldquo;{review.text}&rdquo;
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">- {review.author}</span>
                      <span className="text-xs text-[#0055FF] flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {review.location}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Button
            onClick={() => setCurrentView("reservations")}
            className="w-full h-14 bg-[#0055FF] hover:bg-[#0055FF]/90 text-white font-semibold rounded-xl text-lg"
          >
            지금 바로 시작하기
            <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
        </motion.div>
      </main>

      {/* Coupon Sheet */}
      <CouponSheet isOpen={isCouponOpen} onClose={() => setIsCouponOpen(false)} />
    </div>
  );
}

// Poses Selection Component
import Lightbox from "./components/Lightbox";

const poses = [
  { id: "p1", image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=600&fit=crop", category: "solo" },
  { id: "p2", image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=600&fit=crop", category: "solo" },
  { id: "p3", image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=600&fit=crop", category: "solo" },
  { id: "p4", image: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&h=600&fit=crop", category: "solo" },
  { id: "p5", image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=600&fit=crop", category: "solo" },
  { id: "p6", image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=600&fit=crop", category: "solo" },
  { id: "p7", image: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&h=600&fit=crop", category: "solo" },
  { id: "p8", image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop", category: "solo" },
  { id: "p9", image: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=400&h=600&fit=crop", category: "couple" },
  { id: "p10", image: "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=400&h=600&fit=crop", category: "couple" },
  { id: "p11", image: "https://images.unsplash.com/photo-1621621667797-e06afc217fb0?w=400&h=600&fit=crop", category: "couple" },
  { id: "p12", image: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=400&h=600&fit=crop", category: "couple" },
  { id: "p13", image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&h=600&fit=crop", category: "couple" },
  { id: "p14", image: "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=400&h=600&fit=crop", category: "couple" },
  { id: "p15", image: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=600&fit=crop", category: "group" },
  { id: "p16", image: "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=400&h=600&fit=crop", category: "group" },
  { id: "p17", image: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&h=600&fit=crop", category: "group" },
  { id: "p18", image: "https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=400&h=600&fit=crop", category: "group" },
  { id: "p19", image: "https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?w=400&h=600&fit=crop", category: "group" },
  { id: "p20", image: "https://images.unsplash.com/photo-1609234656388-0ff363383899?w=400&h=600&fit=crop", category: "friend" },
  { id: "p21", image: "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=400&h=600&fit=crop", category: "friend" },
  { id: "p22", image: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=600&fit=crop", category: "friend" },
  { id: "p23", image: "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=400&h=600&fit=crop", category: "friend" },
  { id: "p24", image: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&h=600&fit=crop", category: "friend" },
];

const categories = [
  { id: "all", label: "전체", count: 24 },
  { id: "solo", label: "1인", count: 8 },
  { id: "couple", label: "커플", count: 6 },
  { id: "group", label: "단체", count: 5 },
  { id: "friend", label: "우정", count: 5 },
];

function PosesSelection({ reservationId, onBack }: { reservationId: string; onBack: () => void }) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const filteredPoses = selectedCategory === "all" 
    ? poses 
    : poses.filter((pose) => pose.category === selectedCategory);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
    );
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const progress = Math.min((selectedIds.length / 10) * 100, 100);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[#1A1A1A]"
          >
            <ChevronRight className="w-5 h-5 rotate-180" />
            <span className="font-medium">뒤로</span>
          </button>
          <h1 className="flex-1 text-center font-bold text-lg">포즈 선택</h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 pb-32">
        {/* Spot Info */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-[#0055FF] mb-1">
            <Camera className="w-4 h-4" />
            <span className="text-sm font-medium">금각사</span>
          </div>
          <p className="text-gray-600 text-sm">2~5개의 포즈를 선택해주세요</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">선택 진행률</span>
            <span className="text-sm font-semibold text-[#0055FF]">
              {selectedIds.length}/10
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
              className="h-full bg-gradient-to-r from-[#0055FF] to-[#0055FF]/70 rounded-full"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto hide-scrollbar pb-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? "bg-[#0055FF] text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {cat.label}
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  selectedCategory === cat.id
                    ? "bg-white/20 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        {/* Pose Grid */}
        <div className="grid grid-cols-2 gap-3">
          <AnimatePresence mode="popLayout">
            {filteredPoses.map((pose, index) => {
              const isSelected = selectedIds.includes(pose.id);
              return (
                <motion.div
                  key={pose.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  className="relative aspect-[3/4] rounded-xl overflow-hidden group"
                >
                  {/* Image */}
                  <img
                    src={pose.image}
                    alt={`Pose ${index + 1}`}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => openLightbox(index)}
                  />

                  {/* Selection Ring */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 ring-4 ring-[#0055FF] ring-inset pointer-events-none"
                      />
                    )}
                  </AnimatePresence>

                  {/* Quick Select Button (top-right) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelection(pose.id);
                    }}
                    className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      isSelected
                        ? "bg-[#0055FF] text-white"
                        : "bg-white/80 backdrop-blur-sm text-gray-400 hover:bg-white"
                    }`}
                  >
                    <ChevronRight className="w-4 h-4 rotate-180" />
                  </button>

                  {/* Selected Overlay */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-[#0055FF]/10 pointer-events-none"
                      />
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Empty State */}
        {filteredPoses.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">해당 카테고리의 포즈가 없습니다.</p>
          </div>
        )}
      </main>

      {/* Bottom Action */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-600">
              이 스팟: {selectedIds.length}개 선택
            </span>
            <span className="text-sm text-gray-600">
              전체: {selectedIds.length}/10
            </span>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 h-12 rounded-xl border-gray-200"
              onClick={onBack}
            >
              돌아가기
            </Button>
            <Button
              className="flex-1 h-12 rounded-xl bg-[#0055FF] hover:bg-[#0055FF]/90 text-white font-semibold"
              disabled={selectedIds.length === 0}
            >
              선택 완료
            </Button>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      <Lightbox
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        poses={filteredPoses}
        currentIndex={lightboxIndex}
        selectedIds={selectedIds}
        onSelect={toggleSelection}
        onIndexChange={setLightboxIndex}
      />
    </div>
  );
}
