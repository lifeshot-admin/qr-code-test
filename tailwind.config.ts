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
        // CHIIZ 메인 컬러: Sky Blue
        skyblue: "#00AEEF",
        primary: "#00AEEF",
        // 기존 포토그래퍼 앱 컬러 유지
        accent: "#FF9F0A",
        surface: "#1C1C1E",
        border: "#2C2C2E",
        muted: "#8E8E93",
      },
      borderRadius: {
        '3xl': '1.5rem', // rounded-3xl for buttons, cards
      },
    },
  },
  plugins: [],
};
export default config;
