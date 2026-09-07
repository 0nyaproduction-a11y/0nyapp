"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { CmsSelect } from "@/components/cms/CmsSelect";
import { CONTENT_DESCRIPTORS, CONTENT_RATINGS } from "@/lib/classification";
import type { EpisodeRow } from "@/lib/cms/constants";
import type { EpisodeFormState } from "@/lib/cms/episode-form";

const inputClassName =
  "w-full border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone placeholder:text-bone/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal [color-scheme:dark]";
const labelClassName = "font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50";
const checkboxClassName = "h-4 w-4 border border-bone/20 bg-bone/[0.03]";

type EpisodeMetadataFormProps = {
  action: (state: EpisodeFormState, formData: FormData) => Promise<EpisodeFormState>;
  episode?: EpisodeRow;
  onSaved?: (state: EpisodeFormState) => void;
  secondarySubmitLabel?: string;
  secondarySubmitValue?: string;
  submitLabel: string;
};

export function EpisodeMetadataForm({
  action,
  episode,
  onSaved,
  secondarySubmitLabel,
  secondarySubmitValue,
  submitLabel,
}: EpisodeMetadataFormProps) {
  const [state, formAction, pending] = useActionState(action, { errors: {} });
  const errors = state.errors;
  const lastSubmittedAtRef = useRef<number | undefined>(state.submittedAt);

  useEffect(() => {
    if (!state.submittedAt || !onSaved || Object.keys(errors).length > 0) {
      return;
    }

    if (lastSubmittedAtRef.current === state.submittedAt) {
      return;
    }

    lastSubmittedAtRef.current = state.submittedAt;
    onSaved(state);
  }, [errors, onSaved, state.submittedAt]);

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Episode number" error={errors.episodeNumber}>
          <input
            className={inputClassName}
            type="number"
            name="episodeNumber"
            min={1}
            defaultValue={episode?.episode_number ?? 1}
            required
          />
        </Field>
        <Field label="Title" error={errors.title}>
          <input className={inputClassName} name="title" defaultValue={episode?.title ?? ""} />
        </Field>
      </div>

      <Field label="Synopsis" error={errors.synopsis}>
        <textarea
          className={inputClassName}
          name="synopsis"
          rows={3}
          defaultValue={episode?.synopsis ?? ""}
        />
      </Field>

      <Field label="Duration (seconds)" error={errors.durationSeconds}>
        <input
          className={inputClassName}
          type="number"
          name="durationSeconds"
          min={0}
          defaultValue={episode?.duration_seconds ?? 0}
        />
      </Field>

      <fieldset className="space-y-3 border border-bone/10 p-4">
        <legend className={labelClassName}>Access configuration</legend>
        {errors.access && <p className="mt-1 text-xs text-red-400">{errors.access}</p>}

        <label className="flex items-center gap-2 text-sm text-bone/80">
          <input
            type="checkbox"
            name="isFree"
            defaultChecked={episode?.is_free ?? false}
            className={checkboxClassName}
          />
          Free to watch
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-bone/80">
            <input
              type="checkbox"
              name="coinUnlockEnabled"
              defaultChecked={episode?.coin_unlock_enabled ?? false}
              className={checkboxClassName}
            />
            Coin unlock enabled
          </label>
          <Field label="Coin price" error={errors.coinPrice}>
            <input
              className={inputClassName}
              type="number"
              name="coinPrice"
              min={0}
              defaultValue={episode?.coin_price ?? 0}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-bone/80">
            <input
              type="checkbox"
              name="rewardedUnlockEnabled"
              defaultChecked={episode?.rewarded_unlock_enabled ?? false}
              className={checkboxClassName}
            />
            Rewarded-ad unlock enabled
          </label>
          <Field label="Rewarded access mode" error={errors.rewardedAccessMode}>
            <CmsSelect
              className={inputClassName}
              name="rewardedAccessMode"
              defaultValue={episode?.rewarded_access_mode ?? "permanent"}
              disabled
              options={[{ label: "Permanent", value: "permanent" }]}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Rewarded ads required" error={errors.requiredRewardedCompletions}>
            <CmsSelect
              className={inputClassName}
              name="requiredRewardedCompletions"
              defaultValue={String(episode?.required_rewarded_completions ?? 1)}
              options={[
                { label: "1 (single ad)", value: "1" },
                { label: "2 (two ads)", value: "2" },
              ]}
            />
          </Field>
        </div>

        <p className="text-xs text-bone/40">
          Rewarded access is permanent-only at launch. Session mode is not supported and is disabled in this editor.
        </p>

        <label className="flex items-center gap-2 text-sm text-bone/80">
          <input
            type="checkbox"
            name="plusAccess"
            defaultChecked={episode?.plus_access ?? true}
            className={checkboxClassName}
          />
          Included with Plus
        </label>

        <Field label="Locked preview seconds (0–5)" error={errors.lockedPreviewSeconds}>
          <input
            className={inputClassName}
            type="number"
            name="lockedPreviewSeconds"
            min={0}
            max={5}
            defaultValue={episode?.locked_preview_seconds ?? 0}
          />
        </Field>
      </fieldset>

      <fieldset className="space-y-3 border border-bone/10 p-4">
        <legend className={labelClassName}>Classification override</legend>
        <Field label="Content rating override" error={errors.contentRatingOverride}>
          <CmsSelect
            className={inputClassName}
            name="contentRatingOverride"
            defaultValue={episode?.content_rating_override ?? ""}
            placeholderLabel="Inherit from series"
            options={[
              { label: "Inherit from series", value: "" },
              ...CONTENT_RATINGS.map((rating) => ({ label: rating, value: rating })),
            ]}
          />
        </Field>

        <div>
          <span className={labelClassName}>Content descriptor overrides</span>
          <div className="mt-2 flex flex-wrap gap-3">
            {CONTENT_DESCRIPTORS.map((descriptor) => (
              <label key={descriptor} className="flex items-center gap-2 text-sm text-bone/80">
                <input
                  type="checkbox"
                  name="contentDescriptorsOverride"
                  value={descriptor}
                  defaultChecked={episode?.content_descriptors_override?.includes(descriptor) ?? false}
                  className={checkboxClassName}
                />
                {descriptor}
              </label>
            ))}
          </div>
          {errors.contentDescriptorsOverride && (
            <p className="mt-1 text-xs text-red-400">{errors.contentDescriptorsOverride}</p>
          )}
        </div>
      </fieldset>

      {errors.form && <p className="text-sm text-red-400">{errors.form}</p>}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" name="submitMode" value="save" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        {secondarySubmitLabel && secondarySubmitValue && (
          <Button type="submit" name="submitMode" value={secondarySubmitValue} variant="secondary" disabled={pending}>
            {secondarySubmitLabel}
          </Button>
        )}
      </div>
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
