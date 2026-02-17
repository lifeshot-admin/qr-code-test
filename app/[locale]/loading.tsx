import Skeleton, { SkeletonCard } from "@/components/Skeleton";

export default function LocaleHomeLoading() {
  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      {/* 히어로 배너 */}
      <Skeleton height={280} rounded="rounded-none" className="w-full" />

      {/* 섹션 제목 */}
      <div className="px-5 pt-6 pb-3">
        <Skeleton height={18} className="w-40" rounded="rounded" />
      </div>

      {/* 카드 리스트 */}
      <div className="px-5 space-y-4 pb-24">
        {[1, 2, 3].map(i => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
