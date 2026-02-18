"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const message = error?.message || "알 수 없는 오류가 발생했습니다.";
  const digest = error?.digest;

  useEffect(() => {
    console.error("[Admin Error Boundary]", message);
  }, [message]);

  // ⚠️ 리다이렉트(router.push, Link 등)를 절대 사용하지 않음
  // → layout.tsx가 에러를 발생시킨 경우, 리다이렉트가 layout을 다시 렌더링하여 무한 루프 유발
  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#030712",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      fontFamily: "sans-serif",
    }}>
      <div style={{ maxWidth: "400px", width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: "48px", marginBottom: "24px" }}>⚠️</div>
        <h1 style={{ fontSize: "20px", fontWeight: "bold", color: "#fff", marginBottom: "12px" }}>
          관리자 페이지 오류
        </h1>
        <p style={{ color: "#9ca3af", fontSize: "14px", marginBottom: "8px" }}>
          {message}
        </p>
        {digest && (
          <p style={{ color: "#4b5563", fontSize: "10px", marginBottom: "24px" }}>
            ID: {digest}
          </p>
        )}
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button
            onClick={reset}
            style={{
              padding: "10px 24px",
              backgroundColor: "#fff",
              color: "#111",
              fontWeight: 600,
              borderRadius: "12px",
              border: "none",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            다시 시도
          </button>
          <button
            onClick={() => { window.location.href = "/admin/login"; }}
            style={{
              padding: "10px 24px",
              backgroundColor: "#1f2937",
              color: "#d1d5db",
              fontWeight: 600,
              borderRadius: "12px",
              border: "none",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            로그인으로
          </button>
        </div>
      </div>
    </div>
  );
}
