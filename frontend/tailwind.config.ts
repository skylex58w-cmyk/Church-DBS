import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17251f",
        forest: "#174d3a",
        moss: "#dce9df",
        paper: "#f6f7f3",
        gold: "#c49a53",
      },
      boxShadow: {
        soft: "0 18px 55px rgba(23, 37, 31, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
