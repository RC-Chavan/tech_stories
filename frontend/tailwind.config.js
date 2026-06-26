/** @type {import('tailwindcss').Config} */
const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Layered surfaces (zinc-based neutrals + cool tint)
        bg: {
          DEFAULT: "#09090b", // app background (zinc-950)
          subtle: "#0c0c10",
        },
        surface: {
          DEFAULT: "#111114", // cards (zinc-900)
          raised: "#16161b", // elevated cards / popovers
          inset: "#0a0a0d",  // inputs / code blocks
        },
        border: {
          DEFAULT: "#27272a", // zinc-800
          strong: "#3f3f46", // zinc-700
          subtle: "rgba(255,255,255,0.06)",
        },
        // Foreground
        fg: {
          DEFAULT: "#fafafa",
          muted: "#a1a1aa",
          subtle: "#71717a",
        },
        // Brand: cool teal/cyan — used sparingly for focus + primary CTA
        brand: {
          50:  "#ecfeff",
          100: "#cffafe",
          200: "#a5f3fc",
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
          700: "#0e7490",
          800: "#155e75",
          900: "#164e63",
        },
        // Semantic
        success: "#34d399",
        warning: "#fbbf24",
        danger:  "#f87171",
        info:    "#818cf8",
      },
      fontFamily: {
        sans: ["var(--font-inter)", ...defaultTheme.fontFamily.sans],
        mono: ["var(--font-mono)", ...defaultTheme.fontFamily.mono],
      },
      fontSize: {
        // Tighter, more refined tracking on display sizes
        "display-1": ["clamp(2.75rem, 5vw, 4rem)", { lineHeight: "1.05", letterSpacing: "-0.035em", fontWeight: "600" }],
        "display-2": ["clamp(2rem, 3.5vw, 2.75rem)", { lineHeight: "1.1", letterSpacing: "-0.025em", fontWeight: "600" }],
      },
      boxShadow: {
        // Soft, layered shadows (not the default heavy ones)
        "soft":   "0 1px 2px 0 rgba(0,0,0,0.3), 0 1px 3px 0 rgba(0,0,0,0.15)",
        "elev":   "0 4px 6px -1px rgba(0,0,0,0.4), 0 2px 4px -2px rgba(0,0,0,0.3)",
        "glow":   "0 0 0 1px rgba(34,211,238,0.25), 0 8px 32px -8px rgba(34,211,238,0.35)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      animation: {
        "fade-in":   "fadeIn 0.4s ease-out both",
        "fade-up":   "fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        "pulse-dot": "pulseDot 1.4s ease-in-out infinite",
        "shimmer":   "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeIn:   { from: { opacity: "0" }, to: { opacity: "1" } },
        fadeUp:   {
          from: { opacity: "0", transform: "translateY(8px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%":      { opacity: "0.5", transform: "scale(0.85)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      backgroundImage: {
        "grid-fade":
          "linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px)",
        "gradient-radial":
          "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(34,211,238,0.15), transparent 60%)",
      },
      backgroundSize: {
        "grid-32": "32px 32px",
      },
    },
  },
  plugins: [],
};
