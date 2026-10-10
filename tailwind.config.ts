import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0F1620",
          light: "#1B2735",
        },
        charcoal: "#1C1F26",
        champagne: {
          DEFAULT: "#C9A66B",
          light: "#E4D3AE",
          dark: "#A9814C",
        },
        ivory: "#F8F6F1",
        sand: "#EDE7DA",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      borderRadius: {
        xl: "0.9rem",
      },
      boxShadow: {
        soft: "0 10px 40px -12px rgba(15,22,32,0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
