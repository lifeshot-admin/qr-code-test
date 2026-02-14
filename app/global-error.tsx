"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
            <p style={{ color: "#6b7280", marginBottom: "8px" }}>{error.message}</p>
            {error.digest && (
              <p style={{ fontSize: "12px", color: "#9ca3af", marginBottom: "24px" }}>
                Error ID: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{
                backgroundColor: "#00AEEF",
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
          </div>
        </div>
      </body>
    </html>
  );
}
