export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-6 bg-gray-200 rounded w-48 mb-2" />
        <div className="h-4 bg-gray-100 rounded w-72" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="w-10 h-10 bg-gray-200 rounded-xl mb-4" />
            <div className="h-7 bg-gray-200 rounded w-20 mb-1" />
            <div className="h-3 bg-gray-100 rounded w-28" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 h-48" />
        <div className="bg-white rounded-2xl border border-gray-100 p-5 h-48" />
      </div>
    </div>
  );
}
