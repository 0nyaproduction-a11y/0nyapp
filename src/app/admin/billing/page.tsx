import Link from "next/link";
import { revalidatePath } from "next/cache";
import { CmsEmptyState, CmsFreshnessPanel, CmsSubmitButton, type CmsOperatorStatus } from "@/components/cms/CmsStates";
import { BillingPageSizeSelect } from "@/components/cms/BillingPageSizeSelect";
import { CmsBreadcrumb } from "@/components/cms/CmsBreadcrumb";
import { requireCmsAdmin } from "@/lib/cms/auth";
import { listCoinProducts, reorderCoinProducts, updateCoinProductActive } from "@/lib/cms/billing";
import { billingListPath } from "@/lib/routes";

type AdminBillingPageProps = {
  searchParams?: Promise<{ page?: string; pageSize?: string }>;
};

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTS = [25, 50, 100];

export default async function AdminBillingPage({ searchParams }: AdminBillingPageProps) {
  const params = await (searchParams ?? Promise.resolve<{ page?: string; pageSize?: string }>({}));
  const context = await requireCmsAdmin(billingListPath);

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

  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = PAGE_SIZE_OPTS.includes(Number(params.pageSize)) ? Number(params.pageSize) : DEFAULT_PAGE_SIZE;
  const { rows: products, totalCount } = await listCoinProducts({ page, pageSize });
  const totalPages = Math.ceil(totalCount / pageSize);

  // Real server-render/revalidation time for the freshness label. Updated on
  // every revalidation (read-only reload, list actions); never fabricated.
  // Server render time is intentionally not pure — it IS the refresh stamp.
  // eslint-disable-next-line react-hooks/purity
  const lastRefreshedMs = Date.now();

  const breadcrumbs = [
    { label: "Admin", href: "/admin" },
    { label: "Billing", isCurrent: true },
  ];

  async function toggleCoinProductAction(formData: FormData) {
    "use server";

    const guard = await requireCmsAdmin(billingListPath);

    if (guard.status !== "authorized") {
      return;
    }

    const code = formData.get("code")?.toString() ?? "";
    const currentlyActive = formData.get("active") === "on";

    await updateCoinProductActive(code, !currentlyActive);
    revalidatePath(billingListPath);
  }

  async function reorderCoinProductAction(formData: FormData) {
    "use server";

    const guard = await requireCmsAdmin(billingListPath);

    if (guard.status !== "authorized") {
      return;
    }

    const code = formData.get("code")?.toString() ?? "";
    const direction = formData.get("direction")?.toString() ?? "up";

    const orderedResult = await listCoinProducts({ page: 1, pageSize: 100 });
    const codes = orderedResult.rows.map((product) => product.code);
    const index = codes.indexOf(code);

    if (index < 0) {
      return;
    }

    const target = direction === "up" ? index - 1 : index + 1;

    if (target < 0 || target >= codes.length) {
      return;
    }

    const newOrder = [...codes];
    [newOrder[index], newOrder[target]] = [newOrder[target], newOrder[index]];

    await reorderCoinProducts(newOrder);
    revalidatePath(billingListPath);
  }

  // Billing list: HEALTHY when loaded successfully.
  const billingStatus: CmsOperatorStatus = "HEALTHY";

  return (
    <main className="min-h-screen bg-deep px-4 py-10 text-bone">
      <div className="mx-auto max-w-5xl">
        <CmsBreadcrumb items={breadcrumbs} />

        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="mt-2 text-2xl font-semibold">Billing</h1>
            <p className="mt-1 max-w-xl text-sm text-bone/60">
              Coin pack catalog. Quantities (coin_amount) are CMS/config-controlled; real-money prices
              live in store metadata and are not editable here.
            </p>
          </div>
          <CmsFreshnessPanel lastRefreshedMs={lastRefreshedMs} status={billingStatus} />
        </div>

        <div className="mt-8 grid gap-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50">Results</p>
              <p className="mt-1 text-sm text-bone/70">
                {totalCount} total &bull; {products.length} {products.length === 1 ? "match" : "matches"}
              </p>
            </div>
            <div>
              <BillingPageSizeSelect pageSize={pageSize} options={PAGE_SIZE_OPTS} />
            </div>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between gap-3">
            <p className="text-sm text-bone/60">
              Page {(params.page ? parseInt(params.page, 10) : 1)} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Link
                href={`${billingListPath}?${new URLSearchParams({
                  page: String(parseInt(params.page ?? "1", 10) - 1),
                  ...(params.pageSize && { pageSize: params.pageSize }),
                }).toString()}`}
                className="inline-flex min-h-11 items-center justify-center gap-2 border border-bone/20 bg-bone/[0.03] px-4 py-3 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/80 transition hover:border-bone/25 hover:text-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </Link>
              <Link
                href={`${billingListPath}?${new URLSearchParams({
                  page: String(parseInt(params.page ?? "1", 10) + 1),
                  ...(params.pageSize && { pageSize: params.pageSize }),
                }).toString()}`}
                className="inline-flex min-h-11 items-center justify-center gap-2 border border-teal/70 bg-transparent px-4 py-3 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-teal transition hover:border-teal hover:bg-teal/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </Link>
            </div>
          </div>
        )}

        <div className="mt-8 divide-y divide-bone/10 border border-bone/10">
          {products.length === 0 && (
            <CmsEmptyState
              title="No coin products configured"
              description="Coin packs are provisioned in the backend catalog. Products appear here once they are configured."
            />
          )}
          {products.map((product, index) => {
            const isFirst = index === 0;
            const isLast = index === products.length - 1;

            return (
              <div key={product.code} className="flex items-center justify-between gap-4 px-4 py-4">
                <div>
                  <p className="font-medium">{product.display_name}</p>
                  <p className="text-xs text-bone/50">
                    code: {product.code} · {product.coin_amount} coins · sort {product.sort_order}
                  </p>
                </div>

                <span
                  className={`border px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] ${
                    product.active
                      ? "text-teal border-teal/50"
                      : "text-bone/30 border-bone/10"
                  }`}
                >
                  {product.active ? "Active" : "Inactive"}
                </span>

                <div className="flex items-center gap-1">
                  <form action={reorderCoinProductAction}>
                    <input type="hidden" name="code" value={product.code} />
                    <input type="hidden" name="direction" value="up" />
                    <CmsSubmitButton
                      disabled={isFirst}
                      pendingLabel="Moving…"
                      title="Move up"
                      className="inline-flex min-h-11 items-center justify-center gap-2 border border-bone/10 bg-bone/[0.03] px-4 py-3 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/80 transition hover:border-bone/25 hover:text-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      ↑
                    </CmsSubmitButton>
                  </form>
                  <form action={reorderCoinProductAction}>
                    <input type="hidden" name="code" value={product.code} />
                    <input type="hidden" name="direction" value="down" />
                    <CmsSubmitButton
                      disabled={isLast}
                      pendingLabel="Moving…"
                      title="Move down"
                      className="inline-flex min-h-11 items-center justify-center gap-2 border border-bone/10 bg-bone/[0.03] px-4 py-3 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/80 transition hover:border-bone/25 hover:text-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      ↓
                    </CmsSubmitButton>
                  </form>
                  <form action={toggleCoinProductAction}>
                    <input type="hidden" name="code" value={product.code} />
                    <input type="hidden" name="active" value={product.active ? "on" : ""} />
                    <CmsSubmitButton
                      pendingLabel="Updating…"
                      className="inline-flex min-h-11 items-center justify-center gap-2 border border-teal/70 bg-transparent px-4 py-3 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-teal transition hover:border-teal hover:bg-teal/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {product.active ? "Disable" : "Enable"}
                    </CmsSubmitButton>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}