import Link from "next/link";
import { deleteWebAccount } from "./actions";
import { BrandName } from "@/components/brand/BrandName";
import { deleteAccountPath, loginPath } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { DeleteAccountSubmitButton } from "./DeleteAccountSubmitButton";
import { privacyEmail } from "@/lib/legal-content";

type DeleteAccountPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function DeleteAccountPage({ searchParams }: DeleteAccountPageProps) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen bg-deep px-4 py-6 text-bone sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100svh-3rem)] max-w-xl flex-col">
        <Link
          href="/"
          className="w-fit text-[2.25rem] text-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal"
        >
          <BrandName />
        </Link>

        <section className="grid flex-1 place-items-center py-10">
          <div className="w-full border border-bone/10 bg-background px-5 py-8 shadow-[0_0_70px_rgba(13,209,188,0.07)] sm:px-8">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-teal">
              Delete account
            </p>
            <h1 className="mt-3 font-display text-5xl font-light leading-none text-bone">
              Delete your 0nya account?
            </h1>
            <p className="mt-5 text-sm leading-6 text-muted">
              This removes account access and associated 0nya data. Some de-identified or
              pseudonymous records required for legal, accounting, or security obligations may be
              retained where applicable. Transaction or payment records necessary for financial
              compliance are also retained where required.
            </p>
            <p className="mt-3 text-sm leading-6 text-muted">
              0nya provides authenticated account deletion in-app and on the web. If you cannot
              sign in to authenticate, you may request deletion by emailing{" "}
              <a
                href={`mailto:${privacyEmail}`}
                className="text-teal underline underline-offset-2 hover:text-bone"
              >
                {privacyEmail}
              </a>
              . We will verify your identity before processing.
            </p>

            {error ? (
              <p className="mt-5 border border-bone/10 bg-bone/[0.03] px-3 py-2 text-sm leading-6 text-bone/80">
                We could not delete the account. Please try again.
              </p>
            ) : null}

            {user ? (
              <form action={deleteWebAccount} className="mt-6 grid gap-3">
                <DeleteAccountSubmitButton />
                <Link
                  href="/account"
                  className="inline-flex w-fit items-center font-mono text-[0.66rem] uppercase tracking-[0.14em] text-bone/55 transition hover:text-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal"
                >
                  Cancel
                </Link>
              </form>
            ) : (
               <div className="mt-6 grid gap-3">
                <p className="text-sm leading-6 text-bone/80">
                  Sign in on web to request deletion without opening Android. If you cannot sign in,
                  email <a href={`mailto:${privacyEmail}`} className="text-teal underline underline-offset-2">{privacyEmail}</a>.
                </p>
                <Link
                  href={`${loginPath}?next=${deleteAccountPath}`}
                  className="inline-flex w-fit items-center font-mono text-[0.66rem] uppercase tracking-[0.14em] text-teal transition hover:text-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal"
                >
                  Sign in
                </Link>
                <Link
                  href="/"
                  className="inline-flex w-fit items-center font-mono text-[0.66rem] uppercase tracking-[0.14em] text-bone/55 transition hover:text-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal"
                >
                  Cancel
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
