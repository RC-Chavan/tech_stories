import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-20 text-center animate-fade-up">
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-surface-raised">
        <SearchX className="h-5 w-5 text-fg-muted" strokeWidth={2} />
      </div>
      <p className="eyebrow mt-6">404</p>
      <h1 className="mt-1 text-display-2">Page not found</h1>
      <p className="mt-3 text-sm text-fg-muted">
        We couldn&apos;t find what you were looking for. It may have been moved or
        never existed.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/" className="btn btn-primary">
          Back to stories
        </Link>
        <Link href="/submit" className="btn">
          Submit an incident
        </Link>
      </div>
    </div>
  );
}
