import type { Config } from "tailwindcss";

const config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Montserrat is bundled with the app (@fontsource), so it works offline.
        sans: ["Montserrat", "Segoe UI", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // The Islamia Printers maroon from the logo and bill book (#991F36 is 600).
        brand: {
          50: "#fdf2f4",
          100: "#fbe4e9",
          200: "#f5c4cf",
          300: "#ec97a9",
          400: "#de627d",
          500: "#c43a59",
          600: "#991f36",
          700: "#841a2f",
          800: "#6c1627",
          900: "#561320",
          950: "#2f0811",
        },
        // Warm greys with a hint of the maroon, replacing Tailwind's blue-grey slate everywhere.
        slate: {
          50: "#faf8f8",
          100: "#f4f0f1",
          200: "#e9e3e5",
          300: "#d7cdd1",
          400: "#a99ca1",
          500: "#7e7075",
          600: "#5f5358",
          700: "#4a4045",
          800: "#2e272a",
          900: "#201b1d",
          950: "#141012",
        },
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
      },
      boxShadow: {
        card: "0 1px 2px rgba(47, 8, 17, 0.04), 0 8px 24px -12px rgba(47, 8, 17, 0.12)",
        brand: "0 6px 16px -6px rgba(153, 31, 54, 0.55)",
      },
    },
  },
  plugins: [],
} satisfies Config;

export default config;
