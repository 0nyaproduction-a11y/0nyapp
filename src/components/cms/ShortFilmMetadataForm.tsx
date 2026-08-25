"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { CONTENT_DESCRIPTORS, CONTENT_RATINGS } from "@/lib/classification";
import type { ShortFilmRow } from "@/lib/cms/short-films";
import type { ShortFilmFormState } from "@/lib/cms/short-film-form";

const inputClassName =
  "w-full border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone placeholder:text-bone/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal";
const labelClassName = "font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50";
const checkboxClassName = "h-4 w-4 border border-bone/20 bg-bone/[0.03]";

type ShortFilmMetadataFormProps = {
  action: (state: ShortFilmFormState, formData: FormData) => Promise<ShortFilmFormState>;
  shortFilm?: ShortFilmRow;
  submitLabel: string;
};

function toDateTimeLocalValue(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function ShortFilmMetadataForm({ action, shortFilm, submitLabel }: ShortFilmMetadataFormProps) {
  const [state, formAction, pending] = useActionState(action, { errors: {} });
  const errors = state.errors;

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" error={errors.title}>
          <input className={inputClassName} name="title" defaultValue={shortFilm?.title ?? ""} required />
        </Field>
        <Field label="Slug" error={errors.slug}>
          <input
            className={inputClassName}
            name="slug"
            defaultValue={shortFilm?.slug ?? ""}
            placeholder="my-short-film"
            required
          />
        </Field>
      </div>

      <Field label="Synopsis" error={errors.synopsis}>
        <textarea
          className={inputClassName}
          name="synopsis"
          rows={3}
          defaultValue={shortFilm?.synopsis ?? ""}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Runtime (seconds)" error={errors.durationSeconds}>
          <input
            className={inputClassName}
            type="number"
            name="durationSeconds"
            min={0}
            defaultValue={shortFilm?.duration_seconds ?? 0}
          />
        </Field>
        <Field label="Language" error={errors.language}>
          <input className={inputClassName} name="language" defaultValue={shortFilm?.language ?? ""} />
        </Field>
        <Field label="Creator reference" error={errors.creatorReference}>
          <input
            className={inputClassName}
            name="creatorReference"
            defaultValue={shortFilm?.creator_reference ?? ""}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Status" error={errors.status}>
          <select className={inputClassName} name="status" defaultValue={shortFilm?.status ?? "draft"}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </Field>
        <Field label="Publish at" error={errors.publishAt}>
          <input
            className={inputClassName}
            type="datetime-local"
            name="publishAt"
            defaultValue={toDateTimeLocalValue(shortFilm?.publish_at ?? null)}
          />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-bone/80">
          <input
            type="checkbox"
            name="chaiEnabled"
            defaultChecked={shortFilm?.chai_enabled ?? false}
            className={checkboxClassName}
          />
          Chai enabled
        </label>
      </div>

      <fieldset className="space-y-3 border border-bone/10 p-4">
        <legend className={labelClassName}>Classification</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Content rating" error={errors.contentRating}>
            <select
              className={inputClassName}
              name="contentRating"
              defaultValue={shortFilm?.content_rating ?? ""}
            >
              <option value="">Unrated</option>
              {CONTENT_RATINGS.map((rating) => (
                <option key={rating} value={rating}>
                  {rating}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div>
          <span className={labelClassName}>Content descriptors</span>
          <div className="mt-2 flex flex-wrap gap-3">
            {CONTENT_DESCRIPTORS.map((descriptor) => (
              <label key={descriptor} className="flex items-center gap-2 text-sm text-bone/80">
                <input
                  type="checkbox"
                  name="contentDescriptors"
                  value={descriptor}
                  defaultChecked={shortFilm?.content_descriptors?.includes(descriptor) ?? false}
                  className={checkboxClassName}
                />
                {descriptor}
              </label>
            ))}
          </div>
          {errors.contentDescriptors && (
            <p className="mt-1 text-xs text-red-400">{errors.contentDescriptors}</p>
          )}
        </div>
      </fieldset>

      <fieldset className="space-y-3 border border-bone/10 p-4">
        <legend className={labelClassName}>Ads</legend>
        <label className="flex items-center gap-2 text-sm text-bone/80">
          <input
            type="checkbox"
            name="midrollEnabled"
            defaultChecked={shortFilm?.midroll_enabled ?? false}
            className={checkboxClassName}
          />
          Mid-roll enabled
        </label>
        <Field label="Mid-roll timecodes (comma-separated seconds)" error={errors.midrollTimecodes}>
          <input
            className={inputClassName}
            name="midrollTimecodes"
            defaultValue={shortFilm?.midroll_timecodes?.join(", ") ?? ""}
            placeholder="30, 75, 120"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-bone/80">
          <input
            type="checkbox"
            name="postrollEnabled"
            defaultChecked={shortFilm?.postroll_enabled ?? false}
            className={checkboxClassName}
          />
          Post-roll enabled
        </label>
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
