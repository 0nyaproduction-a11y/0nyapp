"use client";

import { useActionState, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { CmsSelect } from "@/components/cms/CmsSelect";
import { SERIES_STATUSES, type SeriesStatus } from "@/lib/cms/constants";

export type SeriesStatusFormState = {
  error?: string;
};

type SeriesStatusFormProps = {
  action: (state: SeriesStatusFormState, formData: FormData) => Promise<SeriesStatusFormState>;
  defaultValue: SeriesStatus;
};

export function SeriesStatusForm({ action, defaultValue }: SeriesStatusFormProps) {
  const initialState: SeriesStatusFormState = {};
  const [state, formAction, pending] = useActionState(action, initialState);
  const [status, setStatus] = useState<SeriesStatus>(defaultValue);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (status !== "published") {
      return;
    }

    if (!window.confirm("Publish this series and all child episodes?")) {
      event.preventDefault();
    }
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-start gap-3">
      <CmsSelect
        name="status"
        value={status}
        onChange={(value) => setStatus(value as SeriesStatus)}
        className="w-40 border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone"
        options={SERIES_STATUSES.map((value) => ({ label: value, value }))}
      />
      <div className="flex min-w-[14rem] flex-1 flex-col gap-2">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Updating…" : "Update status"}
        </Button>
        {status === "published" && (
          <p className="text-xs text-bone/50">Publishing will also publish every child episode.</p>
        )}
        {state.error && <p className="text-xs text-red-400">{state.error}</p>}
      </div>
    </form>
  );
}
