import Link from "next/link";
import { adminPath } from "@/lib/routes";
import { CmsLoading } from "@/components/cms/CmsStates";

// CMS-C08B-03 — route-level loading state for every /admin surface.
// Keeps the CMS shell (page frame + CMS eyebrow + back link) visible while
// server data loads, so a slow query never renders a blank page. The spinner
// stays bounded to the changing content region.
export default function AdminLoading() {
  return (
    <main className="min-h-screen bg-deep px-4 py-10 text-bone">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/60">
            0nya CMS
          </p>
          <Link href={adminPath} className="mt-1 inline-block text-sm text-teal">
            ← Back to admin
          </Link>
        </div>
        <CmsLoading label="Loading…" className="max-w-3xl" />
      </div>
    </main>
  );
}
