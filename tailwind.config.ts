import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#eef6ef", 100: "#d5ead8", 200: "#a9d3b0", 300: "#76b783", 400: "#4f9a5e", 500: "#3F6644", 600: "#2c5a33", 700: "#1d4a25", 800: "#123a19", 900: "#084607", 950: "#05250a" },
        ink: { 900: "#0c130e", 800: "#121b14", 700: "#19241b", 600: "#223024", 500: "#334436" },
        neon: "#F2C14E",
      },
      fontFamily: { sans: ["'IBM Plex Sans Arabic'", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;
