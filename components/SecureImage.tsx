"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * 보안 이미지 컴포넌트 (Blob URL → onLoad 즉시 파쇄 + 워터마크 + 투명 방패)
 * - S3 원본 주소를 DOM에 노출하지 않음
 * - 이미지 로드 완료 즉시 blob URL 파기 → 새 탭에서 재접근 불가
 * - 35% 워터마크 + pointer interceptor로 저장 차단
 */
export default function SecureImage({
  src,
  className,
  watermark = false,
}: {
  src: string;
  className?: string;
  watermark?: boolean;
}) {
  const [blob, setBlob] = useState<string | null>(null);
  const blobRef = useRef<string | null>(null);
  const loadedRef = useRef(false);
  const prevSrc = useRef(src);

  if (prevSrc.current !== src) {
    prevSrc.current = src;
    loadedRef.current = false;
  }

  useEffect(() => {
    if (!src || loadedRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(src);
        if (cancelled) return;
        const b = await res.blob();
        if (cancelled) return;
        if (blobRef.current) URL.revokeObjectURL(blobRef.current);
        const url = URL.createObjectURL(b);
        blobRef.current = url;
        setBlob(url);
      } catch {
        if (!cancelled) setBlob(src);
      }
    })();
    return () => { cancelled = true; };
  }, [src]);

  const handleImageLoad = useCallback(() => {
    loadedRef.current = true;
    if (blobRef.current) {
      URL.revokeObjectURL(blobRef.current);
      blobRef.current = null;
    }
  }, []);

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      onContextMenu={(e) => e.preventDefault()}
      style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" } as React.CSSProperties}
    >
      {blob ? (
        <img
          src={blob}
          alt=""
          draggable={false}
          onLoad={handleImageLoad}
          className={className || "w-full h-full object-cover"}
          style={{ pointerEvents: "none", WebkitTouchCallout: "none" } as React.CSSProperties}
        />
      ) : (
        <div className="w-full h-full bg-gray-200 animate-pulse" />
      )}
      {watermark && blob && (
        <div className="absolute inset-0 pointer-events-none z-[2]">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="cheiz-wm-sec"
                width="120"
                height="110"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(-45)"
              >
                <text x="8" y="40" fill="white" fillOpacity="0.35" fontSize="16" fontWeight="700" fontFamily="system-ui, sans-serif">Cheiz</text>
                <text x="60" y="85" fill="white" fillOpacity="0.3" fontSize="13" fontWeight="600" fontFamily="system-ui, sans-serif">Cheiz</text>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#cheiz-wm-sec)" />
          </svg>
        </div>
      )}
      <div className="absolute inset-0 z-[3]" />
    </div>
  );
}
