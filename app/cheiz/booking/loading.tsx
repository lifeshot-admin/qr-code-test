import Skeleton from "@/components/Skeleton";

export default function BookingLoading() {
  return (
    <div className="min-h-screen bg-white max-w-md mx-auto">
      <div className="px-5 pt-12 pb-4 flex items-center gap-3">
        <Skeleton height={24} width={24} rounded="rounded" />
        <Skeleton height={18} className="w-28" rounded="rounded" />
      </div>
      <div className="px-5 pt-4 space-y-4">
        <Skeleton height={80} className="w-full" rounded="rounded-xl" />
        <Skeleton height={16} className="w-40" rounded="rounded" />
        <Skeleton height={12} className="w-full" rounded="rounded" />
        <Skeleton height={12} className="w-3/4" rounded="rounded" />
        <div className="pt-4">
          <Skeleton height={48} className="w-full" rounded="rounded-xl" />
        </div>
      </div>
    </div>
  );
}
