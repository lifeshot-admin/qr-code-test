import Skeleton from "@/components/Skeleton";

export default function MyToursLoading() {
  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      {/* 헤더 */}
      <div className="bg-white px-5 pt-12 pb-4">
        <Skeleton height={20} className="w-28" rounded="rounded" />
      </div>

      {/* 예약 카드 리스트 */}
      <div className="px-5 pt-4 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm">
            <Skeleton height={160} rounded="rounded-none" className="w-full" />
            <div className="p-4 space-y-3">
              <div className="flex justify-between">
                <Skeleton height={16} className="w-32" rounded="rounded" />
                <Skeleton height={22} className="w-16" rounded="rounded-full" />
              </div>
              <Skeleton height={12} className="w-40" rounded="rounded" />
              <Skeleton height={12} className="w-28" rounded="rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
