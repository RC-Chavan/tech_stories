"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Info,
  Mail,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { api } from "@/lib/api";
import { CopyButton } from "@/components/CopyButton";
import { ModerationFlags } from "@/components/ModerationFlags";
import type { SubmitResponse } from "@/lib/types";

const MIN_CHARS = 20;
const RECOMMENDED_CHARS = 200;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SubmitPage() {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const voice = useVoiceInput();

  const charCount = text.length;
  const trimmedEmail = email.trim();
  const emailValid = EMAIL_RE.test(trimmedEmail);
  const isValid = charCount >= MIN_CHARS && emailValid;
  const progress = useMemo(
    () => Math.min(100, (charCount / RECOMMENDED_CHARS) * 100),
    [charCount],
  );

  const onChange = (v: string) => setText(v);

  const appendTranscript = () => {
    if (!voice.transcript) return;
    setText((prev) => (prev ? prev + "\n\n" + voice.transcript : voice.transcript));
    voice.reset();
  };

  const submit = async () => {
    setError(null);
    if (charCount < MIN_CHARS) {
      setError(`Please write at least ${MIN_CHARS} characters describing the incident.`);
      return;
    }
    if (!emailValid) {
      setError("Please enter a valid email — we use it to notify you on approve / reject.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.submitIncident(text, title, trimmedEmail);
      // Remember the email locally so /track can prefill it next time.
      try {
        window.localStorage.setItem("track:lastEmail", trimmedEmail);
      } catch {
        // localStorage may be disabled — not fatal.
      }
      setResult(res);
    } catch (e: any) {
      setError(e?.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  // ───────────── Success state ─────────────
  if (result) {
    const trackUrl = `/track?prefill=${encodeURIComponent(result.id)}`;
    return (
      <div className="mx-auto max-w-3xl space-y-6 animate-fade-up">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-success/30 bg-success/10">
            <CheckCircle2 className="h-5 w-5 text-success" strokeWidth={2.25} />
          </span>
          <div>
            <p className="eyebrow text-success">Submitted</p>
            <h1 className="text-display-2 mt-0.5">Thanks — queued for review.</h1>
          </div>
        </div>

        <div className="card space-y-1.5 border-brand-500/20 bg-gradient-to-br from-brand-500/[0.04] to-transparent">
          <p className="eyebrow text-brand-300">Generated title</p>
          <p className="text-lg font-semibold text-fg">{result.title}</p>
        </div>

        <div className="card space-y-1.5">
          <p className="eyebrow">Quick summary</p>
          <p className="text-base leading-relaxed text-fg-muted">{result.summary}</p>
        </div>

        <ModerationFlags flags={result.moderation_flags} />

        {/* Tracker-link panel — anonymous-friendly way to come back */}
        <div className="card space-y-3 border-brand-500/30">
          <div>
            <p className="eyebrow text-brand-300">Save these to check status later</p>
            <p className="mt-1 text-xs text-fg-subtle">
              Anyone with both the incident ID and your email can view status — there&apos;s no
              account needed. Copy them somewhere safe (password manager, notes app, etc.).
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-inset px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-fg-subtle">Incident ID</p>
                <code className="block truncate font-mono text-xs text-fg">{result.id}</code>
              </div>
              <CopyButton text={result.id} label="Copy ID" />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-inset px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-fg-subtle">Email</p>
                <code className="block truncate font-mono text-xs text-fg">{trimmedEmail}</code>
              </div>
              <CopyButton text={trimmedEmail} label="Copy email" />
            </div>
          </div>
          <Link href={trackUrl} className="btn btn-primary w-full justify-center">
            Track this submission
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>

        <div className="card border-dashed">
          <p className="text-sm text-fg-muted">{result.message}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            className="btn btn-primary"
            onClick={() => {
              setResult(null);
              setText("");
              setTitle("");
              setEmail("");
            }}
          >
            <RotateCcw className="h-4 w-4" strokeWidth={2} />
            Submit another
          </button>
          <Link href="/" className="btn">
            Back to stories <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      </div>
    );
  }

  // ───────────── Form state ─────────────
  return (
    <div className="mx-auto max-w-3xl space-y-8 animate-fade-up">
      <header className="space-y-3">
        <p className="eyebrow">New submission</p>
        <h1 className="text-display-1">Share a technical incident.</h1>
        <p className="max-w-2xl text-base leading-relaxed text-fg-muted">
          Bullet points, rough notes, voice-to-text dump — anything goes. The
          AI turns it into a polished STAR-format writeup with a quick
          summary. An admin reviews before it goes public.
        </p>
      </header>

      {/* ── Form ── */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <label htmlFor="raw" className="text-sm font-medium text-fg">
              Your incident notes
            </label>
            <p className="text-xs text-fg-subtle">
              Be specific — symptoms, timeline, root cause, fix.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {voice.supported ? (
              voice.isListening ? (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={voice.stop}
                  aria-label="Stop voice input"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
                  </span>
                  <MicOff className="h-4 w-4" strokeWidth={2} />
                  Stop
                </button>
              ) : (
                <button
                  type="button"
                  className="btn"
                  onClick={voice.start}
                  disabled={submitting}
                  title="Use your microphone (Chrome / Edge)"
                  aria-label="Start voice input"
                >
                  <Mic className="h-4 w-4" strokeWidth={2} />
                  Voice
                </button>
              )
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-fg-subtle">
                <Info className="h-3.5 w-3.5" strokeWidth={2} />
                Voice not supported — type or paste instead.
              </span>
            )}
          </div>
        </div>

        {/* Listening indicator */}
        {voice.isListening && (
          <div
            role="status"
            className="flex items-center gap-3 rounded-lg border border-danger/30 bg-danger/[0.04] px-3 py-2 text-xs text-danger"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
            </span>
            Listening… interim transcript will appear below.
          </div>
        )}

        {/* Live transcript preview */}
        {voice.transcript && voice.isListening && (
          <div className="rounded-lg border border-border bg-surface-inset p-3 text-sm text-fg-muted">
            {voice.transcript}
          </div>
        )}

        {/* Post-listening transcript actions */}
        {voice.transcript && !voice.isListening && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-500/30 bg-brand-500/[0.04] p-3">
            <div className="flex-1 text-xs text-fg-muted">
              <p className="eyebrow text-brand-300 mb-1">Voice transcript ready</p>
              <p className="line-clamp-3">{voice.transcript}</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={appendTranscript}>
              <Sparkles className="h-4 w-4" strokeWidth={2.25} />
              Append
            </button>
            <button
              type="button"
              className="btn btn-icon"
              onClick={voice.reset}
              aria-label="Discard transcript"
              title="Discard"
            >
              <Trash2 className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        )}

        <textarea
          id="raw"
          className="textarea min-h-[280px] font-mono text-sm"
          placeholder={`Paste your notes here. Example:

- Friday 11pm, payment service 5xx spiked to 18%
- root cause: stale read replica after failover
- action: forced read from primary, scaled, ran migration...`}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          disabled={submitting}
        />

        {/* Email (required — used for approve/reject notification) */}
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-fg">
            Your email <span className="text-danger">*</span>
          </label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle"
              strokeWidth={2}
            />
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              className="input pl-9"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
          </div>
          <p className="text-xs text-fg-subtle">
            We only use this to email you when your post is approved or rejected.
            You can come back and check status anytime using your incident ID + this email.
          </p>
        </div>

        {/* Title (optional — AI generates one if you leave it blank) */}
        <div className="space-y-1.5">
          <label htmlFor="title" className="text-sm font-medium text-fg">
            Title <span className="text-fg-subtle font-normal">(optional)</span>
          </label>
          <input
            id="title"
            type="text"
            maxLength={200}
            className="input"
            placeholder="e.g. Replica failover cascade took down payments for 40 min"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting}
          />
          <p className="text-xs text-fg-subtle">
            If you give it one, we&apos;ll use your title as-is. Otherwise the AI picks the best one.
          </p>
        </div>

        {/* Character meter */}
        <div className="space-y-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-inset">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                !isValid
                  ? "bg-fg-subtle"
                  : progress < 100
                  ? "bg-warning"
                  : "bg-success"
              }`}
              style={{ width: `${progress}%` }}
              aria-hidden="true"
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-fg-subtle">
              <span className="font-mono text-fg-muted">{charCount}</span>{" "}
              characters · minimum {MIN_CHARS}
            </span>
            <span
              className={`inline-flex items-center gap-1 ${
                !isValid
                  ? "text-fg-subtle"
                  : progress < 100
                  ? "text-warning"
                  : "text-success"
              }`}
            >
              <Zap className="h-3 w-3" strokeWidth={2.25} />
              {isValid
                ? progress < 100
                  ? "Good start — more detail = better story"
                  : "Plenty of detail"
                : `${MIN_CHARS - charCount} more to go`}
            </span>
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

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-xs text-fg-subtle">
            Saved as <em>pending</em> until an admin approves.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={submit}
            disabled={submitting || !isValid}
          >
            {submitting ? (
              <>
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent" />
                Processing…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" strokeWidth={2.25} />
                Submit
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Process explainer ── */}
      <details className="group rounded-xl border border-border bg-surface px-4 py-3 text-sm open:bg-surface-raised">
        <summary className="flex cursor-pointer list-none items-center justify-between text-fg-muted transition-colors hover:text-fg">
          <span className="font-medium">What happens after I submit?</span>
          <span className="text-fg-subtle transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="mt-3 space-y-2 text-fg-muted">
          <p>
            Your raw notes and the AI-generated STAR writeup are saved as{" "}
            <em className="text-fg">pending</em>. An admin reviews them
            (including any moderation flags the AI raised) and either approves
            them (they go live) or rejects them (with a reason).
          </p>
          <p>
            Approved stories are visible to everyone on the home page.
          </p>
        </div>
      </details>
    </div>
  );
}
