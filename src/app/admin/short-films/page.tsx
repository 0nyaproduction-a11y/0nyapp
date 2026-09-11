import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { CmsEmptyState, CmsFreshnessPanel, type CmsOperatorStatus } from "@/components/cms/CmsStates";
import { ShortFilmSearchInput, ShortFilmStatusSelect } from "@/components/cms/ShortFilmListControls";
import { CmsBreadcrumb } from "@/components/cms/CmsBreadcrumb";
import { requireCmsAdmin } from "@/lib/cms/auth";
import { listShortFilmsForAdmin } from "@/lib/cms/short-films";
import {
  DEFAULT_SHORT_FILM_PAGE_SIZE,
  SHORT_FILM_LIST_QUERY_KEYS,
  SHORT_FILM_PAGE_SIZE_OPTIONS,
  sanitizeAdminReturnTarget,
  sanitizeShortFilmListQuery,
  shortFilmEditPath,
  shortFilmListPath,
  shortFilmNewPath,
  withListContext,
} from "@/lib/routes";

type AdminShortFilmsPageProps = {
  searchParams?: Promise<{ error?: string; flash?: string; page?: string; pageSize?: string; search?: string; status?: string }>;
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

export default async function AdminShortFilmsPage({ searchParams }: AdminShortFilmsPageProps) {
  const params = await (searchParams ?? Promise.resolve<{ error?: string; flash?: string; page?: string; pageSize?: string; search?: string; status?: string }>({}));
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

  // CMS-C08B-05: pageSize follows the billing pattern (25/50/100, default 25).
  // Sanitize page/pageSize so malformed deep-links fall back to canonical.
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const pageSize = SHORT_FILM_PAGE_SIZE_OPTIONS.includes(Number(params.pageSize) as (typeof SHORT_FILM_PAGE_SIZE_OPTIONS)[number])
    ? Number(params.pageSize)
    : DEFAULT_SHORT_FILM_PAGE_SIZE;

  const data = await listShortFilmsForAdmin({
    page: currentPage,
    pageSize,
    search: params.search || "",
    status: params.status || "",
  });

  // Real server-render/revalidation time for the freshness label. Updated on
  // every revalidation (read-only reload, list actions); never fabricated.
  // Server render time is intentionally not pure — it IS the refresh stamp.
  // eslint-disable-next-line react-hooks/purity
  const lastRefreshedMs = Date.now();

  const flashMessage = typeof params.flash === "string" ? params.flash : null;
  const errorMessage = typeof params.error === "string" ? params.error : null;

  const totalPages = Math.ceil(data.totalCount / pageSize);

  const breadcrumbs = [
    { label: "Admin", href: "/admin" },
    { label: "Short Films", isCurrent: true },
  ];

  // CMS-C08B-05: reuse the existing context helper; sanitize so unknown or
  // malformed params never leak into row links. Refresh/deep-link safe.
  const listQuery = sanitizeShortFilmListQuery({
    page: String(currentPage),
    pageSize: String(pageSize),
    search: params.search || "",
    status: params.status || "",
  });

  function buildShortFilmUrl(pageNum: number): string {
    const sp = new URLSearchParams();
    sp.set("page", String(pageNum));
    sp.set("pageSize", String(pageSize));
    if (params.search) sp.set("search", params.search);
    if (params.status && params.status !== "all") sp.set("status", params.status);
    return sanitizeAdminReturnTarget(`${shortFilmListPath}?${sp.toString()}`, shortFilmListPath, SHORT_FILM_LIST_QUERY_KEYS);
  }

  const prevUrl = buildShortFilmUrl(currentPage - 1);
  const nextUrl = buildShortFilmUrl(currentPage + 1);

  // Short-films list: HEALTHY when loaded, FAILED on error.
  const shortFilmStatus: CmsOperatorStatus = errorMessage ? "FAILED" : "HEALTHY";

  return (
    <main className="min-h-screen bg-deep px-4 py-10 text-bone">
      <div className="mx-auto max-w-5xl">
        <CmsBreadcrumb items={breadcrumbs} />

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">Short Films</h1>
            <CmsFreshnessPanel lastRefreshedMs={lastRefreshedMs} status={shortFilmStatus} />
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
            <ShortFilmSearchInput initialSearch={params.search || ""} />
          </label>

          <label className="block space-y-1.5">
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50">Status</span>
            <ShortFilmStatusSelect initialStatus={params.status || "all"} statusOptions={STATUS_OPTIONS} />
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
              Page {currentPage} of {totalPages}
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
