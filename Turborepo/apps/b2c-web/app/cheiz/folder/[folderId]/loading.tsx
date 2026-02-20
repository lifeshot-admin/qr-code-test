import Skeleton from "@/components/Skeleton";

export default function FolderLoading() {
  return (
    <div className="min-h-screen bg-white max-w-md mx-auto">
      {/* 헤더 */}
      <div className="px-5 pt-12 pb-4 flex items-center gap-3">
        <Skeleton height={24} width={24} rounded="rounded" />
        <Skeleton height={18} className="w-36" rounded="rounded" />
      </div>

      {/* 폴더 정보 */}
      <div className="px-5 py-4 bg-gray-50 rounded-2xl mx-5 space-y-2">
        <Skeleton height={14} className="w-40" rounded="rounded" />
        <Skeleton height={12} className="w-24" rounded="rounded" />
      </div>

      {/* 사진 그리드 */}
      <div className="px-5 pt-5">
        <div className="grid grid-cols-3 gap-1">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full" rounded="rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
