import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Incident Stories — Real incidents. Polished writeups.",
    template: "%s · Incident Stories",
  },
  description:
    "Engineers paste rough notes from production incidents. AI turns them into STAR-format writeups with a quick summary.",
  applicationName: "Incident Stories",
  authors: [{ name: "Incident Stories" }],
  keywords: [
    "incident stories",
    "STAR format",
    "production incidents",
    "incident post-mortem",
    "engineering writeups",
  ],
  // Favicons. Next.js App Router auto-serves /app/icon.svg as <link rel="icon">,
  // but we declare them explicitly so the SVG is used by modern browsers
  // and we keep a 32x32 PNG fallback for older clients and pinned tabs.
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
  },
  openGraph: {
    title: "Incident Stories",
    description:
      "Real engineering incidents turned into polished STAR-format writeups.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Incident Stories",
    description:
      "Real engineering incidents turned into polished STAR-format writeups.",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <div className="relative isolate min-h-screen">
          {/* Decorative ambient glow + dot grid */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] bg-gradient-radial"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] bg-dot-pattern opacity-60 mask-fade-bottom"
          />

          <SiteHeader />

          <main className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
            <div className="animate-fade-in">{children}</div>
          </main>

          <footer className="border-t border-border-subtle">
            <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-fg-subtle sm:flex-row">
              <span>
                Built for engineers who want their incidents written up well. AI-generated drafts,
                human-reviewed before publishing.
              </span>
              <span className="font-mono">v0.1</span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
