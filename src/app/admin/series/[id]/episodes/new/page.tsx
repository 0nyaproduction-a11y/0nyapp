import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import Link from "next/link";
import { EpisodeMetadataForm } from "@/components/cms/EpisodeMetadataForm";
import { requireCmsAdmin } from "@/lib/cms/auth";
import { createEpisode } from "@/lib/cms/episodes";
import { errorsToRecord, parseEpisodeFormData, type EpisodeFormState } from "@/lib/cms/episode-form";
import { getSeriesForAdminById } from "@/lib/cms/series";
import { episodeEditPath, episodeNewPath, seriesEditPath } from "@/lib/routes";

type NewEpisodePageProps = {
  params: Promise<{ id: string }>;
};

export default async function NewEpisodePage({ params }: NewEpisodePageProps) {
  const { id: seriesId } = await params;
  const context = await requireCmsAdmin(episodeNewPath(seriesId));

  if (context.status === "forbidden") {
    return (
      <main className="min-h-screen bg-deep px-4 py-10 text-bone">
        <div className="mx-auto max-w-md text-center">
          <h1 className="text-xl font-semibold">Access denied</h1>
          <p className="mt-2 text-sm text-bone/70">You are not authorized for CMS access.</p>
        </div>
      </main>
    );
  }

  const series = await getSeriesForAdminById(seriesId);

  if (!series) {
    notFound();
  }

  async function createEpisodeAction(
    _prevState: EpisodeFormState,
    formData: FormData,
  ): Promise<EpisodeFormState> {
    "use server";

    const guard = await requireCmsAdmin(episodeNewPath(seriesId));

    if (guard.status === "forbidden") {
      return { errors: { form: "You are not authorized to manage content." } };
    }

    const input = parseEpisodeFormData(formData, null);
    const result = await createEpisode(seriesId, input);

    if (!result.success) {
      return { errors: errorsToRecord(result.errors) };
    }

    redirect(episodeEditPath(seriesId, result.episode.id));
  }

  return (
    <main className="min-h-screen bg-deep px-4 py-10 text-bone">
      <div className="mx-auto max-w-2xl">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/60">
          0nya CMS · {series.title}
        </p>
        <h1 className="mt-2 text-2xl font-semibold">New episode</h1>
        <Link href={seriesEditPath(seriesId)} className="mt-1 inline-block text-sm text-teal">
          ← Back to series
        </Link>
        <p className="mt-3 text-sm text-bone/60">
          Created as a draft. Thumbnail and media assignment can be set after creation.
        </p>

        <div className="mt-8">
          <EpisodeMetadataForm action={createEpisodeAction} submitLabel="Create episode" />
        </div>
      </div>
    </main>
  );
}
