import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#050505",
          secondary: "#090909",
          elevated: "#101010",
          surface: "#151515",
        },
        text: {
          primary: "#F5F4F2",
          secondary: "#A8A8B0",
          muted: "#707078",
        },
        copper: {
          champagne: "#FDE6C4",
          light: "#F0A868",
          DEFAULT: "#D9793B",
          deep: "#8C421A",
          bronze: "#3D1A08",
        },
        violet: {
          soft: "#B49AF5",
          DEFAULT: "#8B5CF6",
          deep: "#4C1D95",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
