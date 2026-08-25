"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";

export type DeleteFormState = {
  blockers?: string[];
  error?: string;
  message?: string;
};

type DangerZoneDeleteFormProps = {
  action: (state: DeleteFormState, formData: FormData) => Promise<DeleteFormState>;
  blockers: string[];
  confirmationValue: string;
  description: string;
  submitLabel: string;
  title: string;
};

export function DangerZoneDeleteForm({
  action,
  blockers,
  confirmationValue,
  description,
  submitLabel,
  title,
}: DangerZoneDeleteFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const visibleBlockers = state.blockers ?? blockers;

  return (
    <section className="border border-rose-500/25 bg-rose-500/[0.04] p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-rose-100">{title}</h3>
        <p className="text-sm text-bone/70">{description}</p>
      </div>

      {visibleBlockers.length > 0 && (
        <div className="mt-4 border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-100">
          <p className="font-semibold">Delete is blocked until these are resolved:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-rose-100/90">
            {visibleBlockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </div>
      )}

      <form action={formAction} className="mt-4 space-y-4">
        <label className="block space-y-1.5">
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50">
            Type the confirmation text
          </span>
          <input
            className="w-full border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone placeholder:text-bone/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
            name="confirmation"
            placeholder={confirmationValue}
            required
          />
        </label>

        {state.error && <p className="text-sm text-rose-200">{state.error}</p>}
        {state.message && <p className="text-sm text-rose-200">{state.message}</p>}

        <Button
          type="submit"
          variant="ghost"
          className="border-rose-500/40 bg-rose-500/10 text-rose-100 hover:border-rose-400 hover:bg-rose-500/20"
          disabled={pending}
        >
          {pending ? "Deleting…" : submitLabel}
        </Button>
      </form>
    </section>
  );
}
