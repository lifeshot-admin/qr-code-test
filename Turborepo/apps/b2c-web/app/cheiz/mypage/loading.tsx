import Skeleton from "@/components/Skeleton";

export default function MyPageLoading() {
  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      {/* 프로필 헤더 */}
      <div className="bg-white px-5 pt-12 pb-6">
        <div className="flex items-center gap-4">
          <Skeleton height={64} width={64} rounded="rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton height={18} className="w-32" rounded="rounded" />
            <Skeleton height={12} className="w-48" rounded="rounded" />
          </div>
        </div>
      </div>

      {/* 탭 버튼들 */}
      <div className="bg-white mt-2 px-5 py-4 flex gap-3">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} height={44} className="flex-1" rounded="rounded-xl" />
        ))}
      </div>

      {/* 메뉴 리스트 */}
      <div className="bg-white mt-2 px-5 py-4 space-y-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center justify-between">
            <Skeleton height={16} className="w-28" rounded="rounded" />
            <Skeleton height={16} width={16} rounded="rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
