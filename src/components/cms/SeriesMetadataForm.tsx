"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { CmsSelect } from "@/components/cms/CmsSelect";
import { CONTENT_DESCRIPTORS, CONTENT_RATINGS } from "@/lib/classification";
import { SERIES_FORMATS, type SeriesRow } from "@/lib/cms/constants";
import { CANONICAL_GENRES, normalizeGenreAssignments } from "@/lib/taxonomy";
import type { SeriesFormState } from "@/lib/cms/series-form";
import { FormWrapper } from "@/lib/cms/form-wrapper";

const inputClassName =
  "w-full border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone placeholder:text-bone/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal [color-scheme:dark]";
const labelClassName = "font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50";

type SeriesMetadataFormProps = {
  action: (state: SeriesFormState, formData: FormData) => Promise<SeriesFormState>;
  series?: SeriesRow;
  submitLabel: string;
};

export function SeriesMetadataForm({ action, series, submitLabel }: SeriesMetadataFormProps) {
  const [state, formAction, pending] = useActionState(action, { errors: {} });
  const errors = state.errors;
  const selectedGenreId = normalizeGenreAssignments(series?.genre).primaryGenre?.id ?? "";

  const initialValues = {
    title: series?.title ?? "",
    slug: series?.slug ?? "",
    synopsis: series?.synopsis ?? "",
    genre: selectedGenreId,
    language: series?.language ?? "",
    format: series?.format ?? "",
    episodeDurationLabel: series?.episode_duration_label ?? "",
    episodeCount: series?.episode_count ?? 0,
    sortOrder: series?.sort_order ?? 0,
    contentRating: series?.content_rating ?? "",
    featured: series?.featured ?? false,
    contentDescriptors: series?.content_descriptors ?? [],
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    formAction(new FormData(e.currentTarget));
  };

  return (
    <FormWrapper
      formId="series-metadata"
      initialValues={initialValues}
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" error={errors.title}>
          <input
            className={inputClassName}
            name="title"
            defaultValue={initialValues.title}
            required
          />
        </Field>
        <Field label="Slug" error={errors.slug}>
          <input
            className={inputClassName}
            name="slug"
            defaultValue={initialValues.slug}
            placeholder="my-series-title"
            required
          />
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

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Genre" error={errors.genre}>
          <CmsSelect
            className={inputClassName}
            name="genre"
            defaultValue={initialValues.genre}
            placeholderLabel="Unset"
            options={[
              { label: "Unset", value: "" },
              ...CANONICAL_GENRES.map((genre) => ({ label: genre.displayName, value: genre.id })),
            ]}
          />
        </Field>
        <Field label="Language" error={errors.language}>
          <input className={inputClassName} name="language" defaultValue={initialValues.language} />
        </Field>
        <Field label="Format" error={errors.format}>
          <CmsSelect
            className={inputClassName}
            name="format"
            defaultValue={initialValues.format}
            placeholderLabel="Unset"
            options={[
              { label: "Unset", value: "" },
              ...SERIES_FORMATS.map((format) => ({ label: format, value: format })),
            ]}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Episode duration label" error={errors.episodeDurationLabel}>
          <input
            className={inputClassName}
            name="episodeDurationLabel"
            placeholder="e.g. 8–10 min"
            defaultValue={initialValues.episodeDurationLabel}
          />
        </Field>
        <Field label="Episode count" error={errors.episodeCount}>
          <input
            className={inputClassName}
            type="number"
            name="episodeCount"
            min={0}
            defaultValue={initialValues.episodeCount}
          />
        </Field>
        <Field label="Sort order" error={errors.sortOrder}>
          <input
            className={inputClassName}
            type="number"
            name="sortOrder"
            defaultValue={initialValues.sortOrder}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Content rating" error={errors.contentRating}>
          <CmsSelect
            className={inputClassName}
            name="contentRating"
            defaultValue={initialValues.contentRating}
            placeholderLabel="Unrated"
            options={[
              { label: "Unrated", value: "" },
              ...CONTENT_RATINGS.map((rating) => ({ label: rating, value: rating })),
            ]}
          />
        </Field>

        <label className="flex items-center gap-2 self-end pb-2 text-sm text-bone/80">
          <input
            type="checkbox"
            name="featured"
            defaultChecked={initialValues.featured}
            className="h-4 w-4 border border-bone/20 bg-bone/[0.03]"
          />
          Featured
        </label>
      </div>

      <fieldset>
        <legend className={labelClassName}>Content descriptors</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {CONTENT_DESCRIPTORS.map((descriptor) => (
            <label key={descriptor} className="flex items-center gap-2 text-sm text-bone/80">
              <input
                type="checkbox"
                name="contentDescriptors"
                value={descriptor}
                defaultChecked={initialValues.contentDescriptors.includes(descriptor)}
                className="h-4 w-4 border border-bone/20 bg-bone/[0.03]"
              />
              {descriptor}
            </label>
          ))}
        </div>
        {errors.contentDescriptors && (
          <p className="mt-1 text-xs text-red-400">{errors.contentDescriptors}</p>
        )}
      </fieldset>

      {errors.form && <p className="text-sm text-red-400">{errors.form}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
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
