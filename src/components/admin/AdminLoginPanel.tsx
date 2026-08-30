"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cmsEmailPasswordLogin } from "@/app/admin/login/actions";
import { AdminForgotPassword } from "@/components/admin/AdminForgotPassword";

type AdminLoginPanelProps = {
  redirectTo: string;
  errorMessage: string | null;
};

export function AdminLoginPanel({ redirectTo, errorMessage }: AdminLoginPanelProps) {
  const [forgot, setForgot] = useState(false);

  if (forgot) {
    return <AdminForgotPassword />;
  }

  return (
    <>
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
      <button
        type="button"
        onClick={() => setForgot(true)}
        className="mt-4 w-fit border-b border-teal/50 text-sm text-teal transition hover:border-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal"
      >
        Forgot password?
      </button>
    </>
  );
}
