"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, PencilLine, Search, ShieldCheck, Sparkles } from "lucide-react";

const NAV = [
  { href: "/", label: "Browse", icon: BookOpen, exact: true },
  { href: "/submit", label: "Submit", icon: PencilLine },
  { href: "/track", label: "Track", icon: Search },
  { href: "/admin", label: "Admin", icon: ShieldCheck },
];

export function SiteHeader() {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-bg/70 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 shadow-glow">
            <Sparkles className="h-4 w-4 text-zinc-950" strokeWidth={2.5} />
          </span>
          <span className="text-base font-semibold tracking-tight">
            Incident<span className="text-brand-400">Stories</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-surface-raised text-fg"
                    : "text-fg-muted hover:bg-surface hover:text-fg"
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
