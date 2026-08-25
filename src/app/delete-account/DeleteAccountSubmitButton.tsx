"use client";

import { useFormStatus } from "react-dom";

export function DeleteAccountSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex min-h-11 items-center justify-center gap-2 border border-red-500/50 bg-red-500/15 px-4 py-3 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-red-100 transition hover:border-red-400 hover:bg-red-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={pending}
      type="submit"
    >
      {pending ? "Deleting..." : "Delete Account"}
    </button>
  );
}
