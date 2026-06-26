"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase";
import { GitHubMark, GoogleMark } from "@/components/OAuthIcon";

export default function AdminLoginPage() {
  const router = useRouter();
  const [signingIn, setSigningIn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase.auth.getSession();
      if (data.session) router.replace("/admin");
    })();
  }, [router]);

  const signIn = async (provider: "google" | "github") => {
    setError(null);
    setSigningIn(provider);
    try {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/admin` },
      });
      if (error) throw error;
    } catch (e: any) {
      setError(e?.message || "Sign-in failed");
      setSigningIn(null);
    }
  };

  return (
    <div className="mx-auto max-w-md animate-fade-up">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        Back to home
      </Link>

      <div className="mt-8 space-y-2 text-center">
        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-500/30 bg-brand-500/10">
          <ShieldCheck className="h-5 w-5 text-brand-300" strokeWidth={2.25} />
        </div>
        <h1 className="text-display-2 mt-4">Admin sign-in</h1>
        <p className="text-sm text-fg-muted">
          Restricted to reviewers. After signing in, your account must be
          promoted in <code className="rounded bg-surface-raised px-1.5 py-0.5 text-xs">profiles.is_admin</code>.
        </p>
      </div>

      <div className="mt-8 space-y-3">
        <button
          type="button"
          className="btn w-full"
          onClick={() => signIn("google")}
          disabled={!!signingIn}
        >
          {signingIn === "google" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GoogleMark className="h-4 w-4" />
          )}
          Continue with Google
        </button>
        <button
          type="button"
          className="btn w-full"
          onClick={() => signIn("github")}
          disabled={!!signingIn}
        >
          {signingIn === "github" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GitHubMark className="h-4 w-4" />
          )}
          Continue with GitHub
        </button>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/[0.04] p-3 text-sm text-danger"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="mt-8 rounded-xl border border-dashed border-border bg-surface p-4 text-xs text-fg-muted">
        <p className="font-medium text-fg">Need to be promoted?</p>
        <p className="mt-1.5">
          Run{" "}
          <code className="block break-all rounded bg-surface-inset p-2 font-mono text-[11px] text-fg-muted">
            update public.profiles
            <br />
            &nbsp;&nbsp;set is_admin = true
            <br />
            where id = &apos;&lt;your-uuid&gt;&apos;;
          </code>{" "}
          in the Supabase SQL editor.
        </p>
      </div>
    </div>
  );
}
