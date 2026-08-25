"use server";

import { redirect } from "next/navigation";
import { requireCmsAdmin } from "@/lib/cms/auth";
import { createSeries } from "@/lib/cms/series";
import { errorsToRecord, parseSeriesFormData, type SeriesFormState } from "@/lib/cms/series-form";
import { seriesEditPath, seriesListPath } from "@/lib/routes";

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
