import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-skyblue to-blue-600 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl p-12 text-center">
        <h1 className="text-5xl font-bold text-skyblue mb-8">Cheiz</h1>
        <p className="text-xl text-gray-600 mb-12">
          포토그래퍼 또는 일반 사용자로 접속하세요
        </p>
        <div className="flex flex-col md:flex-row gap-6">
          <Link
            href="/photographer"
            className="flex-1 bg-skyblue text-white font-bold py-6 px-8 rounded-3xl hover:bg-opacity-90 transition-all transform hover:scale-105 shadow-lg"
          >
            📷 포토그래퍼 앱
          </Link>
          <Link
            href="/cheiz"
            className="flex-1 bg-white text-skyblue border-2 border-skyblue font-bold py-6 px-8 rounded-3xl hover:bg-skyblue hover:text-white transition-all transform hover:scale-105 shadow-lg"
          >
            ✨ Cheiz 메인 서비스 시작하기
          </Link>
        </div>
      </div>
    </div>
  );
}
