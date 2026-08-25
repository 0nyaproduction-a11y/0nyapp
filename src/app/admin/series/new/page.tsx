import { requireCmsAdmin } from "@/lib/cms/auth";
import { seriesNewPath } from "@/lib/routes";
import { SeriesMetadataForm } from "@/components/cms/SeriesMetadataForm";
import { createSeriesAction } from "@/app/admin/series/actions";

export default async function NewSeriesPage() {
  const context = await requireCmsAdmin(seriesNewPath);

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

  return (
    <main className="min-h-screen bg-deep px-4 py-10 text-bone">
      <div className="mx-auto max-w-2xl">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/60">
          0nya CMS
        </p>
        <h1 className="mt-2 text-2xl font-semibold">New series</h1>
        <p className="mt-1 text-sm text-bone/60">
          Created as a draft. Artwork and status can be set after creation.
        </p>

        <div className="mt-8">
          <SeriesMetadataForm action={createSeriesAction} submitLabel="Create series" />
        </div>
      </div>
    </main>
  );
}
