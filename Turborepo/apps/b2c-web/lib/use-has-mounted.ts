import { useState, useEffect } from "react";

/**
 * Zustand persist + Next.js SSR 하이드레이션 에러 방지 훅
 *
 * 서버에서는 false, 클라이언트 마운트 후 true를 반환.
 * Zustand store 값이 localStorage에서 복원되기 전까지
 * "0" vs "5" 같은 하이드레이션 불일치를 방지합니다.
 */
export function useHasMounted(): boolean {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  return hasMounted;
}
