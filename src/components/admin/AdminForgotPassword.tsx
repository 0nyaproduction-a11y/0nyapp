"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { adminResetPasswordPath } from "@/lib/routes";

type Status = "idle" | "submitting" | "sent" | "error";

export function AdminForgotPassword() {
  const [status, setStatus] = useState<Status>("idle");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setStatus("submitting");

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setStatus("error");
      setError("Enter a valid email address.");
      return;
    }

    const redirectTo = `${window.location.origin}${adminResetPasswordPath}`;
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (resetError) {
      setStatus("error");
      setError("Unable to send the reset link. Please try again.");
      return;
    }

    setStatus("sent");
    setMessage("If that email is registered, a reset link is on its way.");
  }

  if (status === "sent") {
    return (
      <div className="mt-7 border border-bone/10 bg-bone/[0.03] px-3 py-4 text-sm leading-6 text-bone/80">
        <p>{message}</p>
        <Link
          href="/admin/login"
          className="mt-3 inline-block border-b border-teal/50 text-sm text-teal transition hover:border-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-7 grid gap-4">
      <label className="grid gap-2">
        <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-bone/62">
          Email
        </span>
        <input
          autoComplete="email"
          className="h-12 border border-bone/10 bg-surface px-3 text-base font-light text-bone outline-none transition placeholder:text-bone/28 focus:border-teal"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="0@0nya.com"
          required
          type="email"
          value={email}
        />
      </label>
      {error ? (
        <p className="border border-bone/10 bg-bone/[0.03] px-3 py-2 text-sm leading-6 text-bone/80">
          {error}
        </p>
      ) : null}
      <Button disabled={status === "submitting"} type="submit">
        {status === "submitting" ? "Sending" : "Send reset link"}
      </Button>
      <Link
        href="/admin/login"
        className="inline-block w-fit border-b border-teal/50 text-sm text-teal transition hover:border-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal"
      >
        Back to sign in
      </Link>
    </form>
  );
}
