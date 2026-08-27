"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCmsAdmin } from "@/lib/cms/auth";
import { createSeries, getSeriesForAdminBySlug } from "@/lib/cms/series";
import { errorsToRecord, parseSeriesFormData, type SeriesFormState } from "@/lib/cms/series-form";
import { seriesEditPath, seriesListPath, seriesNewPath } from "@/lib/routes";
import type { SeriesInput, SeriesActionResult } from "@/lib/cms/series";

export async function createSeriesDraftAction(input: SeriesInput): Promise<SeriesActionResult> {
  const context = await requireCmsAdmin(seriesListPath);

  if (context.status === "forbidden") {
    return { success: false, errors: [{ field: "form", message: "You are not authorized to manage content." }] };
  }

  const result = await createSeries(input);

  if (result.success) {
    revalidatePath(seriesListPath);
    revalidatePath(seriesNewPath);
  } else if (result.errors.some((error) => error.field === "slug")) {
    const existingDraft = await getSeriesForAdminBySlug(input.slug);

    if (existingDraft?.status === "draft") {
      return { success: true, series: existingDraft };
    }
  }

  return result;
}

export async function createSeriesAction(
  _prevState: SeriesFormState,
  formData: FormData,
): Promise<SeriesFormState> {
  const context = await requireCmsAdmin(seriesListPath);

  if (context.status === "forbidden") {
    return { errors: { form: "You are not authorized to manage content." } };
  }

  const input = parseSeriesFormData(formData);
  const result = await createSeries(input);

  if (!result.success) {
    return { errors: errorsToRecord(result.errors) };
  }

  redirect(seriesEditPath(result.series.id));
}
