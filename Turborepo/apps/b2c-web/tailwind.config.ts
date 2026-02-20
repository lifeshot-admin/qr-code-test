import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Cheiz Design System v3 — Brand #3FACFF
        "cheiz-primary": "#3FACFF",
        "cheiz-dark": "#1A8FE8",
        "cheiz-bg": "#FFFFFF",
        "cheiz-surface": "#F5FAFF",
        "cheiz-text": "#1A1A2E",
        "cheiz-sub": "#8A9BB0",
        "cheiz-border": "#E8F0F7",
        "cheiz-success": "#34C77B",
        // Legacy (기존 호환용)
        cheiz: "#0055FF",
        "cheiz-blue": "#0055FF",
        "cheiz-purple": "#7C3AED",
        "cheiz-green": "#22C55E",
        "cheiz-orange": "#FF4B2B",
        "cheiz-gray": "#F8F9FA",
        "cheiz-ink": "#1A1A1A",
        skyblue: "#0055FF",
        primary: "#0055FF",
        // 포토그래퍼 앱 컬러 유지
        accent: "#FF9F0A",
        surface: "#1C1C1E",
        border: "#2C2C2E",
        muted: "#8E8E93",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
};
export default config;
