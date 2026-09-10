"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CmsSelect } from "@/components/cms/CmsSelect";
import { CONTENT_DESCRIPTORS, CONTENT_RATINGS } from "@/lib/classification";
import type { EpisodeRow } from "@/lib/cms/constants";
import type { EpisodeFormState } from "@/lib/cms/episode-form";
import {
  EPISODE_ACCESS_MODE_OPTIONS,
  inferEpisodeAccessMode,
  mapAccessModeToFields,
  type EpisodeAccessMode,
} from "@/lib/cms/episode-access";
import { FormWrapper } from "@/lib/cms/form-wrapper";

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

  const initialInferred = episode
    ? inferEpisodeAccessMode({
        isFree: episode.is_free,
        coinUnlockEnabled: episode.coin_unlock_enabled,
        coinPrice: episode.coin_price,
        rewardedUnlockEnabled: episode.rewarded_unlock_enabled,
        plusAccess: episode.plus_access,
      })
    : null;

  const isAmbiguous = Boolean(episode && initialInferred === null);

  const initialAccessMode: EpisodeAccessMode =
    initialInferred ??
    (episode?.is_free
      ? "FREE"
      : episode?.coin_unlock_enabled
        ? episode.plus_access
          ? "COINS_OR_PLUS"
          : "COINS"
        : episode?.rewarded_unlock_enabled
          ? "REWARDED_OR_PLUS"
          : "PLUS");

  const [accessMode, setAccessMode] = useState<EpisodeAccessMode>(initialAccessMode);
  const [coinPrice, setCoinPrice] = useState<number>(
    episode?.coin_price && episode.coin_price > 0 ? episode.coin_price : 10,
  );
  const [requiredRewardedCompletions, setRequiredRewardedCompletions] = useState<number>(
    episode?.required_rewarded_completions ?? 1,
  );

  const derivedFields = mapAccessModeToFields(accessMode, {
    coinPrice,
    requiredRewardedCompletions,
  });

  const initialValues = {
    episodeNumber: episode?.episode_number ?? 1,
    title: episode?.title ?? "",
    synopsis: episode?.synopsis ?? "",
    durationSeconds: episode?.duration_seconds ?? 0,
    accessMode: initialAccessMode,
    isFree: derivedFields.isFree,
    coinUnlockEnabled: derivedFields.coinUnlockEnabled,
    coinPrice: derivedFields.coinPrice,
    rewardedUnlockEnabled: derivedFields.rewardedUnlockEnabled,
    rewardedAccessMode: "permanent",
    requiredRewardedCompletions: derivedFields.requiredRewardedCompletions,
    plusAccess: derivedFields.plusAccess,
    lockedPreviewSeconds: episode?.locked_preview_seconds ?? 0,
    contentRatingOverride: episode?.content_rating_override ?? "",
    contentDescriptorsOverride: episode?.content_descriptors_override ?? [],
  };

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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    formAction(new FormData(e.currentTarget));
  };

  return (
    <FormWrapper
      formId="episode-metadata"
      initialValues={initialValues}
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Episode number" error={errors.episodeNumber}>
          <input
            className={inputClassName}
            type="number"
            name="episodeNumber"
            min={1}
            defaultValue={initialValues.episodeNumber}
            required
          />
        </Field>
        <Field label="Title" error={errors.title}>
          <input className={inputClassName} name="title" defaultValue={initialValues.title} />
        </Field>
      </div>

      <Field label="Synopsis" error={errors.synopsis}>
        <textarea
          className={inputClassName}
          name="synopsis"
          rows={3}
          defaultValue={initialValues.synopsis}
        />
      </Field>

      <Field label="Duration (seconds)" error={errors.durationSeconds}>
        <input
          className={inputClassName}
          type="number"
          name="durationSeconds"
          min={0}
          defaultValue={initialValues.durationSeconds}
        />
      </Field>

      <fieldset className="space-y-4 border border-bone/10 p-4">
        <legend className={labelClassName}>Access configuration</legend>
        {errors.access && <p className="text-xs text-red-400">{errors.access}</p>}
        {errors.accessMode && <p className="text-xs text-red-400">{errors.accessMode}</p>}
        {errors.isFree && <p className="text-xs text-red-400">{errors.isFree}</p>}

        {isAmbiguous && (
          <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
            <p className="font-semibold">⚠️ Attention: Legacy / Ambiguous Access Configuration</p>
            <p className="mt-0.5 text-amber-300/80">
              This episode currently has a contradictory or ambiguous monetization state in the database.
              Select an explicit Access Mode below to conform to the 5 locked product modes upon saving.
            </p>
          </div>
        )}

        {/* Explicit accessMode drives parsing; hidden inputs provide compatibility fallback */}
        <input type="hidden" name="accessMode" value={accessMode} />
        <input type="hidden" name="isFree" value={derivedFields.isFree ? "on" : "off"} />
        <input type="hidden" name="coinUnlockEnabled" value={derivedFields.coinUnlockEnabled ? "on" : "off"} />
        <input type="hidden" name="rewardedUnlockEnabled" value={derivedFields.rewardedUnlockEnabled ? "on" : "off"} />
        <input type="hidden" name="plusAccess" value={derivedFields.plusAccess ? "on" : "off"} />

        <div className="space-y-2">
          <span className={labelClassName}>Access mode</span>
          <div className="space-y-2">
            {EPISODE_ACCESS_MODE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-3 rounded border p-3 transition-colors ${
                  accessMode === option.value
                    ? "border-teal/50 bg-teal/[0.06]"
                    : "border-bone/10 bg-bone/[0.02] hover:border-bone/25"
                }`}
              >
                <input
                  type="radio"
                  name="_accessModeRadio"
                  value={option.value}
                  checked={accessMode === option.value}
                  onChange={() => setAccessMode(option.value)}
                  className="mt-0.5 h-4 w-4 border-bone/20 text-teal focus:ring-teal"
                />
                <div className="space-y-0.5">
                  <span className="block text-sm font-medium text-bone">{option.label}</span>
                  <span className="block text-xs text-bone/60">{option.description}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Reveal only relevant controls */}
        {(accessMode === "COINS" || accessMode === "COINS_OR_PLUS") && (
          <div className="pt-2">
            <Field label="Coin price" error={errors.coinPrice}>
              <input
                className={inputClassName}
                type="number"
                name="coinPrice"
                min={1}
                value={coinPrice}
                onChange={(e) => setCoinPrice(Math.max(1, parseInt(e.target.value) || 0))}
                required
              />
            </Field>
          </div>
        )}

        {accessMode === "REWARDED_OR_PLUS" && (
          <div className="grid gap-4 pt-2 sm:grid-cols-2">
            <Field label="Rewarded ads required" error={errors.requiredRewardedCompletions}>
              <CmsSelect
                className={inputClassName}
                name="requiredRewardedCompletions"
                value={String(requiredRewardedCompletions)}
                onChange={(val) => setRequiredRewardedCompletions(parseInt(val) || 1)}
                options={[
                  { label: "1 (single ad)", value: "1" },
                  { label: "2 (two ads)", value: "2" },
                ]}
              />
            </Field>
            <div className="flex flex-col justify-center text-xs text-bone/60">
              <p>Rewarded access is permanent-only at launch.</p>
              <p className="mt-1 text-teal/80">Included with Plus is derived and locked ON.</p>
            </div>
          </div>
        )}

        {accessMode === "COINS_OR_PLUS" && (
          <p className="text-xs text-teal/80">
            Included with Plus is derived and locked ON for Coins or Plus mode.
          </p>
        )}

        {accessMode === "PLUS" && (
          <p className="text-xs text-teal/80">
            Episode access is included with 0nya Plus subscription.
          </p>
        )}

        {accessMode === "FREE" && (
          <p className="text-xs text-teal/80">
            Free to watch is standalone. Coin unlock, Rewarded ads, and Plus gating are all disabled.
          </p>
        )}

        <Field label="Locked preview seconds (0–5)" error={errors.lockedPreviewSeconds}>
          <input
            className={inputClassName}
            type="number"
            name="lockedPreviewSeconds"
            min={0}
            max={5}
            defaultValue={initialValues.lockedPreviewSeconds}
          />
        </Field>
      </fieldset>

      <fieldset className="space-y-3 border border-bone/10 p-4">
        <legend className={labelClassName}>Classification override</legend>
        <Field label="Content rating override" error={errors.contentRatingOverride}>
          <CmsSelect
            className={inputClassName}
            name="contentRatingOverride"
            defaultValue={initialValues.contentRatingOverride}
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
                  defaultChecked={initialValues.contentDescriptorsOverride.includes(descriptor)}
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
    </FormWrapper>
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
