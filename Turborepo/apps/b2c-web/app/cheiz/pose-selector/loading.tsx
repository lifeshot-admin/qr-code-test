import Skeleton from "@/components/Skeleton";

export default function PoseSelectorLoading() {
  return (
    <div className="min-h-screen bg-white max-w-md mx-auto">
      <div className="px-5 pt-12 pb-4">
        <Skeleton height={20} className="w-28" rounded="rounded" />
        <Skeleton height={12} className="w-48 mt-2" rounded="rounded" />
      </div>
      <div className="px-5 pt-3">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] w-full" rounded="rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
