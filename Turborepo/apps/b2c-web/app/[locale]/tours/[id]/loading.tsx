import Skeleton from "@/components/Skeleton";

export default function TourDetailLoading() {
  return (
    <div className="min-h-screen bg-white max-w-md mx-auto">
      {/* 메인 이미지 슬라이드 */}
      <Skeleton height={320} rounded="rounded-none" className="w-full" />

      <div className="px-5 pt-5 space-y-4">
        {/* 위치 */}
        <Skeleton height={14} className="w-1/3" rounded="rounded" />
        {/* 제목 + 가격 */}
        <div className="flex items-end justify-between gap-3">
          <Skeleton height={22} className="flex-1" rounded="rounded" />
          <Skeleton height={20} className="w-24" rounded="rounded" />
        </div>
        {/* 설명 */}
        <div className="space-y-2">
          <Skeleton height={12} className="w-full" rounded="rounded" />
          <Skeleton height={12} className="w-full" rounded="rounded" />
          <Skeleton height={12} className="w-2/3" rounded="rounded" />
        </div>

        {/* 예약 일정 */}
        <div className="pt-4">
          <Skeleton height={16} className="w-28 mb-3" rounded="rounded" />
          <div className="flex gap-3 overflow-hidden">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} height={72} className="min-w-[130px]" rounded="rounded-xl" />
            ))}
          </div>
        </div>

        {/* 지도 */}
        <div className="pt-4">
          <Skeleton height={16} className="w-28 mb-3" rounded="rounded" />
          <Skeleton height={200} className="w-full" rounded="rounded-2xl" />
        </div>

        {/* 리뷰 */}
        <div className="pt-4 pb-24">
          <Skeleton height={16} className="w-20 mb-3" rounded="rounded" />
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton height={32} width={32} rounded="rounded-full" />
                  <Skeleton height={14} className="w-20" rounded="rounded" />
                </div>
                <Skeleton height={12} className="w-full" rounded="rounded" />
                <Skeleton height={12} className="w-3/4" rounded="rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
