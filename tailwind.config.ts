import type { Config } from "tailwindcss";

// Route 66 identity: roadside diner. Cream menu paper, asphalt, highway-sign green, road-line yellow, tail-light red.
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: { DEFAULT: "#F3ECDD", 2: "#EAE0CB", 3: "#DDCFB2", edge: "#CDBD9B" },
        coal: { DEFAULT: "#15170F", soft: "#3B3E33", mute: "#757060" },
        forest: { DEFAULT: "#0E4A23", deep: "#0A3519", sign: "#1D6B3A", leaf: "#4E8A5E", mint: "#D3E5CB" },
        road: { DEFAULT: "#171715", 2: "#1F1F1C", 3: "#292925", 4: "#34342F", line: "#3E3E38" },
        line: "#F5C518",
        tail: "#D9381E",
        // staff screens reuse these names; remapped to the asphalt + sign-green look
        brand: { 50: "#e9f3ec", 100: "#cfe5d6", 200: "#9fcbab", 300: "#5fae77", 400: "#1D6B3A", 500: "#185c31", 600: "#134d28", 700: "#0E4A23", 800: "#0b3a1b", 900: "#082c14", 950: "#041a0b" },
        ink: { 900: "#121210", 800: "#1a1a17", 700: "#22221e", 600: "#2c2c27", 500: "#3a3a34" },
        neon: "#F5C518",
      },
      fontFamily: {
        sans: ["'Readex Pro'", "system-ui", "sans-serif"],
        display: ["Lalezar", "'Readex Pro'", "sans-serif"],
        sign: ["Overpass", "'Readex Pro'", "sans-serif"],
      },
      boxShadow: {
        hard: "4px 4px 0 0 #15170F",
        "hard-sm": "2px 2px 0 0 #15170F",
        "hard-y": "4px 4px 0 0 #F5C518",
        lift: "0 18px 40px -18px rgba(21,23,15,.55)",
      },
    },
  },
  plugins: [],
} satisfies Config;
