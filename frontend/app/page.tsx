import { AlertOctagon, BookOpen, Settings2, Sparkles } from "lucide-react";
import Link from "next/link";
import { api, ApiConfigError } from "@/lib/api";
import type { IncidentSummary } from "@/lib/types";
import { IncidentCard } from "@/components/IncidentCard";
import { StoryGridSkeleton } from "@/components/StoryGridSkeleton";

export const revalidate = 60; // ISR: re-fetch list every 60s

export default async function HomePage() {
  let items: IncidentSummary[] = [];
  let error: string | null = null;
  let configMissing = false;
  try {
    const res = await api.listIncidents(1, 24);
    items = res.items;
  } catch (e: any) {
    if (e instanceof ApiConfigError) {
      configMissing = true;
    }
    error = e?.message || "Could not load stories";
  }

  return (
    <div className="space-y-16">
      {/* ───── Hero ───── */}
      <section className="relative animate-fade-up">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-raised/60 px-3 py-1 text-xs text-fg-muted backdrop-blur">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-400" />
          </span>
          AI-assisted · human-reviewed
        </div>

        <h1 className="mt-5 text-display-1 text-fg">
          Real incidents.{" "}
          <span className="bg-gradient-to-br from-brand-200 via-brand-400 to-brand-600 bg-clip-text text-transparent">
            Polished stories.
          </span>
        </h1>

        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-fg-muted">
          Engineers paste rough notes from production incidents. AI turns them
          into{" "}
          <span className="text-fg">STAR-format writeups</span> with a
          quick summary — browsable, borrowable, and built by people who
          actually shipped the fixes.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link href="/submit" className="btn btn-primary btn-lg group">
            <Sparkles className="h-4 w-4" strokeWidth={2.25} />
            Share your incident
          </Link>
          <Link href="#stories" className="btn btn-lg">
            <BookOpen className="h-4 w-4" strokeWidth={2} />
            Browse stories
          </Link>
        </div>

        <dl className="mt-10 grid max-w-2xl grid-cols-3 gap-4 border-y border-border-subtle py-5">
          <div>
            <dt className="text-xs text-fg-subtle">Format</dt>
            <dd className="mt-1 text-base font-semibold text-fg">STAR</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-subtle">Read time</dt>
            <dd className="mt-1 text-base font-semibold text-fg">~30 sec quick summary</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-subtle">Moderation</dt>
            <dd className="mt-1 text-base font-semibold text-fg">
              PII &amp; toxicity flagged
            </dd>
          </div>
        </dl>
      </section>

      {/* ───── Stories grid ───── */}
      <section id="stories" className="scroll-mt-24 space-y-6">
        <header className="flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Library</p>
            <h2 className="text-display-2 mt-1">Latest stories</h2>
          </div>
          <span className="badge">
            {items.length} {items.length === 1 ? "story" : "stories"}
          </span>
        </header>

        {configMissing && (
          <div
            role="alert"
            className="card border-warning/40 bg-warning/[0.04]"
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-warning/30 bg-warning/10">
                <Settings2
                  className="h-4 w-4 text-warning"
                  strokeWidth={2.25}
                />
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-warning">
                  Backend URL not configured
                </p>
                <p className="mt-1 text-sm text-fg-muted">
                  Add{" "}
                  <code className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-xs text-fg">
                    NEXT_PUBLIC_API_BASE_URL
                  </code>{" "}
                  to{" "}
                  <code className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-xs text-fg">
                    frontend/.env.local
                  </code>{" "}
                  and restart the dev server. Example:
                </p>
                <pre className="code-block mt-3 text-xs">
{`NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`}
                </pre>
              </div>
            </div>
          </div>
        )}

        {!configMissing && error && (
          <div
            role="alert"
            className="card flex items-start gap-3 border-danger/40 bg-danger/[0.04]"
          >
            <AlertOctagon
              className="mt-0.5 h-4 w-4 shrink-0 text-danger"
              strokeWidth={2.25}
            />
            <div>
              <p className="text-sm font-medium text-danger">
                Could not load stories
              </p>
              <p className="mt-1 text-sm text-fg-muted">{error}</p>
            </div>
          </div>
        )}

        {!error && items.length === 0 && (
          <div className="card flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-surface-raised">
              <BookOpen className="h-5 w-5 text-fg-muted" strokeWidth={2} />
            </div>
            <p className="text-base font-medium text-fg">No stories yet</p>
            <p className="max-w-sm text-sm text-fg-muted">
              Be the first to share an incident. The AI turns rough notes into
              a STAR-format writeup in seconds.
            </p>
            <Link href="/submit" className="btn btn-primary mt-2">
              Submit the first one
            </Link>
          </div>
        )}

        {!error && items.length > 0 && (
          <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <IncidentCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
