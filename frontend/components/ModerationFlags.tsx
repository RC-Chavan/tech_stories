import {
  AlertTriangle,
  KeyRound,
  Mail,
  Phone,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import type { ModerationFlags as ModerationFlagsType } from "@/lib/types";

type Flag =
  | { kind: "toxicity"; icon: LucideIcon; label: string; cls: string }
  | { kind: "off_topic"; icon: LucideIcon; label: string; cls: string }
  | { kind: "low_quality"; icon: LucideIcon; label: string; cls: string }
  | { kind: "pii"; icon: LucideIcon; label: string; cls: string; value: string };

const PII_ICONS: Record<string, LucideIcon> = {
  email: Mail,
  phone: Phone,
  api_key: KeyRound,
  // fallback for anything else
};

export function ModerationFlags({ flags }: { flags: ModerationFlagsType }) {
  const items: Flag[] = [];

  if (flags.toxicity) {
    items.push({
      kind: "toxicity",
      icon: ShieldAlert,
      label: "Toxic content",
      cls: "badge-danger",
    });
  }
  if (flags.off_topic) {
    items.push({
      kind: "off_topic",
      icon: AlertTriangle,
      label: "Off-topic",
      cls: "badge-warning",
    });
  }
  if (flags.low_quality) {
    items.push({
      kind: "low_quality",
      icon: AlertTriangle,
      label: "Low quality",
      cls: "badge-warning",
    });
  }
  for (const p of flags.pii_detected) {
    const Icon = PII_ICONS[p] ?? KeyRound;
    items.push({
      kind: "pii",
      icon: Icon,
      label: `PII · ${p.replace(/_/g, " ")}`,
      cls: "badge-info",
      value: p,
    });
  }

  if (items.length === 0 && !flags.notes) return null;

  return (
    <section
      className="card border-warning/30 bg-warning/[0.03]"
      role="status"
      aria-label="AI moderation notes"
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-warning/30 bg-warning/10">
          <AlertTriangle className="h-3.5 w-3.5 text-warning" strokeWidth={2.25} />
        </span>
        <div>
          <p className="text-sm font-semibold text-warning">AI moderation notes</p>
          <p className="text-xs text-fg-subtle">
            Auto-detected signals from the language model.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((it, i) => {
          const Icon = it.icon;
          return (
            <span key={`${it.kind}-${i}`} className={`badge ${it.cls}`}>
              <Icon className="h-3 w-3" strokeWidth={2.5} />
              {it.label}
            </span>
          );
        })}
      </div>

      {flags.notes && (
        <p className="mt-3 text-sm leading-relaxed text-fg-muted">{flags.notes}</p>
      )}
    </section>
  );
}
