import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0B0F12",
        surface: "#12181D",
        surfaceRaised: "#1A2229",
        border: "#232C33",
        accent: {
          DEFAULT: "#3DDC97",
          dim: "#2A9D6F",
        },
        warn: "#F2A65A",
        danger: "#E5484D",
        info: "#4EA1F3",
        muted: "#7C8A94",
        foreground: "#E8EDEF",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "system-ui", "sans-serif"],
        body: ["'Inter'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "14px",
      },
    },
  },
  plugins: [],
};

export default config;
