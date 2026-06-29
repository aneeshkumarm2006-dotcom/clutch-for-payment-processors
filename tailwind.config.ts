import type { Config } from "tailwindcss";

// Mono Minimal design system — see _ai_context/DESIGN_Payment.md §10.2
export default {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1rem", lg: "1.5rem" },
      screens: { "2xl": "1200px" },
    },
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: { DEFAULT: "var(--card)", foreground: "var(--card-foreground)" },
        popover: { DEFAULT: "var(--popover)", foreground: "var(--popover-foreground)" },
        primary: { DEFAULT: "var(--primary)", foreground: "var(--primary-foreground)" },
        secondary: { DEFAULT: "var(--secondary)", foreground: "var(--secondary-foreground)" },
        muted: { DEFAULT: "var(--muted)", foreground: "var(--muted-foreground)" },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
          subtle: "var(--accent-subtle)",
          "subtle-foreground": "var(--accent-subtle-foreground)",
        },
        destructive: { DEFAULT: "var(--destructive)", foreground: "var(--destructive-foreground)" },
        success: "var(--success)",
        warning: "var(--warning)",
        star: "var(--star)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        input: "var(--input)",
        ring: "var(--ring)",
        // raw ramps for fine-grained use
        ink: {
          0: "#FFFFFF", 50: "#FAFAFA", 100: "#F5F5F5", 150: "#EFEFEF", 200: "#E8E8E8",
          300: "#D4D4D4", 400: "#A3A3A3", 500: "#737373", 600: "#525252", 700: "#404040",
          800: "#262626", 900: "#171717", 950: "#0A0A0A",
        },
        violet: {
          50: "#F5F3FF", 100: "#EDE9FE", 200: "#DDD6FE", 300: "#C4B5FD", 400: "#A78BFA",
          500: "#8B5CF6", 600: "#6D28D9", 700: "#5B21B6", 800: "#4C1D95",
        },
      },
      borderRadius: { sm: "6px", DEFAULT: "8px", md: "8px", lg: "12px" },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: { tightish: "-0.015em", tighter2: "-0.025em", tightest2: "-0.03em" },
      fontSize: {
        // Mono Minimal type scale — DESIGN §3.1
        display: ["clamp(2.25rem, 5vw, 3.25rem)", { lineHeight: "1.05", letterSpacing: "-0.03em", fontWeight: "600" }],
        h1: ["2.125rem", { lineHeight: "1.1", letterSpacing: "-0.025em", fontWeight: "600" }],
        h2: ["1.5rem", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "600" }],
        h3: ["1.125rem", { lineHeight: "1.3", letterSpacing: "-0.015em", fontWeight: "600" }],
        h4: ["1rem", { lineHeight: "1.4", letterSpacing: "-0.01em", fontWeight: "600" }],
        "body-lg": ["1.0625rem", { lineHeight: "1.6" }],
        body: ["0.9375rem", { lineHeight: "1.6" }],
        small: ["0.8125rem", { lineHeight: "1.5" }],
        label: ["0.75rem", { lineHeight: "1.4", letterSpacing: "0.06em", fontWeight: "500" }],
        micro: ["0.6875rem", { lineHeight: "1.3", fontWeight: "500" }],
      },
      boxShadow: {
        sm: "0 1px 2px rgba(0,0,0,0.04)",
        pop: "0 8px 24px rgba(0,0,0,0.08)",
      },
      maxWidth: { prose: "720px", content: "1200px" },
      transitionTimingFunction: { entrance: "cubic-bezier(0.16, 1, 0.3, 1)" },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
