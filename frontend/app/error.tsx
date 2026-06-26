"use client";

import { useEffect } from "react";
import { AlertOctagon, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-20 text-center animate-fade-up">
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-danger/30 bg-danger/10">
        <AlertOctagon className="h-5 w-5 text-danger" strokeWidth={2.25} />
      </div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="mt-2 text-sm text-fg-muted">
        {error.message || "An unexpected error occurred while rendering this page."}
      </p>
      <button onClick={reset} className="btn btn-primary mt-6">
        <RotateCcw className="h-4 w-4" strokeWidth={2} />
        Try again
      </button>
    </div>
  );
}
