"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleDashed,
  Inbox,
  Loader2,
  LogOut,
  LucideIcon,
  Mail,
  RotateCcw,
  ShieldCheck,
  ShieldX,
  Sparkles,
  X,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "@/lib/supabase";
import { api, ApiError } from "@/lib/api";
import type { IncidentDetail, ModerationFlags as MF } from "@/lib/types";
import { ModerationFlags } from "@/components/ModerationFlags";
import { StarSection } from "@/components/StarSection";
import { ThinkingBlock } from "@/components/ThinkingBlock";
import { ModelPicker } from "@/components/ModelPicker";
import { DEFAULT_MODEL_ID } from "@/lib/freeModels";

type TabStatus = "pending" | "approved" | "rejected" | "archived";

const TAB_META: Record<
  TabStatus,
  { label: string; icon: LucideIcon; emptyTitle: string; emptyHint: string }
> = {
  pending: {
    label: "Pending",
    icon: CircleDashed,
    emptyTitle: "All caught up",
    emptyHint: "No pending incidents. Nice work.",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle2,
    emptyTitle: "Nothing approved yet",
    emptyHint: "Approved stories show up here once an admin signs them off.",
  },
  rejected: {
    label: "Rejected",
    icon: ShieldX,
    emptyTitle: "Nothing rejected yet",
    emptyHint: "Rejected incidents (with reason) appear here so they can be reviewed or reopened.",
  },
  archived: {
    label: "Archived",
    icon: Archive,
    emptyTitle: "Archive is empty",
    emptyHint:
      "Use Archive on any item in the other tabs to remove it from the queue without deleting it. Restoring an item sends it back to Pending.",
  },
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState<TabStatus>("pending");
  const [items, setItems] = useState<IncidentDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [regenPrompt, setRegenPrompt] = useState<Record<string, string>>({});
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL_ID);

  // Auth bootstrap
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadTab = useCallback(
    async (which: TabStatus, token: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.listAdmin(which, 1, token);
        setItems(res.items);
      } catch (e: any) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          setError(
            e.status === 403
              ? "You're signed in, but this account is not an admin yet. Ask the project owner to run: update profiles set is_admin = true where id = '" +
                session?.user?.id +
                "'; in the Supabase SQL editor."
              : "Session expired — please sign in again.",
          );
          return;
        }
        setError(e?.message || "Failed to load queue");
      } finally {
        setLoading(false);
      }
    },
    [session?.user?.id],
  );

  // Load queue when session or tab changes
  useEffect(() => {
    if (!session) return;
    void loadTab(tab, session.access_token);
  }, [session, tab, loadTab]);

  const onTabChange = (next: TabStatus) => {
    if (next === tab) return;
    setItems([]);
    setRejectReason({});
    setRegenPrompt({});
    setTab(next);
  };

  const action = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      // Remove from the current tab — if approving from pending it disappears, etc.
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e: any) {
      setError(`Action failed: ${e?.message || e}`);
    } finally {
      setBusyId(null);
    }
  };

  const counts = items.length; // current tab count; the badge shows just this tab

  if (!authChecked) {
    return (
      <div className="flex items-center gap-2 text-fg-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking session…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-md py-20 text-center animate-fade-up">
        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-surface-raised">
          <ShieldCheck className="h-5 w-5 text-fg-muted" strokeWidth={2} />
        </div>
        <h1 className="mt-5 text-display-2">Admin only</h1>
        <p className="mt-2 text-sm text-fg-muted">
          You need to sign in as an admin to review the queue.
        </p>
        <Link href="/admin/login" className="btn btn-primary mt-6">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4 animate-fade-up">
        <div>
          <p className="eyebrow">Review</p>
          <h1 className="text-display-1 mt-1">Admin queue</h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-fg-muted">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-success" />
            Signed in as{" "}
            <code className="rounded bg-surface-raised px-1.5 py-0.5 text-xs">
              {session.user.email}
            </code>
          </p>
        </div>
        <button
          className="btn"
          onClick={async () => {
            await getSupabaseBrowser().auth.signOut();
            router.replace("/admin/login");
          }}
        >
          <LogOut className="h-4 w-4" strokeWidth={2} />
          Sign out
        </button>
      </header>

      {/* Tabs */}
      <div role="tablist" className="flex flex-wrap gap-2 animate-fade-up">
        {(Object.keys(TAB_META) as TabStatus[]).map((key) => {
          const meta = TAB_META[key];
          const Icon = meta.icon;
          const active = tab === key;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={active}
              onClick={() => onTabChange(key)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${
                active
                  ? "border-brand-500/40 bg-brand-500/[0.08] text-fg"
                  : "border-border bg-surface text-fg-muted hover:bg-surface-raised hover:text-fg"
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
              {meta.label}
              {active && (
                <span className="rounded-md bg-surface-inset px-1.5 py-0.5 font-mono text-[10px] text-fg-muted">
                  {counts}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Stats row (only meaningful on pending; collapses on other tabs) */}
      {tab === "pending" && (
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3 animate-fade-up">
          <div className="card">
            <dt className="eyebrow">In queue</dt>
            <dd className="mt-2 flex items-baseline gap-2 text-2xl font-semibold text-fg">
              <Inbox className="h-4 w-4 text-fg-muted" strokeWidth={2} />
              {items.length}
            </dd>
          </div>
          <div className="card">
            <dt className="eyebrow">Status</dt>
            <dd className="mt-2 flex items-center gap-2 text-sm font-medium text-warning">
              <CircleDashed className="h-4 w-4" strokeWidth={2.25} />
              Awaiting review
            </dd>
          </div>
          <div className="card">
            <dt className="eyebrow">Auto-flags</dt>
            <dd className="mt-2 text-sm font-medium text-fg-muted">
              PII · toxicity · low-quality
            </dd>
          </div>
        </dl>
      )}

      {error && (
        <div
          role="alert"
          className="card flex items-start gap-3 border-danger/40 bg-danger/[0.04]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" strokeWidth={2.25} />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {/* Queue */}
      {loading ? (
        <div className="card flex items-center gap-2 text-fg-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading {TAB_META[tab].label.toLowerCase()}…
        </div>
      ) : items.length === 0 ? (
        <EmptyState status={tab} />
      ) : (
        <div className="stagger space-y-4">
          {items.map((item) => (
            <AdminItemCard
              key={item.id}
              item={item}
              tab={tab}
              busy={busyId === item.id}
              rejectReason={rejectReason[item.id] || ""}
              regenPrompt={regenPrompt[item.id] || ""}
              selectedModel={selectedModel}
              onSelectedModelChange={setSelectedModel}
              onRejectReasonChange={(v) =>
                setRejectReason((r) => ({ ...r, [item.id]: v }))
              }
              onRegenPromptChange={(v) =>
                setRegenPrompt((r) => ({ ...r, [item.id]: v }))
              }
              onApprove={async () => {
                await action(item.id, () => api.approve(item.id, session.access_token));
              }}
              onReject={async () => {
                const reason = rejectReason[item.id] || "No reason provided";
                await action(item.id, () =>
                  api.reject(item.id, reason, session.access_token),
                );
              }}
              onReopen={async () => {
                await action(item.id, () => api.reopen(item.id, session.access_token));
              }}
              onArchive={async () => {
                await action(item.id, () => api.archive(item.id, null, session.access_token));
              }}
              onRestore={async () => {
                await action(item.id, () => api.unarchive(item.id, session.access_token));
              }}
              onRegenerate={async () => {
                setBusyId(item.id);
                setError(null);
                try {
                  const fresh = await api.regenerate(
                    item.id,
                    regenPrompt[item.id] || null,
                    session.access_token,
                    selectedModel,
                  );
                  setItems((prev) =>
                    prev.map((i) => (i.id === item.id ? fresh : i)),
                  );
                  setRegenPrompt((r) => ({ ...r, [item.id]: "" }));
                } catch (e: any) {
                  setError(`Regenerate failed: ${e?.message || e}`);
                } finally {
                  setBusyId(null);
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ status }: { status: TabStatus }) {
  const meta = TAB_META[status];
  const Icon = meta.icon;
  const colorClass =
    status === "approved"
      ? "border-success/30 bg-success/10"
      : status === "rejected"
      ? "border-danger/30 bg-danger/10"
      : status === "archived"
      ? "border-fg-subtle/30 bg-surface-inset"
      : "border-border bg-surface-raised";
  return (
    <div className="card flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div
        className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl border ${colorClass}`}
      >
        <Icon className="h-5 w-5 text-fg-muted" strokeWidth={2.25} />
      </div>
      <p className="mt-2 text-base font-medium text-fg">{meta.emptyTitle}</p>
      <p className="max-w-md text-sm text-fg-muted">{meta.emptyHint}</p>
    </div>
  );
}

function AdminItemCard(props: {
  item: IncidentDetail;
  tab: TabStatus;
  busy: boolean;
  rejectReason: string;
  regenPrompt: string;
  selectedModel: string;
  onSelectedModelChange: (v: string) => void;
  onRejectReasonChange: (v: string) => void;
  onRegenPromptChange: (v: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onReopen: () => void;
  onRegenerate: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const {
    item,
    tab,
    busy,
    rejectReason,
    regenPrompt,
    selectedModel,
    onSelectedModelChange,
    onRejectReasonChange,
    onRegenPromptChange,
    onApprove,
    onReject,
    onReopen,
    onRegenerate,
    onArchive,
    onRestore,
  } = props;

  const badgeClass =
    tab === "pending"
      ? "badge-warning"
      : tab === "approved"
      ? "badge-success"
      : tab === "archived"
      ? "badge-neutral"
      : "badge-danger";
  const badgeLabel = tab.charAt(0).toUpperCase() + tab.slice(1);

  return (
    <article className="card space-y-5">
      {/* Meta */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border-subtle pb-4">
        <span className={`badge ${badgeClass}`}>{badgeLabel}</span>
        <span className="inline-flex items-center gap-1.5 text-xs text-fg-subtle">
          <CalendarClock className="h-3.5 w-3.5" strokeWidth={2} />
          {new Date(item.created_at).toLocaleString()}
        </span>
        {item.approved_at && (
          <span className="inline-flex items-center gap-1.5 text-xs text-fg-subtle">
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            Approved {new Date(item.approved_at).toLocaleString()}
          </span>
        )}
        {tab === "archived" && (item as any).archived_at && (
          <span className="inline-flex items-center gap-1.5 text-xs text-fg-subtle">
            <Archive className="h-3.5 w-3.5" strokeWidth={2} />
            Archived {new Date((item as any).archived_at).toLocaleString()}
          </span>
        )}
        <span className="font-mono text-xs text-fg-subtle">/{item.id.slice(0, 8)}</span>
      </div>

      {/* Raw input */}
      <div className="space-y-2">
        <p className="eyebrow">Raw input</p>
        <pre className="code-block max-h-60 overflow-auto whitespace-pre-wrap text-fg-muted">
{item.raw_text}
        </pre>
      </div>

      {/* AI output preview */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <p className="eyebrow">AI title</p>
          <p className="text-sm font-medium text-fg">{item.title}</p>
        </div>
        <div className="space-y-1.5">
          <p className="eyebrow">AI quick summary</p>
          <p className="text-sm text-fg-muted">{item.summary}</p>
        </div>
      </div>

      {item.moderation_notes && tab === "rejected" && (
        <div className="rounded-lg border border-danger/30 bg-danger/[0.04] p-3">
          <p className="eyebrow text-danger">Rejection reason</p>
          <p className="mt-1 text-sm text-fg-muted">{item.moderation_notes}</p>
        </div>
      )}

      <ModerationFlags flags={item.moderation_flags as MF} />

      <details className="group rounded-lg border border-border-subtle bg-surface-inset px-3 py-2 text-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between text-fg-muted transition-colors hover:text-fg">
          <span className="font-medium">Show full STAR + technical points</span>
          <span className="text-fg-subtle transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="mt-4 space-y-5">
          <StarSection star={item.star} />
          <div className="space-y-2">
            <p className="eyebrow">Technical points</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-fg-muted">
              {item.technical_points.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
          <ThinkingBlock notes={item.thinking_notes} variant="admin" />
        </div>
      </details>

      {/* Actions */}
      <div className="space-y-3 border-t border-border-subtle pt-4">
        {/* On pending: show reject reason input. On rejected: show the reason is fixed. */}
        {tab === "pending" && (
          <div className="space-y-3">
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle"
                strokeWidth={2}
              />
              <input
                className="input pl-9"
                placeholder="Optional reason for rejection — sent to the submitter"
                value={rejectReason}
                onChange={(e) => onRejectReasonChange(e.target.value)}
                disabled={busy}
              />
            </div>
            <input
              className="input"
              placeholder="Optional prompt tweak for regenerate (e.g. 'focus on impact metrics')…"
              value={regenPrompt}
              onChange={(e) => onRegenPromptChange(e.target.value)}
              disabled={busy}
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {tab === "pending" && (
            <>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={onApprove}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={2.5} />}
                Approve
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={busy || rejectReason.trim().length < 3}
                onClick={onReject}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" strokeWidth={2.5} />}
                Reject
              </button>
            </>
          )}

          {tab === "rejected" && (
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={onReopen}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" strokeWidth={2} />}
              Reopen → back to pending
            </button>
          )}

          {tab === "archived" && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={onRestore}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArchiveRestore className="h-4 w-4" strokeWidth={2} />}
              Restore → back to pending
            </button>
          )}

          {tab !== "archived" && (
            <>
              <ModelPicker
                value={selectedModel}
                onChange={onSelectedModelChange}
                id="admin-model-picker"
              />
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={onRegenerate}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" strokeWidth={2} />}
                Regenerate
              </button>

              {item.status === "approved" && item.slug && (
                <Link href={`/stories/${item.slug}`} className="btn">
                  View live
                </Link>
              )}

              <button
                type="button"
                className="btn btn-ghost ml-auto"
                disabled={busy}
                onClick={onArchive}
                title="Move this incident to the Archived tab (you can restore it later)"
              >
                <Archive className="h-4 w-4" strokeWidth={2} />
                Archive
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}