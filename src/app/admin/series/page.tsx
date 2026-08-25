import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { requireCmsAdmin } from "@/lib/cms/auth";
import { listSeriesForAdmin } from "@/lib/cms/series";
import { seriesEditPath, seriesNewPath } from "@/lib/routes";

const STATUS_STYLES: Record<string, string> = {
  draft: "text-bone/50 border-bone/20",
  published: "text-teal border-teal/50",
  archived: "text-bone/30 border-bone/10",
};

export default async function AdminSeriesListPage() {
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

  const series = await listSeriesForAdmin();

  return (
    <main className="min-h-screen bg-deep px-4 py-10 text-bone">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/60">
              0nya CMS
            </p>
            <h1 className="mt-2 text-2xl font-semibold">Series</h1>
          </div>
          <ButtonLink href={seriesNewPath}>New series</ButtonLink>
        </div>

        <div className="mt-8 divide-y divide-bone/10 border border-bone/10">
          {series.length === 0 && (
            <p className="px-4 py-6 text-sm text-bone/60">No series yet.</p>
          )}
          {series.map((item) => (
            <Link
              key={item.id}
              href={seriesEditPath(item.id)}
              className="flex items-center justify-between gap-4 px-4 py-4 transition hover:bg-bone/[0.03]"
            >
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-xs text-bone/50">
                  /{item.slug} · {item.episode_count} episodes
                </p>
              </div>
              <span
                className={`border px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] ${STATUS_STYLES[item.status] ?? STATUS_STYLES.draft}`}
              >
                {item.status}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
