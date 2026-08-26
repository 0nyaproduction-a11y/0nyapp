import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { CmsSelect } from "@/components/cms/CmsSelect";
import { requireCmsAdmin } from "@/lib/cms/auth";
import {
  addHomeRowItem,
  createHomeEditorialRow,
  getHomeAdminData,
  listHomeContentChoices,
  removeHomeRowItem,
  updateHomeLowHistoryThreshold,
  updateHomeRow,
  updateHomeRowItem,
} from "@/lib/cms/home";
import { getFeaturedSeries } from "@/lib/catalog";
import { homeListPath } from "@/lib/routes";

type HomeAdminPageProps = {
  searchParams?: Promise<{ error?: string; flash?: string }>;
};

function buildFlashUrl(type: "error" | "flash", message: string) {
  const params = new URLSearchParams();
  params.set(type, message);
  return `${homeListPath}?${params.toString()}`;
}

export default async function HomeAdminPage({ searchParams }: HomeAdminPageProps) {
  const params = await (searchParams ?? Promise.resolve<{ error?: string; flash?: string }>({}));
  const context = await requireCmsAdmin(homeListPath);

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

  const [homeData, contentChoices, featuredSeries] = await Promise.all([
    getHomeAdminData(),
    listHomeContentChoices(),
    getFeaturedSeries(),
  ]);
  const flashMessage = typeof params.flash === "string" ? params.flash : null;
  const errorMessage = typeof params.error === "string" ? params.error : null;

  const seriesChoices = contentChoices.filter((choice) => choice.contentType === "series");
  const shortFilmChoices = contentChoices.filter((choice) => choice.contentType === "short_film");

  async function updateHomeSettingsAction(formData: FormData) {
    "use server";

    const guard = await requireCmsAdmin(homeListPath);
    if (guard.status !== "authorized") {
      redirect(buildFlashUrl("error", "Not authorized."));
    }

    const threshold = Number(formData.get("lowHistoryThreshold"));
    if (!Number.isInteger(threshold) || threshold < 0) {
      redirect(buildFlashUrl("error", "Low-history threshold must be a non-negative whole number."));
    }

    const result = await updateHomeLowHistoryThreshold(threshold);
    if (!result) {
      redirect(buildFlashUrl("error", "Unable to save low-history threshold."));
    }

    revalidatePath(homeListPath);
    revalidatePath("/");
    revalidatePath("/api/v1/catalog");
    redirect(buildFlashUrl("flash", "Low-history threshold saved."));
  }

  async function createHomeRowAction(formData: FormData) {
    "use server";

    const guard = await requireCmsAdmin(homeListPath);
    if (guard.status !== "authorized") {
      redirect(buildFlashUrl("error", "Not authorized."));
    }

    const title = String(formData.get("title") ?? "").trim();
    const sortOrder = Number(formData.get("sortOrder"));

    if (!title) {
      redirect(buildFlashUrl("error", "Row title is required."));
    }

    if (!Number.isInteger(sortOrder)) {
      redirect(buildFlashUrl("error", "Row sort order must be a whole number."));
    }

    const result = await createHomeEditorialRow({ sortOrder, title });

    if (!result) {
      redirect(buildFlashUrl("error", "Unable to create home row."));
    }

    revalidatePath(homeListPath);
    redirect(buildFlashUrl("flash", "Home row created."));
  }

  async function updateHomeRowAction(formData: FormData) {
    "use server";

    const guard = await requireCmsAdmin(homeListPath);
    if (guard.status !== "authorized") {
      redirect(buildFlashUrl("error", "Not authorized."));
    }

    const rowId = String(formData.get("rowId") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const enabled = formData.get("enabled") === "on";
    const sortOrder = Number(formData.get("sortOrder"));

    if (!rowId) {
      redirect(buildFlashUrl("error", "Row ID is required."));
    }

    if (!title) {
      redirect(buildFlashUrl("error", "Row title is required."));
    }

    if (!Number.isInteger(sortOrder)) {
      redirect(buildFlashUrl("error", "Row sort order must be a whole number."));
    }

    const result = await updateHomeRow(rowId, { enabled, sortOrder, title });
    if (!result) {
      redirect(buildFlashUrl("error", "Unable to update row."));
    }

    revalidatePath(homeListPath);
    revalidatePath("/");
    revalidatePath("/api/v1/catalog");
    redirect(buildFlashUrl("flash", "Home row saved."));
  }

  async function addHomeRowItemAction(formData: FormData) {
    "use server";

    const guard = await requireCmsAdmin(homeListPath);
    if (guard.status !== "authorized") {
      redirect(buildFlashUrl("error", "Not authorized."));
    }

    const rowId = String(formData.get("rowId") ?? "").trim();
    const contentRef = String(formData.get("contentRef") ?? "").trim();
    const sortOrder = Number(formData.get("sortOrder"));

    if (!rowId || !contentRef) {
      redirect(buildFlashUrl("error", "Row and content selection are required."));
    }

    if (!Number.isInteger(sortOrder)) {
      redirect(buildFlashUrl("error", "Item sort order must be a whole number."));
    }

    const [contentType, contentId] = contentRef.split(":", 2);
    if (!contentId || (contentType !== "series" && contentType !== "short_film")) {
      redirect(buildFlashUrl("error", "Unsupported content type."));
    }

    const result = await addHomeRowItem({
      contentId,
      contentType: contentType,
      rowId,
      sortOrder,
    });

    if (!result) {
      redirect(buildFlashUrl("error", "Unable to add row item."));
    }

    if ("missing" in result) {
      redirect(buildFlashUrl("error", "Row not found."));
    }

    if ("missingContent" in result) {
      redirect(buildFlashUrl("error", "Content not found."));
    }

    if ("duplicate" in result) {
      redirect(buildFlashUrl("error", "That content is already on this row."));
    }

    revalidatePath(homeListPath);
    revalidatePath("/");
    revalidatePath("/api/v1/catalog");
    redirect(buildFlashUrl("flash", "Home row item added."));
  }

  async function updateHomeRowItemAction(formData: FormData) {
    "use server";

    const guard = await requireCmsAdmin(homeListPath);
    if (guard.status !== "authorized") {
      redirect(buildFlashUrl("error", "Not authorized."));
    }

    const itemId = String(formData.get("itemId") ?? "").trim();
    const sortOrder = Number(formData.get("sortOrder"));

    if (!itemId) {
      redirect(buildFlashUrl("error", "Item ID is required."));
    }

    if (!Number.isInteger(sortOrder)) {
      redirect(buildFlashUrl("error", "Item sort order must be a whole number."));
    }

    const result = await updateHomeRowItem(itemId, sortOrder);
    if (!result) {
      redirect(buildFlashUrl("error", "Unable to update item order."));
    }

    revalidatePath(homeListPath);
    revalidatePath("/");
    revalidatePath("/api/v1/catalog");
    redirect(buildFlashUrl("flash", "Home row item saved."));
  }

  async function removeHomeRowItemAction(formData: FormData) {
    "use server";

    const guard = await requireCmsAdmin(homeListPath);
    if (guard.status !== "authorized") {
      redirect(buildFlashUrl("error", "Not authorized."));
    }

    const itemId = String(formData.get("itemId") ?? "").trim();
    if (!itemId) {
      redirect(buildFlashUrl("error", "Item ID is required."));
    }

    const success = await removeHomeRowItem(itemId);
    if (!success) {
      redirect(buildFlashUrl("error", "Unable to remove item."));
    }

    revalidatePath(homeListPath);
    revalidatePath("/");
    revalidatePath("/api/v1/catalog");
    redirect(buildFlashUrl("flash", "Home row item removed."));
  }

  return (
    <main className="min-h-screen bg-deep px-4 py-10 text-bone">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/60">
            0nya CMS
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Home</h1>
          <Link href="/admin" className="mt-1 inline-block text-sm text-teal">
            ← Back to admin
          </Link>
        </div>

        {flashMessage && (
          <div className="border border-teal/30 bg-teal/10 px-4 py-3 text-sm text-teal">
            {flashMessage}
          </div>
        )}
        {errorMessage && (
          <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="border border-bone/10 bg-bone/[0.03] p-4">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/50">
              Featured series
            </p>
            <p className="mt-2 text-sm text-bone/70">
              {featuredSeries?.slug ? (
                <>
                  Managed in Series CMS: <span className="text-bone">/{featuredSeries.slug}</span>
                </>
              ) : (
                "No featured series detected."
              )}
            </p>
          </div>
          <div className="border border-bone/10 bg-bone/[0.03] p-4">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/50">
              Threshold
            </p>
            <p className="mt-2 text-sm text-bone/70">
              Low-history threshold: <span className="text-bone">{homeData.lowHistoryThreshold ?? "unset"}</span>
            </p>
          </div>
          <div className="border border-bone/10 bg-bone/[0.03] p-4">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/50">
              Rows
            </p>
            <p className="mt-2 text-sm text-bone/70">
              {homeData.homeRows.length} row{homeData.homeRows.length === 1 ? "" : "s"} configured
            </p>
          </div>
        </section>

        <section className="border border-bone/10 bg-bone/[0.03] p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-bone/70">
            Low-history threshold
          </h2>
          <form action={updateHomeSettingsAction} className="mt-3 flex flex-wrap items-end gap-3">
            <label className="block space-y-1.5">
              <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50">
                Completed count threshold
              </span>
              <input
                className="w-40 border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone"
                type="number"
                name="lowHistoryThreshold"
                min={0}
                defaultValue={homeData.lowHistoryThreshold ?? 5}
              />
            </label>
            <Button type="submit" variant="secondary">
              Save threshold
            </Button>
          </form>
        </section>

        <section className="border border-bone/10 bg-bone/[0.03] p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-bone/70">
            Create editorial row
          </h2>
          <form action={createHomeRowAction} className="mt-3 flex flex-wrap items-end gap-3">
            <label className="block space-y-1.5">
              <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50">
                Title
              </span>
              <input
                className="w-56 border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone"
                name="title"
                placeholder="Staff Picks"
                required
              />
            </label>
            <label className="block space-y-1.5">
              <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50">
                Sort order
              </span>
              <input
                className="w-32 border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone"
                type="number"
                name="sortOrder"
                defaultValue={100}
              />
            </label>
            <Button type="submit" variant="secondary">
              Create row
            </Button>
          </form>
        </section>

        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-bone/70">
              Home rows
            </h2>
            <p className="text-xs text-bone/40">Published content is what consumers can actually see.</p>
          </div>

          {homeData.homeRows.length === 0 && (
            <div className="border border-bone/10 bg-bone/[0.03] p-4 text-sm text-bone/60">
              No home rows configured.
            </div>
          )}

          {homeData.homeRows.map((row) => (
            <article key={row.id} className="border border-bone/10 bg-bone/[0.03] p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">{row.title}</h3>
                  <p className="mt-1 text-xs text-bone/50">
                    role: <span className="text-bone">{row.row_role}</span> ·{" "}
                    <span className="text-bone">{row.enabled ? "enabled" : "disabled"}</span> · sort{" "}
                    <span className="text-bone">{row.sort_order}</span>
                  </p>
                </div>
                {row.row_role === "start_here" && (
                  <span className="border border-teal/40 px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-teal">
                    Canonical Start Here
                  </span>
                )}
              </div>

              <form action={updateHomeRowAction} className="mt-4 flex flex-wrap items-end gap-3">
                <input type="hidden" name="rowId" value={row.id} />
                <label className="block space-y-1.5">
                  <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50">
                    Title
                  </span>
                  <input
                    className="w-56 border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone"
                    name="title"
                    defaultValue={row.title}
                    required
                  />
                </label>
                <label className="flex items-center gap-2 pb-2 text-sm text-bone/80">
                  <input
                    type="checkbox"
                    name="enabled"
                    defaultChecked={row.enabled}
                    className="h-4 w-4 border border-bone/20 bg-bone/[0.03]"
                  />
                  Enabled
                </label>
                <label className="block space-y-1.5">
                  <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50">
                    Sort order
                  </span>
                  <input
                    className="w-32 border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone"
                    type="number"
                    name="sortOrder"
                    defaultValue={row.sort_order}
                  />
                </label>
                <Button type="submit" variant="secondary">
                  Save row
                </Button>
              </form>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
                <form action={addHomeRowItemAction} className="space-y-3 border border-bone/10 p-4">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-bone/70">
                    Add content
                  </h4>
                  <input type="hidden" name="rowId" value={row.id} />
                  <label className="block space-y-1.5">
                    <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50">
                      Content
                    </span>
                    <CmsSelect
                      name="contentRef"
                      defaultValue=""
                      className="w-full border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone"
                      placeholderLabel="Choose existing content"
                      options={[
                        { label: "Choose existing content", value: "" },
                        ...seriesChoices.map((choice) => ({
                          group: "Series",
                          label: choice.label,
                          value: choice.value,
                        })),
                        ...shortFilmChoices.map((choice) => ({
                          group: "Short films",
                          label: choice.label,
                          value: choice.value,
                        })),
                      ]}
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50">
                      Sort order
                    </span>
                    <input
                      className="w-32 border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone"
                      type="number"
                      name="sortOrder"
                      defaultValue={100}
                    />
                  </label>
                  <Button type="submit" variant="secondary">
                    Add item
                  </Button>
                </form>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-bone/70">
                    Items
                  </h4>
                  {row.items.length === 0 && (
                    <p className="text-sm text-bone/60">No items in this row yet.</p>
                  )}
                  {row.items.map((item) => (
                    <div key={item.id} className="border border-bone/10 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{item.contentTitle ?? item.slug ?? item.id}</p>
                          <p className="text-xs text-bone/50">
                            {item.content_type} · {item.contentStatus ?? "unknown"}
                            {item.consumerVisible ? " · visible" : " · hidden"}
                          </p>
                        </div>
                        <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-bone/40">
                          {item.sort_order}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-end gap-3">
                        <form action={updateHomeRowItemAction} className="flex items-end gap-3">
                          <input type="hidden" name="itemId" value={item.id} />
                          <label className="block space-y-1.5">
                            <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50">
                              Sort order
                            </span>
                            <input
                              className="w-24 border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone"
                              type="number"
                              name="sortOrder"
                              defaultValue={item.sort_order}
                            />
                          </label>
                          <Button type="submit" variant="secondary">
                            Save
                          </Button>
                        </form>
                        <form action={removeHomeRowItemAction}>
                          <input type="hidden" name="itemId" value={item.id} />
                          <Button type="submit">Remove</Button>
                        </form>
                        <p className="text-xs text-bone/40">
                          {item.sharePath ? (
                            <>
                              Consumer path: <span className="text-bone">{item.sharePath}</span>
                            </>
                          ) : (
                            "Orphaned item"
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
