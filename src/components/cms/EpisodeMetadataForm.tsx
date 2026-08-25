"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { CONTENT_DESCRIPTORS, CONTENT_RATINGS } from "@/lib/classification";
import type { EpisodeRow } from "@/lib/cms/constants";
import type { EpisodeFormState } from "@/lib/cms/episode-form";

const inputClassName =
  "w-full border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone placeholder:text-bone/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal";
const labelClassName = "font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50";
const checkboxClassName = "h-4 w-4 border border-bone/20 bg-bone/[0.03]";

type EpisodeMetadataFormProps = {
  action: (state: EpisodeFormState, formData: FormData) => Promise<EpisodeFormState>;
  episode?: EpisodeRow;
  submitLabel: string;
};

export function EpisodeMetadataForm({ action, episode, submitLabel }: EpisodeMetadataFormProps) {
  const [state, formAction, pending] = useActionState(action, { errors: {} });
  const errors = state.errors;

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
            <select
              className={inputClassName}
              name="rewardedAccessMode"
              defaultValue={episode?.rewarded_access_mode ?? "permanent"}
            >
              <option value="permanent">Permanent</option>
              <option value="session">Session</option>
            </select>
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-bone/80">
          <input
            type="checkbox"
            name="plusAccess"
            defaultChecked={episode?.plus_access ?? true}
            className={checkboxClassName}
          />
          Included with Plus
        </label>

        <Field label="Locked preview seconds (0–3)" error={errors.lockedPreviewSeconds}>
          <input
            className={inputClassName}
            type="number"
            name="lockedPreviewSeconds"
            min={0}
            max={3}
            defaultValue={episode?.locked_preview_seconds ?? 0}
          />
        </Field>
      </fieldset>

      <fieldset className="space-y-3 border border-bone/10 p-4">
        <legend className={labelClassName}>Classification override</legend>
        <Field label="Content rating override" error={errors.contentRatingOverride}>
          <select
            className={inputClassName}
            name="contentRatingOverride"
            defaultValue={episode?.content_rating_override ?? ""}
          >
            <option value="">Inherit from series</option>
            {CONTENT_RATINGS.map((rating) => (
              <option key={rating} value={rating}>
                {rating}
              </option>
            ))}
          </select>
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

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
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
