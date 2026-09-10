"use client";

import { useEffect } from "react";
import Link from "next/link";
import { adminPath } from "@/lib/routes";
import { CmsErrorState } from "@/components/cms/CmsStates";

// CMS-C08B-03 — fatal page error boundary for all /admin surfaces.
// The CMS shell stays understandable, the operator gets a clear recovery
// action, and no raw stack trace is rendered. Server logs remain the
// authoritative record; only the error digest (safe correlation id) is shown
// in the advanced details area.
export default function AdminErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Client console mirrors the server log for debugging; the operator
    // never sees this output in the UI.
    console.error("CMS page error:", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-deep px-4 py-10 text-bone">
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/60">
            0nya CMS
          </p>
          <Link href={adminPath} className="mt-1 inline-block text-sm text-teal">
            ← Back to admin
          </Link>
        </div>
        <CmsErrorState
          title="Something went wrong"
          message="This page could not be loaded. You can retry — your other CMS pages are unaffected."
          onRetry={reset}
          retryLabel="Retry"
          detail={error.digest ? `Error digest: ${error.digest}` : undefined}
        />
      </div>
    </main>
  );
}
