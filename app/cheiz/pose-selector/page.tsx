"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { SpotPose } from "@/lib/bubble-api";

export default function PoseSelectorPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [poses, setPoses] = useState<SpotPose[]>([]);
  const [selectedPoses, setSelectedPoses] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Login-Later 정책: 로그인 안 되어 있으면 로그인 페이지로
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  // Spot_pose 데이터 가져오기
  useEffect(() => {
    if (status === "authenticated") {
      fetchPoses();
    }
  }, [status]);

  const fetchPoses = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/bubble/spot-poses");
      if (!response.ok) {
        throw new Error("Failed to fetch poses");
      }
      const data = await response.json();
      setPoses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching poses:", err);
      setError("데이터를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  const togglePoseSelection = (poseId: string) => {
    setSelectedPoses((prev) => {
      const next = new Set(prev);
      if (next.has(poseId)) {
        next.delete(poseId);
      } else {
        next.add(poseId);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    if (selectedPoses.size === 0) {
      alert("최소 1개 이상의 포즈를 선택해주세요.");
      return;
    }
    // TODO: 선택한 포즈들을 예약에 연결
    alert(`${selectedPoses.size}개의 포즈가 선택되었습니다!`);
    // router.push("/cheiz/booking-confirm");
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-xl h-16 w-16 border-t-4 border-[#0055FF] border-solid mx-auto mb-4"></div>
          <p className="text-gray-600">포즈를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl shadow-sm p-12 text-center max-w-md"
        >
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">오류 발생</h2>
          <p className="text-gray-600 mb-8">{error}</p>
          <button
            onClick={fetchPoses}
            className="bg-[#0055FF] text-white font-bold py-3 px-8 rounded-2xl hover:bg-opacity-90 transition-all"
          >
            다시 시도
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <motion.section
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-[#0055FF] text-white py-8 px-6 sticky top-0 z-10 shadow-sm"
      >
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">포즈 선택하기</h1>
            <p className="text-sm opacity-90">
              원하는 포즈를 선택해주세요 ({selectedPoses.size}개 선택됨)
            </p>
          </div>
          <button
            onClick={handleConfirm}
            disabled={selectedPoses.size === 0}
            className="bg-white text-[#0055FF] font-bold py-3 px-8 rounded-xl hover:bg-opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            선택 완료
          </button>
        </div>
      </motion.section>

      {/* Pose Grid */}
      <section className="py-12 px-6">
        <div className="max-w-md mx-auto">
          {poses.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <div className="text-5xl mb-4">📸</div>
              <p className="text-gray-600 text-lg">
                아직 등록된 포즈가 없습니다.
              </p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {poses.map((pose, index) => {
                const isSelected = selectedPoses.has(pose._id);
                return (
                  <motion.div
                    key={pose._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.4 }}
                    onClick={() => togglePoseSelection(pose._id)}
                    className={`relative rounded-2xl overflow-hidden cursor-pointer shadow-sm transition-all transform hover:scale-105 ${
                      isSelected ? "ring-4 ring-[#0055FF]" : ""
                    }`}
                  >
                    {/* Image */}
                    <div className="aspect-[3/4] bg-gray-200 relative">
                      {pose.image ? (
                        <img
                          src={pose.image}
                          alt={pose.persona || "Pose"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-gray-400 text-4xl">📷</span>
                        </div>
                      )}
                      {/* Selection Indicator */}
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute top-4 right-4 bg-[#0055FF] text-white rounded-xl w-10 h-10 flex items-center justify-center shadow-sm"
                        >
                          <svg
                            className="w-6 h-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </motion.div>
                      )}
                    </div>
                    {/* Info */}
                    {pose.persona && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                        <p className="text-white font-semibold text-sm">
                          {pose.persona}
                        </p>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Footer Info */}
      {poses.length > 0 && (
        <section className="py-8 px-6 bg-gray-50">
          <div className="max-w-md mx-auto text-center">
            <p className="text-gray-600">
              💡 Tip: 원하는 포즈를 여러 개 선택할 수 있습니다.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
