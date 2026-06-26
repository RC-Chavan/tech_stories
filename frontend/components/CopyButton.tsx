"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyButton({
  text,
  label = "Copy to clipboard",
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // noop
    }
  };

  return (
    <button
      onClick={onClick}
      type="button"
      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-surface-raised px-2 text-xs font-medium text-fg-muted transition-colors hover:bg-surface hover:text-fg"
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied!" : label}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-success" strokeWidth={2.5} />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" strokeWidth={2} />
          Copy
        </>
      )}
    </button>
  );
}
