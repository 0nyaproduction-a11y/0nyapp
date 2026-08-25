import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { requireCmsAdmin } from "@/lib/cms/auth";
import { listShortFilmsForAdmin } from "@/lib/cms/short-films";
import { shortFilmEditPath, shortFilmNewPath } from "@/lib/routes";

type AdminShortFilmsPageProps = {
  searchParams?: Promise<{ error?: string; flash?: string }>;
};

const STATUS_STYLES: Record<string, string> = {
  draft: "text-bone/50 border-bone/20",
  published: "text-teal border-teal/50",
  archived: "text-bone/30 border-bone/10",
};

export default async function AdminShortFilmsPage({ searchParams }: AdminShortFilmsPageProps) {
  const params = await (searchParams ?? Promise.resolve<{ error?: string; flash?: string }>({}));
  const context = await requireCmsAdmin(shortFilmNewPath);

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

  const shortFilms = await listShortFilmsForAdmin();
  const flashMessage = typeof params.flash === "string" ? params.flash : null;
  const errorMessage = typeof params.error === "string" ? params.error : null;

  return (
    <main className="min-h-screen bg-deep px-4 py-10 text-bone">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/60">
              0nya CMS
            </p>
            <h1 className="mt-2 text-2xl font-semibold">Short Films</h1>
          </div>
          <ButtonLink href={shortFilmNewPath}>New short film</ButtonLink>
        </div>

        {flashMessage && (
          <div className="mt-4 border border-teal/30 bg-teal/10 px-4 py-3 text-sm text-teal">
            {flashMessage}
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {errorMessage}
          </div>
        )}

        <div className="mt-8 divide-y divide-bone/10 border border-bone/10">
          {shortFilms.length === 0 && (
            <p className="px-4 py-6 text-sm text-bone/60">No short films yet.</p>
          )}
          {shortFilms.map((shortFilm) => (
            <Link
              key={shortFilm.id}
              href={shortFilmEditPath(shortFilm.id)}
              className="flex items-center justify-between gap-4 px-4 py-4 transition hover:bg-bone/[0.03]"
            >
              <div>
                <p className="font-medium">{shortFilm.title}</p>
                <p className="text-xs text-bone/50">
                  /{shortFilm.slug} · {shortFilm.duration_seconds}s ·{" "}
                  {shortFilm.publish_at ? new Date(shortFilm.publish_at).toLocaleString() : "No publish time"}
                </p>
              </div>
              <span
                className={`border px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] ${STATUS_STYLES[shortFilm.status] ?? STATUS_STYLES.draft}`}
              >
                {shortFilm.status}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
