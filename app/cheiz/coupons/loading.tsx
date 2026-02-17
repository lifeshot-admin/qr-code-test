import Skeleton from "@/components/Skeleton";

export default function CouponsLoading() {
  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      <div className="bg-white px-5 pt-12 pb-4">
        <Skeleton height={20} className="w-24" rounded="rounded" />
      </div>
      <div className="px-5 pt-4 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-2xl p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <Skeleton height={16} className="w-36" rounded="rounded" />
              <Skeleton height={28} className="w-16" rounded="rounded-lg" />
            </div>
            <Skeleton height={12} className="w-48" rounded="rounded" />
            <Skeleton height={12} className="w-24" rounded="rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
