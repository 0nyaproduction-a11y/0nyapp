import Link from "next/link";
import { BrandName } from "@/components/brand/BrandName";

export default function DeleteAccountSuccessPage() {
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
              Account deleted
            </p>
            <h1 className="mt-3 font-display text-5xl font-light leading-none text-bone">
              Your 0nya account has been deleted.
            </h1>
            <p className="mt-5 text-sm leading-6 text-muted">
              You are signed out now. You can return to 0nya anytime and create a new account.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/"
                className="inline-flex items-center border border-bone/10 px-4 py-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-bone/70 transition hover:border-teal/50 hover:text-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal"
              >
                Go home
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center border border-bone/10 px-4 py-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-bone/70 transition hover:border-teal/50 hover:text-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal"
              >
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
