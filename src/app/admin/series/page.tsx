import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { CmsEmptyState } from "@/components/cms/CmsStates";
import { CmsBreadcrumb } from "@/components/cms/CmsBreadcrumb";
import { requireCmsAdmin } from "@/lib/cms/auth";
import { listSeriesForAdmin } from "@/lib/cms/series";
import { seriesEditPath, seriesListPath, seriesNewPath, withListContext } from "@/lib/routes";
import { SeriesListFilters } from "@/components/cms/SeriesListFilters";

type AdminSeriesListPageProps = {
  searchParams?: Promise<{ error?: string; flash?: string; page?: string; search?: string; status?: string }>;
};

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

export default async function AdminSeriesListPage({ searchParams }: AdminSeriesListPageProps) {
  const params = await (searchParams ?? Promise.resolve<{ error?: string; flash?: string; page?: string; search?: string; status?: string }>({}));
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

  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const data = await listSeriesForAdmin({
    page: currentPage,
    pageSize: PAGE_SIZE,
    search: params.search || "",
    status: params.status || "",
  });

  const flashMessage = typeof params.flash === "string" ? params.flash : null;
  const errorMessage = typeof params.error === "string" ? params.error : null;

  const totalPages = Math.ceil(data.totalCount / PAGE_SIZE);

  const breadcrumbs = [
    { label: "Admin", href: "/admin" },
    { label: "Series", isCurrent: true },
  ];

  const listQuery = {
    page: String(currentPage),
    search: params.search || "",
    status: params.status || "",
  };

  return (
    <main className="min-h-screen bg-deep px-4 py-10 text-bone">
      <div className="mx-auto max-w-4xl">
        <CmsBreadcrumb items={breadcrumbs} />

        <div className="mt-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Series</h1>
          </div>
          <ButtonLink href={seriesNewPath}>New series</ButtonLink>
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

        <SeriesListFilters
          initialSearch={params.search || ""}
          initialStatus={params.status || ""}
          statusOptions={STATUS_OPTIONS}
          totalCount={data.totalCount}
          filteredCount={data.filteredCount}
        />

        <div className="mt-8 divide-y divide-bone/10 border border-bone/10">
          {data.rows.length === 0 && (
            <CmsEmptyState
              title="No series yet"
              description="Create your first series to start adding episodes."
              action={{ href: seriesNewPath, label: "New series" }}
            />
          )}
          {data.rows.map((item) => (
            <Link
              key={item.id}
              href={withListContext(seriesEditPath(item.id), listQuery)}
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

        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between gap-3">
            <p className="text-sm text-bone/60">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Link
                href={buildPaginationUrl(currentPage - 1, params.search, params.status)}
                className={`inline-flex min-h-11 items-center justify-center gap-2 border border-bone/20 bg-bone/[0.03] px-4 py-3 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/80 transition hover:border-bone/25 hover:text-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${currentPage <= 1 ? "pointer-events-none opacity-50" : ""}`}
                aria-disabled={currentPage <= 1}
              >
                Previous
              </Link>
              <Link
                href={buildPaginationUrl(currentPage + 1, params.search, params.status)}
                className={`inline-flex min-h-11 items-center justify-center gap-2 border border-teal/70 bg-transparent px-4 py-3 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-teal transition hover:border-teal hover:bg-teal/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}`}
                aria-disabled={currentPage >= totalPages}
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

function buildPaginationUrl(page: number, search?: string, status?: string) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (search) params.set("search", search);
  if (status && status !== "all") params.set("status", status);
  return `${seriesListPath}?${params.toString()}`;
}