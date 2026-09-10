import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { CmsEmptyState } from "@/components/cms/CmsStates";
import { CmsBreadcrumb } from "@/components/cms/CmsBreadcrumb";
import { requireCmsAdmin } from "@/lib/cms/auth";
import { listShortFilmsForAdmin } from "@/lib/cms/short-films";
import { shortFilmEditPath, shortFilmListPath, shortFilmNewPath, withListContext } from "@/lib/routes";

type AdminShortFilmsPageProps = {
  searchParams?: Promise<{ error?: string; flash?: string; page?: string; search?: string; status?: string }>;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "text-bone/50 border-bone/20",
  published: "text-teal border-teal/50",
  archived: "text-bone/30 border-bone/10",
};

const STATUS_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Published", value: "published" },
  { label: "Archived", value: "archived" },
];

const PAGE_SIZE = 25;

export default async function AdminShortFilmsPage({ searchParams }: AdminShortFilmsPageProps) {
  const params = await (searchParams ?? Promise.resolve<{ error?: string; flash?: string; page?: string; search?: string; status?: string }>({}));
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

  const data = await listShortFilmsForAdmin({
    page: params.page ? parseInt(params.page, 10) : 1,
    pageSize: PAGE_SIZE,
    search: params.search || "",
    status: params.status || "",
  });

  const flashMessage = typeof params.flash === "string" ? params.flash : null;
  const errorMessage = typeof params.error === "string" ? params.error : null;

  const totalPages = Math.ceil(data.totalCount / PAGE_SIZE);

  const breadcrumbs = [
    { label: "Admin", href: "/admin" },
    { label: "Short Films", isCurrent: true },
  ];

  const listQuery = {
    page: String(params.page ? parseInt(params.page, 10) : 1),
    search: params.search || "",
    status: params.status || "",
  };

  function buildShortFilmUrl(pageNum: number): string {
    const sp = new URLSearchParams();
    sp.set("page", String(pageNum));
    if (params.search) sp.set("search", params.search);
    if (params.status && params.status !== "all") sp.set("status", params.status);
    return `${shortFilmListPath}?${sp.toString()}`;
  }

  const prevUrl = buildShortFilmUrl(parseInt(params.page ?? "1", 10) - 1);
  const nextUrl = buildShortFilmUrl(parseInt(params.page ?? "1", 10) + 1);

  return (
    <main className="min-h-screen bg-deep px-4 py-10 text-bone">
      <div className="mx-auto max-w-5xl">
        <CmsBreadcrumb items={breadcrumbs} />

        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Short Films</h1>
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

        {/* Controls */}
        <div className="mt-8 grid gap-3 border border-bone/10 bg-bone/[0.03] p-4 sm:grid-cols-3">
          <label className="block space-y-1.5">
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50">Search</span>
            <input
              type="text"
              defaultValue={params.search || ""}
              placeholder="Title or slug"
              className="w-full border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone placeholder:text-bone/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
              onChange={(e) => {
                const value = e.target.value;
                const url = new URL(window.location.href);
                if (value) {
                  url.searchParams.set("search", value);
                } else {
                  url.searchParams.delete("search");
                }
                url.searchParams.set("page", "1");
                window.history.replaceState({}, "", url.toString());
                window.location.reload();
              }}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50">Status</span>
            <select
              value={params.status || "all"}
              onChange={(e) => {
                const value = e.target.value;
                const url = new URL(window.location.href);
                if (value && value !== "all") {
                  url.searchParams.set("status", value);
                } else {
                  url.searchParams.delete("status");
                }
                url.searchParams.set("page", "1");
                window.history.replaceState({}, "", url.toString());
                window.location.reload();
              }}
              className="w-full border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          <div>
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50">Results</p>
            <p className="mt-1 text-sm text-bone/70">
              {data.totalCount} total • {data.filteredCount} {data.filteredCount === 1 ? "match" : "matches"}
            </p>
          </div>
        </div>

        <div className="mt-8 divide-y divide-bone/10 border border-bone/10">
          {data.rows.length === 0 && (
            <CmsEmptyState
              title="No short films yet"
              description="Create your first short film to start building the short-film catalog."
              action={{ href: shortFilmNewPath, label: "New short film" }}
            />
          )}
          {data.rows.map((shortFilm) => (
            <Link
              key={shortFilm.id}
              href={withListContext(shortFilmEditPath(shortFilm.id), listQuery)}
              className="flex items-center justify-between gap-4 px-4 py-4 transition hover:bg-bone/[0.03]"
            >
              <div>
                <p className="font-medium">{shortFilm.title}</p>
                <p className="text-xs text-bone/50">
                  /{shortFilm.slug} · {shortFilm.duration_seconds}s · {shortFilm.publish_at ? new Date(shortFilm.publish_at).toLocaleString() : "No publish time"}
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

        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between gap-3">
            <p className="text-sm text-bone/60">
              Page {(params.page ? parseInt(params.page, 10) : 1)} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Link
                href={prevUrl}
                className="inline-flex min-h-11 items-center justify-center gap-2 border border-bone/20 bg-bone/[0.03] px-4 py-3 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/80 transition hover:border-bone/25 hover:text-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
              >
                Previous
              </Link>
              <Link
                href={nextUrl}
                className="inline-flex min-h-11 items-center justify-center gap-2 border border-teal/70 bg-transparent px-4 py-3 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-teal transition hover:border-teal hover:bg-teal/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
              >
                Next
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
