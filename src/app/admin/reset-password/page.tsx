"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { adminLoginPath } from "@/lib/routes";

type View =
  | "loading"
  | "ready"
  | "submitting"
  | "success"
  | "expired"
  | "error";

const MIN_PASSWORD_LENGTH = 8;

export default function AdminResetPasswordPage() {
  const router = useRouter();
  const [view, setView] = useState<View>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const location = `${window.location.hash}${window.location.search}`;
    const supabase = createClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
        setView("ready");
        window.history.replaceState(null, "", window.location.pathname);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setView("ready");
        window.history.replaceState(null, "", window.location.pathname);
        return;
      }

      if (location.includes("error_code=") || location.includes("error=")) {
        setView("expired");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setView("submitting");
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setView("error");
      return;
    }

    setView("success");
    setMessage("Your password has been updated.");

    setTimeout(() => {
      router.push(adminLoginPath);
      router.refresh();
    }, 1200);
  }

  function renderBody() {
    if (view === "loading") {
      return <p className="mt-7 text-sm leading-6 text-bone/70">Verifying reset link…</p>;
    }

    if (view === "expired") {
      return (
        <div className="mt-7 grid gap-4">
          <p className="border border-bone/10 bg-bone/[0.03] px-3 py-3 text-sm leading-6 text-bone/80">
            This password reset link is no longer valid. Request a new one.
          </p>
          <Link href={adminLoginPath} className="w-fit">
            <Button>Request new link</Button>
          </Link>
        </div>
      );
    }

    if (view === "success") {
      return (
        <p className="mt-7 border border-teal/30 bg-teal/10 px-3 py-3 text-sm leading-6 text-teal">
          {message}
        </p>
      );
    }

    const isSubmitting = view === "submitting";

    return (
      <form onSubmit={handleSubmit} className="mt-7 grid gap-4">
        <label className="grid gap-2">
          <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-bone/62">
            New password
          </span>
          <input
            autoComplete="new-password"
            className="h-12 border border-bone/10 bg-surface px-3 text-base font-light text-bone outline-none transition placeholder:text-bone/28 focus:border-teal"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        <label className="grid gap-2">
          <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-bone/62">
            Confirm new password
          </span>
          <input
            autoComplete="new-password"
            className="h-12 border border-bone/10 bg-surface px-3 text-base font-light text-bone outline-none transition placeholder:text-bone/28 focus:border-teal"
            name="confirm"
            onChange={(event) => setConfirm(event.target.value)}
            required
            type="password"
            value={confirm}
          />
        </label>
        {error ? (
          <p className="border border-bone/10 bg-bone/[0.03] px-3 py-2 text-sm leading-6 text-bone/80">
            {error}
          </p>
        ) : null}
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? "Updating" : "Update password"}
        </Button>
      </form>
    );
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
            <h1 className="mt-3 text-2xl font-semibold">Set new password</h1>
            <p className="mt-2 text-sm leading-6 text-bone/70">
              Choose a new password for your CMS account.
            </p>
            {renderBody()}
          </div>
        </section>
      </div>
    </main>
  );
}
