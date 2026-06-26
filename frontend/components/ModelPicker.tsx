"use client";

import { ChevronDown } from "lucide-react";
import { DEFAULT_MODEL_ID, FREE_MODELS, type ModelGroup } from "@/lib/freeModels";

/**
 * Compact grouped <select> for choosing an OpenRouter free model per regenerate.
 *
 * Options are de-duplicated by id so a model that appears under both "Recommended"
 * and its provider group (e.g. Qwen 3 Next 80B) only shows up once in the
 * Recommended group; the provider-group copy is suppressed for that id.
 */
export function ModelPicker({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (next: string) => void;
  id?: string;
}) {
  // Pre-compute: which ids appear in the "Recommended" group? Suppress those
  // duplicates in their provider group so the user sees them only once.
  const recommendedIds = new Set(
    FREE_MODELS.filter((m) => m.group === "Recommended").map((m) => m.id)
  );

  // Preserve FREE_MODELS order so our editorial ordering wins.
  const visible = FREE_MODELS.filter(
    (m) => m.group === "Recommended" || !recommendedIds.has(m.id)
  );

  // Group by provider, keeping insertion order.
  const groups: ModelGroup[] = [];
  const seen = new Set<ModelGroup>();
  for (const m of visible) {
    if (!seen.has(m.group)) {
      seen.add(m.group);
      groups.push(m.group);
    }
  }

  return (
    <label className="inline-flex items-center gap-1.5" htmlFor={id}>
      <span className="sr-only">Model</span>
      <span
        aria-hidden="true"
        className="hidden text-xs font-medium text-fg-subtle sm:inline"
      >
        Model
      </span>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input cursor-pointer pr-7 text-xs font-medium"
          style={{ minWidth: "11rem" }}
        >
          {!visible.some((m) => m.id === DEFAULT_MODEL_ID) && (
            <option value={DEFAULT_MODEL_ID}>{DEFAULT_MODEL_ID}</option>
          )}
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {visible
                .filter((m) => m.group === g)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} — {m.hint}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle"
          strokeWidth={2}
          aria-hidden="true"
        />
      </div>
    </label>
  );
}