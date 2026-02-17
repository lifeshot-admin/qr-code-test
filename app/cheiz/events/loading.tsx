import Skeleton from "@/components/Skeleton";

export default function EventsLoading() {
  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      <div className="bg-white px-5 pt-12 pb-4">
        <Skeleton height={20} className="w-20" rounded="rounded" />
      </div>
      <div className="px-5 pt-4 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm">
            <Skeleton height={160} rounded="rounded-none" className="w-full" />
            <div className="p-4 space-y-2">
              <Skeleton height={16} className="w-44" rounded="rounded" />
              <Skeleton height={12} className="w-28" rounded="rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
