"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  Clock,
  Loader2,
  Mail,
  Search,
  ShieldX,
  XCircle,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { IncidentStatus } from "@/lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function TrackInner() {
  const params = useSearchParams();
  const prefillId = params.get("prefill") || "";

  const [id, setId] = useState(prefillId);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<IncidentStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const idValid = id.trim().length > 0;
  const emailValid = EMAIL_RE.test(email.trim());
  const canSearch = idValid && emailValid && !loading;

  // Auto-search when arriving with a prefill id + remembered email (saved on submit success).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const remembered = window.localStorage.getItem("track:lastEmail");
    if (prefillId && remembered && EMAIL_RE.test(remembered)) {
      setEmail(remembered);
      void runSearch(prefillId, remembered);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSearch = async (idVal: string, emailVal: string) => {
    setError(null);
    setStatus(null);
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await api.getStatus(idVal.trim(), emailVal.trim());
      setStatus(res);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("track:lastEmail", emailVal.trim());
      }
    } catch (e: any) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 400)) {
        setError(
          "We couldn't find a submission with that ID and email. Double-check both — the ID is a long string of letters/numbers/dashes from your confirmation screen.",
        );
      } else {
        setError(e?.message || "Lookup failed. Try again in a moment.");
      }
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSearch) return;
    await runSearch(id, email);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8 animate-fade-up">
      <header className="space-y-3">
        <p className="eyebrow">Track</p>
        <h1 className="text-display-1">Check your submission status.</h1>
        <p className="max-w-2xl text-base leading-relaxed text-fg-muted">
          Paste the incident ID we showed you after submission, plus the email
          you used. No account needed.
        </p>
      </header>

      <form onSubmit={onSubmit} className="card space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="id" className="text-sm font-medium text-fg">
            Incident ID
          </label>
          <input
            id="id"
            type="text"
            className="input font-mono text-xs"
            placeholder="e.g. 7a4e9c12-..."
            value={id}
            onChange={(e) => setId(e.target.value)}
            disabled={loading}
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-fg">
            Email used on submission
          </label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle"
              strokeWidth={2}
            />
            <input
              id="email"
              type="email"
              className="input pl-9"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
            />
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/[0.04] p-3 text-sm text-danger"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button type="submit" className="btn btn-primary" disabled={!canSearch}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Looking up…
              </>
            ) : (
              <>
                <Search className="h-4 w-4" strokeWidth={2.25} />
                Check status
              </>
            )}
          </button>
        </div>
      </form>

      {status && <StatusCard status={status} />}

      {!hasSearched && !status && (
        <div className="card border-dashed text-sm text-fg-muted">
          After you submit, we&apos;ll show you the ID and your email on a
          confirmation screen — save those somewhere safe and come back here.
        </div>
      )}
    </div>
  );
}

function StatusCard({ status }: { status: IncidentStatus }) {
  const visual = (() => {
    switch (status.status) {
      case "approved":
        return {
          badge: "bg-success/10 text-success border-success/30",
          icon: <CheckCircle2 className="h-5 w-5 text-success" strokeWidth={2.25} />,
          eyebrow: "Approved",
        };
      case "rejected":
        return {
          badge: "bg-danger/10 text-danger border-danger/30",
          icon: <XCircle className="h-5 w-5 text-danger" strokeWidth={2.25} />,
          eyebrow: "Not approved",
        };
      default:
        return {
          badge: "bg-warning/10 text-warning border-warning/30",
          icon: <CircleDashed className="h-5 w-5 text-warning" strokeWidth={2.25} />,
          eyebrow: "In review",
        };
    }
  })();

  return (
    <div className="card space-y-4">
      <div className="flex items-start gap-3 border-b border-border-subtle pb-4">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface-raised">
          {visual.icon}
        </span>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`badge border ${visual.badge}`}>{visual.eyebrow}</span>
            <span className="inline-flex items-center gap-1.5 text-xs text-fg-subtle">
              <CalendarClock className="h-3.5 w-3.5" strokeWidth={2} />
              Submitted {new Date(status.created_at).toLocaleString()}
            </span>
            {status.approved_at && (
              <span className="inline-flex items-center gap-1.5 text-xs text-fg-subtle">
                <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                Approved {new Date(status.approved_at).toLocaleString()}
              </span>
            )}
          </div>
          <p className="mt-2 text-lg font-semibold text-fg">{status.title}</p>
        </div>
      </div>

      {status.status === "pending" && (
        <p className="text-sm text-fg-muted">
          We&apos;re still working on it — the AI is polishing your notes and an
          admin will review shortly. You&apos;ll get an email when there&apos;s
          a decision.
        </p>
      )}

      {status.status === "approved" && status.slug && (
        <div className="rounded-lg border border-success/30 bg-success/[0.04] p-4">
          <p className="text-sm text-fg">
            Your story is live. Share it with anyone:
          </p>
          <Link
            href={`/stories/${status.slug}`}
            className="btn btn-primary mt-3 w-full justify-center"
          >
            View the published story
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      )}

      {status.status === "rejected" && (
        <div className="space-y-2 rounded-lg border border-danger/30 bg-danger/[0.04] p-4">
          <div className="flex items-start gap-2">
            <ShieldX className="mt-0.5 h-4 w-4 shrink-0 text-danger" strokeWidth={2.25} />
            <div>
              <p className="text-sm font-medium text-fg">Reason from the admin</p>
              <p className="mt-1 text-sm text-fg-muted">
                {status.rejection_reason || "No reason provided."}
              </p>
            </div>
          </div>
          <p className="pt-1 text-xs text-fg-subtle">
            Want to try again with a different story?{" "}
            <Link href="/submit" className="text-brand-300 underline hover:text-brand-200">
              Submit a new one
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 text-fg-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      }
    >
      <TrackInner />
    </Suspense>
  );
}