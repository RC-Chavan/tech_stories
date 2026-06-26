import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Code2, ListChecks } from "lucide-react";
import { api } from "@/lib/api";
import { StarSection } from "@/components/StarSection";
import { ModerationFlags } from "@/components/ModerationFlags";
import { CopyButton } from "@/components/CopyButton";
import { ShareButton } from "@/components/ShareButton";
import { ThinkingBlock } from "@/components/ThinkingBlock";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  try {
    const incident = await api.getIncident(params.slug);
    return {
      title: incident.title,
      description: incident.summary,
      openGraph: {
        title: incident.title,
        description: incident.summary,
        type: "article",
      },
    };
  } catch {
    return { title: "Story not found" };
  }
}

export default async function StoryPage({
  params,
}: {
  params: { slug: string };
}) {
  let incident;
  try {
    incident = await api.getIncident(params.slug);
  } catch (e: any) {
    if (e?.status === 404) notFound();
    throw e;
  }

  const dateLabel = incident.approved_at
    ? new Date(incident.approved_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const summaryCopy = `Quick summary — ${incident.title}\n\n${incident.summary}\n\n— via IncidentStories`;

  return (
    <article className="mx-auto max-w-3xl space-y-12">
      {/* ── Breadcrumb ── */}
      <nav className="animate-fade-in">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
          All stories
        </Link>
      </nav>

      {/* ── Header ── */}
      <header className="space-y-4 animate-fade-up">
        <div className="flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
          {dateLabel && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" strokeWidth={2} />
              <time dateTime={incident.approved_at ?? undefined}>
                {dateLabel}
              </time>
            </span>
          )}
          <span aria-hidden="true">·</span>
          <span className="font-mono">/{incident.slug}</span>
        </div>

        <h1 className="text-display-1 text-fg">{incident.title}</h1>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <ShareButton />
          <Link href="/submit" className="btn">
            Share yours
          </Link>
        </div>
      </header>

      {/* ── Quick summary ── */}
      <section className="card animate-fade-up border-brand-500/20 bg-gradient-to-br from-brand-500/[0.04] to-transparent">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand-500/30 bg-brand-500/10">
            <ListChecks className="h-4 w-4 text-brand-300" strokeWidth={2.25} />
          </span>
          <div className="flex-1">
            <div className="flex items-center">
              <p className="eyebrow text-brand-300">30-second quick summary</p>
              <CopyButton text={summaryCopy} label="Copy quick summary" />
            </div>
            <p className="mt-2 text-lg leading-relaxed text-fg">
              {incident.summary}
            </p>
          </div>
        </div>
      </section>

      {/* ── STAR ── */}
      <StarSection star={incident.star} />

      {/* ── Technical points ── */}
      <section className="space-y-4">
        <header className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-raised">
            <Code2 className="h-4 w-4 text-fg-muted" strokeWidth={2.25} />
          </span>
          <div>
            <p className="eyebrow">Deep dive</p>
            <h2 className="text-display-2 mt-0.5">Technical points</h2>
          </div>
        </header>

        <ul className="space-y-3">
          {incident.technical_points.map((p, i) => (
            <li
              key={i}
              className="card flex items-start gap-3 text-sm leading-relaxed text-fg-muted"
            >
              <span
                aria-hidden="true"
                className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border bg-surface-raised text-[10px] font-mono font-medium text-fg-muted"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-fg-muted">{p}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Moderation flags (public for transparency) ── */}
      <ModerationFlags flags={incident.moderation_flags} />

      {/* ── AI reasoning (opt-in disclosure) ── */}
      <ThinkingBlock notes={incident.thinking_notes} />

      {/* ── Footer CTA ── */}
      <section className="card flex flex-col items-start justify-between gap-3 border-dashed sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold text-fg">Got your own incident?</p>
          <p className="text-sm text-fg-muted">
            Turn rough notes into a polished STAR writeup in seconds.
          </p>
        </div>
        <Link href="/submit" className="btn btn-primary">
          Submit yours
        </Link>
      </section>
    </article>
  );
}
