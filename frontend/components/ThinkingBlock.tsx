"use client";

import { useState } from "react";
import { Brain, ChevronDown } from "lucide-react";

/**
 * Renders the LLM's reasoning trace (qwen3 'thinking', OpenAI o-series reasoning,
 * etc.) in a collapsed disclosure. Reasoning can be 5–20k chars; we keep it
 * closed by default so it doesn't dominate the page.
 *
 * If `notes` is null/empty the block renders nothing — useful when the provider
 * didn't emit any thinking.
 */
export function ThinkingBlock({
  notes,
  defaultOpen = false,
  variant = "default",
}: {
  notes: string | null | undefined;
  defaultOpen?: boolean;
  /** "default" is for the public story page; "admin" uses a more saturated style. */
  variant?: "default" | "admin";
}) {
  // <details> only exposes a boolean `open` attribute (no `defaultOpen`), so we
  // seed the open state from `defaultOpen` on mount and then let the user toggle.
  const [open, setOpen] = useState(defaultOpen);

  if (!notes || notes.trim().length === 0) return null;

  const isAdmin = variant === "admin";
  const accent = isAdmin
    ? "bg-brand-500/10 text-brand-300 border-brand-500/30"
    : "bg-info/10 text-info border-info/30";
  const eyebrow = isAdmin ? "AI Reasoning" : "How this story was built";
  const title = isAdmin ? "Model thinking" : "AI insight & reasoning";
  const blurb = isAdmin
    ? "The model's internal chain of thought used to draft this STAR writeup. Useful for spotting reasoning errors."
    : "A peek at the reasoning the model used to turn rough notes into a polished STAR writeup.";

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="card group/open overflow-hidden"
    >
      <summary className="flex cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden">
        <span
          className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${accent}`}
          aria-hidden="true"
        >
          <Brain className="h-4 w-4" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{eyebrow}</p>
          <h3 className="mt-1 text-base font-semibold text-fg">{title}</h3>
          <p className="mt-1 text-xs text-fg-subtle">{blurb}</p>
        </div>
        <ChevronDown
          className="mt-1 h-4 w-4 shrink-0 text-fg-subtle transition-transform group-open/open:rotate-180"
          strokeWidth={2}
          aria-hidden="true"
        />
      </summary>
      <pre className="mt-4 max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-lg border border-border-subtle bg-surface-2 p-4 text-xs leading-relaxed text-fg-muted">
        {notes}
      </pre>
    </details>
  );
}