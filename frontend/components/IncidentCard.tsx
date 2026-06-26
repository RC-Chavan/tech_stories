import Link from "next/link";
import { ArrowUpRight, Clock } from "lucide-react";
import type { IncidentSummary } from "@/lib/types";

export function IncidentCard({ item }: { item: IncidentSummary }) {
  const dateLabel = item.approved_at
    ? new Date(item.approved_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <Link
      href={`/stories/${item.slug}`}
      className="group relative flex h-full flex-col card card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60"
    >
      {/* Top accent on hover */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-400/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />

      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold leading-snug text-fg transition-colors group-hover:text-brand-300">
          {item.title}
        </h3>
        <ArrowUpRight
          className="h-4 w-4 shrink-0 text-fg-subtle transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-400"
          strokeWidth={2}
        />
      </div>

      <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-fg-muted">
        {item.summary}
      </p>

      {dateLabel && (
        <div className="mt-auto flex items-center gap-1.5 pt-5 text-xs text-fg-subtle">
          <Clock className="h-3.5 w-3.5" strokeWidth={2} />
          <time dateTime={item.approved_at ?? undefined}>{dateLabel}</time>
        </div>
      )}
    </Link>
  );
}
