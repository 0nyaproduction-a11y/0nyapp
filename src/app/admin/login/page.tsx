import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/account/actions";
import { Button } from "@/components/ui/Button";
import { getSafeUserIdentifier } from "@/lib/account";
import { cmsEmailPasswordLogin } from "@/app/admin/login/actions";
import { getCmsAdminContext } from "@/lib/cms/auth";
import { adminLoginPath, adminPath } from "@/lib/routes";

type AdminLoginPageProps = {
  searchParams?: Promise<{ error?: string; next?: string }>;
};

function getSafeAdminRedirect(next?: string) {
  if (!next?.startsWith("/admin") || next.startsWith("//") || next === adminLoginPath) {
    return adminPath;
  }

  return next;
}

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const params = await (searchParams ?? Promise.resolve<{ error?: string; next?: string }>({}));
  const redirectTo = getSafeAdminRedirect(params.next);
  const errorMessage = typeof params.error === "string" ? params.error : null;
  const context = await getCmsAdminContext();

  if (context.status === "authorized") {
    redirect(redirectTo);
  }

  return (
    <main className="min-h-screen bg-deep px-4 py-10 text-bone">
      <div className="mx-auto flex min-h-[calc(100svh-5rem)] max-w-md flex-col">
        <Link
          href="/"
          className="w-fit text-[2.25rem] text-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal"
        >
          0nya
        </Link>

        <section className="grid flex-1 place-items-center py-10">
          <div className="w-full border border-bone/10 bg-background px-5 py-8 shadow-[0_0_70px_rgba(13,209,188,0.07)] sm:px-8">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-teal">
              Temporary QA CMS
            </p>
            <h1 className="mt-3 text-2xl font-semibold">CMS sign in</h1>
            <p className="mt-2 text-sm leading-6 text-bone/70">
              Email/password access for the temporary QA admin account while CMS phone OTP is offline.
            </p>

            {context.status === "forbidden" ? (
              <div className="mt-5 border border-bone/10 bg-bone/[0.03] px-3 py-3 text-sm leading-6 text-bone/80">
                <p>
                  {getSafeUserIdentifier(context.user)} is signed in but is not authorized for
                  CMS access.
                </p>
                <form action={signOut} className="mt-4">
                  <Button type="submit" variant="ghost">
                    Sign out
                  </Button>
                </form>
              </div>
            ) : (
              <form action={cmsEmailPasswordLogin} className="mt-7 grid gap-4">
                <input name="next" type="hidden" value={redirectTo} />
                <label className="grid gap-2">
                  <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-bone/62">
                    Email
                  </span>
                  <input
                    autoComplete="email"
                    className="h-12 border border-bone/10 bg-surface px-3 text-base font-light text-bone outline-none transition placeholder:text-bone/28 focus:border-teal"
                    name="email"
                    placeholder="0@0nya.com"
                    required
                    type="email"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-bone/62">
                    Password
                  </span>
                  <input
                    autoComplete="current-password"
                    className="h-12 border border-bone/10 bg-surface px-3 text-base font-light text-bone outline-none transition placeholder:text-bone/28 focus:border-teal"
                    name="password"
                    required
                    type="password"
                  />
                </label>
                {errorMessage ? (
                  <p className="border border-bone/10 bg-bone/[0.03] px-3 py-2 text-sm leading-6 text-bone/80">
                    {errorMessage}
                  </p>
                ) : null}
                <Button type="submit">Sign in</Button>
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
