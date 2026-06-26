"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";

export function ShareButton() {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // noop — clipboard may be unavailable in non-secure contexts
    }
  };

  return (
    <button
      onClick={onClick}
      type="button"
      className="btn"
      aria-label={copied ? "Link copied" : "Copy story link"}
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 text-success" strokeWidth={2.5} />
          Link copied
        </>
      ) : (
        <>
          <Link2 className="h-4 w-4" strokeWidth={2} />
          Share
        </>
      )}
    </button>
  );
}
