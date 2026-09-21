import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f3f4ff",
          100: "#e8e9ff",
          200: "#d3d5ff",
          300: "#b0b3fd",
          400: "#8b8bf9",
          500: "#6c63f0",
          600: "#5a4fe0",
          700: "#4b3fc4",
          800: "#3d349e",
          900: "#342e7d",
        },
        surface: {
          DEFAULT: "#f6f7fc",
          card: "#ffffff",
          muted: "#eef0fa",
        },
        ink: {
          900: "#181a2a",
          700: "#3f4258",
          500: "#6b6e85",
          300: "#a2a4b8",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(24,26,42,0.04), 0 8px 24px -8px rgba(24,26,42,0.08)",
        pop: "0 4px 14px rgba(92,79,224,0.25)",
      },
    },
  },
  plugins: [],
};
export default config;
