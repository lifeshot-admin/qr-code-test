import Skeleton, { SkeletonCard } from "@/components/Skeleton";

export default function CheizLoading() {
  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      {/* 상단 탭 / 네비게이션 */}
      <div className="bg-white px-5 pt-12 pb-4 flex items-center justify-between">
        <Skeleton height={22} className="w-20" rounded="rounded" />
        <Skeleton height={28} width={28} rounded="rounded-full" />
      </div>

      {/* 배너 */}
      <div className="px-5 pt-3">
        <Skeleton height={140} className="w-full" rounded="rounded-2xl" />
      </div>

      {/* 카드 리스트 */}
      <div className="px-5 pt-5 space-y-4">
        {[1, 2].map(i => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
