"use client";

import { FormWrapper } from "@/lib/cms/form-wrapper";
import { Button } from "@/components/ui/Button";
import { useState } from "react";

type UpdateHomeRowActionResult =
  | { success: false; error: string }
  | { success: true };

type HomeRowFormProps = {
  rowId: string;
  title: string;
  enabled: boolean;
  sortOrder: number;
  action: (formData: FormData) => Promise<UpdateHomeRowActionResult | void>;
  onDirtyChange?: (isDirty: boolean) => void;
};

export function HomeRowForm({ rowId, title, enabled, sortOrder, action, onDirtyChange }: HomeRowFormProps) {
  const initialValues = {
    rowId,
    title,
    enabled,
    sortOrder,
  };

  const [serverError, setServerError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setServerError(null);
    const formData = new FormData(e.currentTarget);
    try {
      const result = await action(formData);
      if (result && typeof result === "object" && "success" in result && !result.success) {
        setServerError(result.error);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if ((err as Error & { digest?: string }).digest !== "NEXT_REDIRECT") {
        setServerError(err.message || "Unexpected error.");
      }
    }
  };

  return (
    <FormWrapper formId={`home-row-${rowId}`} initialValues={initialValues} onSubmit={handleSubmit} onDirtyChange={onDirtyChange}>
      <input type="hidden" name="rowId" value={rowId} />
      <label className="block space-y-1.5">
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50">
          Title
        </span>
        <input
          className="w-56 border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone"
          name="title"
          defaultValue={title}
          required
        />
      </label>
      <label className="flex items-center gap-2 pb-2 text-sm text-bone/80">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={enabled}
          className="h-4 w-4 border border-bone/20 bg-bone/[0.03]"
        />
        Enabled
      </label>
      <label className="block space-y-1.5">
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50">
          Sort order
        </span>
        <input
          className="w-32 border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone"
          type="number"
          name="sortOrder"
          defaultValue={sortOrder}
        />
      </label>
      {serverError && (
        <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {serverError}
        </div>
      )}
      <Button type="submit" variant="secondary">
        Save row
      </Button>
    </FormWrapper>
  );
}






