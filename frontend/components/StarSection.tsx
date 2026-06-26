import {
  Compass,
  Target,
  Wrench,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import type { StarStory } from "@/lib/types";

type Key = keyof StarStory;

const SECTIONS: {
  key: Key;
  label: string;
  description: string;
  icon: LucideIcon;
  accent: string; // tailwind class for icon + accent border
}[] = [
  {
    key: "situation",
    label: "Situation",
    description: "Set the scene",
    icon: Compass,
    accent:
      "bg-info/10 text-info border-info/30",
  },
  {
    key: "task",
    label: "Task",
    description: "What you needed to achieve",
    icon: Target,
    accent:
      "bg-warning/10 text-warning border-warning/30",
  },
  {
    key: "action",
    label: "Action",
    description: "What you actually did",
    icon: Wrench,
    accent:
      "bg-brand-500/10 text-brand-300 border-brand-500/30",
  },
  {
    key: "result",
    label: "Result",
    description: "The measurable outcome",
    icon: Trophy,
    accent:
      "bg-success/10 text-success border-success/30",
  },
];

export function StarSection({ star }: { star: StarStory }) {
  return (
    <section className="space-y-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">STAR Format</p>
          <h2 className="text-display-2 mt-1">STAR writeup</h2>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {SECTIONS.map(({ key, label, description, icon: Icon, accent }) => (
          <article
            key={key}
            className="card group hover:border-border-strong"
          >
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${accent} transition-transform group-hover:scale-105`}
                aria-hidden="true"
              >
                <Icon className="h-4 w-4" strokeWidth={2.25} />
              </span>
              <div>
                <p className="text-sm font-semibold text-fg">{label}</p>
                <p className="text-xs text-fg-subtle">{description}</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-fg-muted whitespace-pre-wrap">
              {star[key]}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
