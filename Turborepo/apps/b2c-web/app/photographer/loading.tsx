import Skeleton from "@/components/Skeleton";

export default function PhotographerLoading() {
  return (
    <div className="min-h-screen bg-white max-w-md mx-auto">
      <div className="px-5 pt-12 pb-4">
        <Skeleton height={20} className="w-32" rounded="rounded" />
      </div>
      <div className="px-5 pt-4 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
            <Skeleton height={56} width={56} rounded="rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton height={16} className="w-28" rounded="rounded" />
              <Skeleton height={12} className="w-40" rounded="rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
