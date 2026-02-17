import Skeleton from "@/components/Skeleton";

export default function ReserveLoading() {
  return (
    <div className="min-h-screen bg-white max-w-md mx-auto">
      {/* 헤더 */}
      <div className="px-5 pt-12 pb-4 flex items-center gap-3">
        <Skeleton height={24} width={24} rounded="rounded" />
        <Skeleton height={18} className="w-20" rounded="rounded" />
      </div>

      {/* 투어 정보 요약 */}
      <div className="px-5 py-4 space-y-3">
        <Skeleton height={60} className="w-full" rounded="rounded-xl" />
      </div>

      {/* 단계 바 */}
      <div className="px-5 py-3 flex gap-2">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} height={4} className="flex-1" rounded="rounded-full" />
        ))}
      </div>

      {/* 콘텐츠 영역 */}
      <div className="px-5 pt-4 space-y-4">
        <Skeleton height={16} className="w-32" rounded="rounded" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} height={120} className="w-full" rounded="rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
