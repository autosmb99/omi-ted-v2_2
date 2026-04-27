import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["DM Serif Display", "Georgia", "serif"],
        ui:      ["Plus Jakarta Sans", "sans-serif"],
        te:      ["Noto Sans Telugu", "sans-serif"],
        mono:    ["JetBrains Mono", "monospace"],
      },
      colors: {
        cream: "#FAF8F5",
        ink:   "#1C1917",
        gold:  "#B45309",
        green: "#15803D",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.05)",
        lift: "0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.05)",
      },
    },
  },
  plugins: [],
};
export default config;
