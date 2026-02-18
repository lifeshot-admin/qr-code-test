"use client";

import { useState, useCallback } from "react";
import { Download, Loader2, Wifi, AlertTriangle, X, Check } from "lucide-react";

type DownloadPhoto = {
  id: string;
  url: string;
  filename?: string;
};

type AlbumDownloaderProps = {
  photos: DownloadPhoto[];
  locationName?: string;
  nickname?: string;
  onClose: () => void;
};

const AVG_SIZE_MB = 1.2;

export default function AlbumDownloader({
  photos,
  locationName = "Photo",
  nickname = "User",
  onClose,
}: AlbumDownloaderProps) {
  const [phase, setPhase] = useState<"confirm" | "downloading" | "done">("confirm");
  const [progress, setProgress] = useState(0);
  const [downloaded, setDownloaded] = useState(0);
  const [failed, setFailed] = useState(0);

  const totalCount = photos.length;
  const estimatedMB = (totalCount * AVG_SIZE_MB).toFixed(1);

  const sanitize = (s: string) =>
    s.replace(/[^a-zA-Z0-9가-힣_-]/g, "_").substring(0, 30);

  const buildFilename = (index: number, ext: string) =>
    `Cheiz_${sanitize(locationName)}_${sanitize(nickname)}_${String(index + 1).padStart(3, "0")}.${ext}`;

  const downloadAll = useCallback(async () => {
    setPhase("downloading");
    let ok = 0;
    let fail = 0;

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      try {
        // Vercel 프록시 경유: CORS 우회 + 깨진 URL 자동 수선
        const proxyUrl = `/api/download?url=${encodeURIComponent(photo.url)}`;
        console.log(`[DOWNLOAD] ${i + 1}/${photos.length} 프록시 요청:`, photo.url.substring(0, 80));

        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error(`Proxy ${res.status}`);

        const blob = await res.blob();
        const ext = blob.type.includes("png") ? "png" : "jpg";
        const filename = photo.filename || buildFilename(i, ext);

        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);

        ok++;
      } catch (e) {
        console.error(`[DOWNLOAD] ❌ ${photo.id}:`, e);
        fail++;
      }

      setDownloaded(ok);
      setFailed(fail);
      setProgress(Math.round(((ok + fail) / totalCount) * 100));

      if (i < photos.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    setPhase("done");
  }, [photos, totalCount]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-5">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* ━━━ 확인 단계 ━━━ */}
        {phase === "confirm" && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Download className="w-5 h-5 text-[#0055FF]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">사진 다운로드</h3>
                  <p className="text-[11px] text-gray-400">{totalCount}장</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1 text-gray-300 hover:text-gray-500 active:scale-90">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50 rounded-2xl p-4 mb-4 space-y-2">
              <div className="flex items-start gap-2">
                <Wifi className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 leading-relaxed">
                  <span className="font-bold">예상 용량: 약 {estimatedMB}MB</span><br />
                  Wi-Fi 환경에서 다운로드를 권장합니다.
                  모바일 데이터 사용 시 요금이 발생할 수 있습니다.
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 mb-5">
              <p className="text-[11px] text-gray-500 leading-relaxed">
                파일명: <span className="font-mono text-gray-700">Cheiz_{sanitize(locationName)}_{sanitize(nickname)}_001.jpg</span>
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-500 text-sm font-medium active:scale-[0.97] transition-all">
                취소
              </button>
              <button onClick={downloadAll}
                className="flex-1 py-3 rounded-xl bg-[#0055FF] text-white text-sm font-bold active:scale-[0.97] transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-1.5">
                <Download className="w-4 h-4" /> 다운로드 시작
              </button>
            </div>
          </div>
        )}

        {/* ━━━ 다운로드 진행 ━━━ */}
        {phase === "downloading" && (
          <div className="p-6">
            <div className="text-center mb-5">
              <Loader2 className="w-10 h-10 text-[#0055FF] animate-spin mx-auto mb-3" />
              <h3 className="text-base font-bold text-gray-900 mb-1">다운로드 중...</h3>
              <p className="text-sm text-gray-500">
                {downloaded + failed} / {totalCount}장 ({progress}%)
              </p>
            </div>

            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden mb-3">
              <div
                className="h-full bg-gradient-to-r from-[#0055FF] to-[#3377FF] rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            {failed > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-red-500">
                <AlertTriangle className="w-3 h-3" />
                {failed}장 다운로드 실패
              </div>
            )}
          </div>
        )}

        {/* ━━━ 완료 ━━━ */}
        {phase === "done" && (
          <div className="p-6 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-green-50 flex items-center justify-center">
              <Check className="w-7 h-7 text-green-500" strokeWidth={3} />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">다운로드 완료!</h3>
            <p className="text-sm text-gray-500 mb-1">
              {downloaded}장 성공{failed > 0 ? ` · ${failed}장 실패` : ""}
            </p>
            <p className="text-[11px] text-gray-400 mb-5">기기의 다운로드 폴더를 확인하세요</p>
            <button onClick={onClose}
              className="w-full py-3 rounded-xl bg-[#0055FF] text-white text-sm font-bold active:scale-[0.97] transition-all">
              확인
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
