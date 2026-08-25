"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import type { ShortFilmFormState } from "@/lib/cms/short-film-form";
import type { ChaiAllowedCoinAmountRow } from "@/lib/cms/chai";

const inputClassName =
  "w-full border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone placeholder:text-bone/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal";
const labelClassName = "font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50";
const checkboxClassName = "h-4 w-4 border border-bone/20 bg-bone/[0.03]";

type ShortFilmChaiConfigFormProps = {
  action: (state: ShortFilmFormState, formData: FormData) => Promise<ShortFilmFormState>;
  chaiEnabled: boolean;
  allowedCoinAmounts: ChaiAllowedCoinAmountRow[];
};

export function ShortFilmChaiConfigForm({
  action,
  chaiEnabled,
  allowedCoinAmounts,
}: ShortFilmChaiConfigFormProps) {
  const [state, formAction, pending] = useActionState(action, { errors: {} });
  const errors = state.errors;

  return (
    <form action={formAction} className="space-y-5">
      <label className="flex items-center gap-2 text-sm text-bone/80">
        <input type="checkbox" name="chaiEnabled" defaultChecked={chaiEnabled} className={checkboxClassName} />
        Chai enabled
      </label>

      <fieldset className="space-y-3 border border-bone/10 p-4">
        <legend className={labelClassName}>Allowed coin amounts</legend>
        <div className="space-y-3">
          {allowedCoinAmounts.map((amount, index) => (
            <div key={amount.id} className="grid gap-3 sm:grid-cols-3">
              <input type="hidden" name="allowedCoinAmountId" value={amount.id} />
              <Field label={`Amount ${index + 1}`} error={errors[`amount-${amount.id}`]}>
                <input
                  className={inputClassName}
                  type="number"
                  name={`coinAmount-${amount.id}`}
                  min={1}
                  defaultValue={amount.coin_amount}
                />
              </Field>
              <Field label="Enabled" error={errors[`enabled-${amount.id}`]}>
                <label className="flex h-10 items-center gap-2 text-sm text-bone/80">
                  <input
                    type="checkbox"
                    name={`enabled-${amount.id}`}
                    defaultChecked={amount.enabled}
                    className={checkboxClassName}
                  />
                  Enabled
                </label>
              </Field>
              <Field label="Sort order" error={errors[`sortOrder-${amount.id}`]}>
                <input
                  className={inputClassName}
                  type="number"
                  name={`sortOrder-${amount.id}`}
                  defaultValue={amount.sort_order}
                />
              </Field>
            </div>
          ))}
        </div>
      </fieldset>

      {errors.form && <p className="text-sm text-red-400">{errors.form}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save Chai config"}
      </Button>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className={labelClassName}>{label}</span>
      {children}
      {error && <span className="block text-xs text-red-400">{error}</span>}
    </label>
  );
}
