/**
 * 404 페이지 — 순수 HTML만 사용
 * Link, motion 등 라우터 의존 컴포넌트를 사용하지 않아
 * 라우팅 시스템이 고장났을 때도 안전하게 렌더링됩니다.
 */
export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#ffffff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      fontFamily: "sans-serif",
    }}>
      <div style={{ maxWidth: "400px", width: "100%", textAlign: "center" }}>
        <h1 style={{
          fontSize: "72px",
          fontWeight: "bold",
          color: "#0055FF",
          marginBottom: "16px",
          lineHeight: 1,
        }}>
          404
        </h1>
        <h2 style={{
          fontSize: "24px",
          fontWeight: "bold",
          color: "#1A1A1A",
          marginBottom: "12px",
        }}>
          페이지를 찾을 수 없습니다
        </h2>
        <p style={{
          fontSize: "14px",
          color: "#6B7280",
          marginBottom: "32px",
        }}>
          요청하신 페이지가 존재하지 않거나 이동되었습니다.
        </p>
        <a
          href="/"
          style={{
            display: "inline-block",
            padding: "12px 32px",
            backgroundColor: "#0055FF",
            color: "#ffffff",
            fontWeight: 600,
            fontSize: "14px",
            borderRadius: "12px",
            textDecoration: "none",
          }}
        >
          홈으로 돌아가기
        </a>
      </div>
    </div>
  );
}
