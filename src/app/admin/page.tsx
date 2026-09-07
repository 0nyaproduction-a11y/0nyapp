import Link from "next/link";
import { signOut } from "@/app/account/actions";
import { Button } from "@/components/ui/Button";
import { getSafeUserIdentifier } from "@/lib/account";
import { requireCmsAdmin } from "@/lib/cms/auth";
import { billingListPath, homeListPath, mediaListPath, seriesListPath, shortFilmListPath } from "@/lib/routes";

export default async function AdminPage() {
  const context = await requireCmsAdmin();

  if (context.status === "forbidden") {
    return (
      <main className="min-h-screen bg-deep px-4 py-10 text-bone">
        <div className="mx-auto max-w-md text-center">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/60">
            0nya CMS
          </p>
          <h1 className="mt-3 text-xl font-semibold">Access denied</h1>
          <p className="mt-2 text-sm text-bone/70">
            {getSafeUserIdentifier(context.user)} is signed in but is not authorized for
            CMS access.
          </p>
          <form action={signOut} className="mt-6 flex justify-center">
            <Button type="submit" variant="ghost">
              Sign out
            </Button>
          </form>
        </div>
      </main>
    );
  }

  const { user } = context;

  return (
    <main className="min-h-screen bg-deep px-4 py-10 text-bone">
      <div className="mx-auto max-w-2xl">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/60">
          0nya CMS
        </p>
        <h1 className="mt-3 text-2xl font-semibold">Admin</h1>
        <p className="mt-2 text-sm text-bone/70">
          Signed in as {getSafeUserIdentifier(user)}
        </p>

        <nav className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href={seriesListPath}
            className="border border-bone/10 bg-bone/[0.03] px-4 py-5 transition hover:border-teal/50 hover:bg-bone/[0.06]"
          >
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/50">
              Content
            </p>
            <p className="mt-2 text-sm text-bone/70">Series &amp; episodes</p>
          </Link>
          <Link
            href={mediaListPath}
            className="border border-bone/10 bg-bone/[0.03] px-4 py-5 transition hover:border-teal/50 hover:bg-bone/[0.06]"
          >
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/50">
              Media
            </p>
            <p className="mt-2 text-sm text-bone/70">Mux uploads &amp; status</p>
          </Link>
          <Link
            href={shortFilmListPath}
            className="border border-bone/10 bg-bone/[0.03] px-4 py-5 transition hover:border-teal/50 hover:bg-bone/[0.06]"
          >
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/50">
              Short Films
            </p>
            <p className="mt-2 text-sm text-bone/70">Short-film CMS</p>
          </Link>
          <Link
            href={billingListPath}
            className="border border-bone/10 bg-bone/[0.03] px-4 py-5 transition hover:border-teal/50 hover:bg-bone/[0.06]"
          >
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/50">
              Billing
            </p>
            <p className="mt-2 text-sm text-bone/70">Coin packs &amp; billing catalog</p>
          </Link>
          <Link
            href={homeListPath}
            className="border border-bone/10 bg-bone/[0.03] px-4 py-5 transition hover:border-teal/50 hover:bg-bone/[0.06]"
          >
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/50">
              Home
            </p>
            <p className="mt-2 text-sm text-bone/70">Home curation</p>
          </Link>
        </nav>

        <form action={signOut} className="mt-8">
          <Button type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      </div>
    </main>
  );
}
