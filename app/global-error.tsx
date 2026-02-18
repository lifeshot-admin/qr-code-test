"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // error 객체가 null/undefined일 수 있으므로 안전하게 접근
  const message = error?.message || "알 수 없는 오류가 발생했습니다.";
  const digest = error?.digest;

  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: "sans-serif" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            backgroundColor: "#fff",
          }}
        >
          <div style={{ maxWidth: "400px", textAlign: "center" }}>
            <div style={{ fontSize: "64px", marginBottom: "24px" }}>🚨</div>
            <h1 style={{ fontSize: "24px", fontWeight: "bold", color: "#1f2937", marginBottom: "16px" }}>
              심각한 오류 발생
            </h1>
            <p style={{ color: "#6b7280", marginBottom: "8px" }}>{message}</p>
            {digest && (
              <p style={{ fontSize: "12px", color: "#9ca3af", marginBottom: "24px" }}>
                Error ID: {digest}
              </p>
            )}
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                onClick={reset}
                style={{
                  backgroundColor: "#0055FF",
                  color: "#fff",
                  fontWeight: "bold",
                  padding: "12px 32px",
                  borderRadius: "16px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                다시 시도
              </button>
              <button
                onClick={() => { window.location.href = "/"; }}
                style={{
                  backgroundColor: "#f3f4f6",
                  color: "#374151",
                  fontWeight: "bold",
                  padding: "12px 32px",
                  borderRadius: "16px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                홈으로
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
