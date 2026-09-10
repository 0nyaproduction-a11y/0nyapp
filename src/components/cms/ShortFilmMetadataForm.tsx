"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { CmsSelect } from "@/components/cms/CmsSelect";
import { CONTENT_DESCRIPTORS, CONTENT_RATINGS } from "@/lib/classification";
import type { ShortFilmRow } from "@/lib/cms/short-films";
import type { ShortFilmFormState } from "@/lib/cms/short-film-form";
import { FormWrapper } from "@/lib/cms/form-wrapper";

const inputClassName =
  "w-full border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone placeholder:text-bone/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal [color-scheme:dark]";
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

  const initialValues = {
    title: shortFilm?.title ?? "",
    slug: shortFilm?.slug ?? "",
    synopsis: shortFilm?.synopsis ?? "",
    durationSeconds: shortFilm?.duration_seconds ?? 0,
    language: shortFilm?.language ?? "",
    creatorReference: shortFilm?.creator_reference ?? "",
    status: shortFilm?.status ?? "draft",
    publishAt: toDateTimeLocalValue(shortFilm?.publish_at ?? null),
    chaiEnabled: shortFilm?.chai_enabled ?? false,
    contentRating: shortFilm?.content_rating ?? "",
    contentDescriptors: shortFilm?.content_descriptors ?? [],
    midrollEnabled: shortFilm?.midroll_enabled ?? false,
    midrollTimecodes: shortFilm?.midroll_timecodes?.join(", ") ?? "",
    postrollEnabled: shortFilm?.postroll_enabled ?? false,
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    formAction(new FormData(e.currentTarget));
  };

  return (
    <FormWrapper
      formId="short-film-metadata"
      initialValues={initialValues}
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" error={errors.title}>
          <input className={inputClassName} name="title" defaultValue={initialValues.title} required />
        </Field>
        <Field label="Slug" error={errors.slug}>
          <input
            className={inputClassName}
            name="slug"
            defaultValue={initialValues.slug}
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
          defaultValue={initialValues.synopsis}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Runtime (seconds)" error={errors.durationSeconds}>
          <input
            className={inputClassName}
            type="number"
            name="durationSeconds"
            min={0}
            defaultValue={initialValues.durationSeconds}
          />
        </Field>
        <Field label="Language" error={errors.language}>
          <input className={inputClassName} name="language" defaultValue={initialValues.language} />
        </Field>
        <Field label="Creator reference" error={errors.creatorReference}>
          <input
            className={inputClassName}
            name="creatorReference"
            defaultValue={initialValues.creatorReference}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Status" error={errors.status}>
          <CmsSelect
            className={inputClassName}
            name="status"
            defaultValue={initialValues.status}
            options={[
              { label: "Draft", value: "draft" },
              { label: "Published", value: "published" },
              { label: "Archived", value: "archived" },
            ]}
          />
        </Field>
        <Field label="Publish at" error={errors.publishAt}>
          <input
            className={inputClassName}
            type="datetime-local"
            name="publishAt"
            defaultValue={initialValues.publishAt}
          />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-bone/80">
          <input
            type="checkbox"
            name="chaiEnabled"
            defaultChecked={initialValues.chaiEnabled}
            className={checkboxClassName}
          />
          Chai enabled
        </label>
      </div>

      <fieldset className="space-y-3 border border-bone/10 p-4">
        <legend className={labelClassName}>Classification</legend>
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
                  defaultChecked={initialValues.contentDescriptors.includes(descriptor)}
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
            defaultChecked={initialValues.midrollEnabled}
            className={checkboxClassName}
          />
          Mid-roll enabled
        </label>
        <Field label="Mid-roll timecodes (comma-separated seconds)" error={errors.midrollTimecodes}>
          <input
            className={inputClassName}
            name="midrollTimecodes"
            defaultValue={initialValues.midrollTimecodes}
            placeholder="30, 75, 120"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-bone/80">
          <input
            type="checkbox"
            name="postrollEnabled"
            defaultChecked={initialValues.postrollEnabled}
            className={checkboxClassName}
          />
          Post-roll enabled
        </label>
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
