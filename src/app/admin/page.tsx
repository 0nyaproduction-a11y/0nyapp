import { signOut } from "@/app/account/actions";
import { Button } from "@/components/ui/Button";
import { getSafeUserIdentifier } from "@/lib/account";
import { requireCmsAdmin } from "@/lib/cms/auth";

const PLACEHOLDER_SECTIONS = ["Content", "Media", "Home"] as const;

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

        <nav className="mt-8 grid gap-3 sm:grid-cols-3">
          {PLACEHOLDER_SECTIONS.map((label) => (
            <div key={label} className="border border-bone/10 bg-bone/[0.03] px-4 py-5">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/50">
                {label}
              </p>
              <p className="mt-2 text-sm text-bone/60">Coming soon</p>
            </div>
          ))}
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
