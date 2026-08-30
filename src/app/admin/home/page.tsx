import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { CmsSelect } from "@/components/cms/CmsSelect";
import { CmsAutoSubmitCheckbox } from "@/components/cms/CmsAutoSubmitCheckbox";
import { requireCmsAdmin } from "@/lib/cms/auth";
import {
  addHomeRowItem,
  addSpotlightItem,
  createHomeEditorialRow,
  deleteHomeEditorialRow,
  getHomeAdminData,
  listHomeContentChoices,
  moveHomeRow,
  moveHomeRowItem,
  moveSpotlightItem,
  removeHomeRowItem,
  removeSpotlightItem,
  toggleHomeSpotlight,
  updateHomeLowHistoryThreshold,
  updateHomeRow,
  updateHomeRowItem,
  updateSpotlightItemShowTitle,
} from "@/lib/cms/home";
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

  const [homeData, allContentChoices, publishedChoices] = await Promise.all([
    getHomeAdminData(),
    listHomeContentChoices(false),
    listHomeContentChoices(true),
  ]);
  const flashMessage = typeof params.flash === "string" ? params.flash : null;
  const errorMessage = typeof params.error === "string" ? params.error : null;

  const seriesChoices = allContentChoices.filter((choice) => choice.contentType === "series");
  const shortFilmChoices = allContentChoices.filter((choice) => choice.contentType === "short_film");

  const publishedSeriesChoices = publishedChoices.filter((choice) => choice.contentType === "series");
  const publishedShortFilmChoices = publishedChoices.filter((choice) => choice.contentType === "short_film");

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

  async function addSpotlightItemAction(formData: FormData) {
    "use server";

    const guard = await requireCmsAdmin(homeListPath);
    if (guard.status !== "authorized") {
      redirect(buildFlashUrl("error", "Not authorized."));
    }

    const contentRef = String(formData.get("contentRef") ?? "").trim();
    if (!contentRef) {
      redirect(buildFlashUrl("error", "Please select published content for Spotlight."));
    }

    const [contentType, contentId] = contentRef.split(":", 2);
    if (!contentId || (contentType !== "series" && contentType !== "short_film")) {
      redirect(buildFlashUrl("error", "Invalid content selection."));
    }

    const result = await addSpotlightItem({
      contentId,
      contentType: contentType as "series" | "short_film",
    });

    if (!result || "error" in result) {
      redirect(buildFlashUrl("error", "Unable to add Spotlight item."));
    }

    if ("invalidContent" in result) {
      redirect(buildFlashUrl("error", "Selected content is not published."));
    }

    if ("duplicate" in result) {
      redirect(buildFlashUrl("error", "That content is already in Spotlight."));
    }

    revalidatePath(homeListPath);
    revalidatePath("/");
    revalidatePath("/api/v1/catalog");
    redirect(buildFlashUrl("flash", "Spotlight item added."));
  }

  async function removeSpotlightItemAction(formData: FormData) {
    "use server";

    const guard = await requireCmsAdmin(homeListPath);
    if (guard.status !== "authorized") {
      redirect(buildFlashUrl("error", "Not authorized."));
    }

    const itemId = String(formData.get("itemId") ?? "").trim();
    if (!itemId) {
      redirect(buildFlashUrl("error", "Item ID is required."));
    }

    const success = await removeSpotlightItem(itemId);
    if (!success) {
      redirect(buildFlashUrl("error", "Unable to remove Spotlight item."));
    }

    revalidatePath(homeListPath);
    revalidatePath("/");
    revalidatePath("/api/v1/catalog");
    redirect(buildFlashUrl("flash", "Spotlight item removed."));
  }

  async function moveSpotlightItemAction(formData: FormData) {
    "use server";

    const guard = await requireCmsAdmin(homeListPath);
    if (guard.status !== "authorized") {
      redirect(buildFlashUrl("error", "Not authorized."));
    }

    const itemId = String(formData.get("itemId") ?? "").trim();
    const direction = formData.get("direction") === "up" ? "up" : "down";

    if (!itemId) {
      redirect(buildFlashUrl("error", "Item ID is required."));
    }

    await moveSpotlightItem(itemId, direction);
    revalidatePath(homeListPath);
    revalidatePath("/");
    revalidatePath("/api/v1/catalog");
    redirect(buildFlashUrl("flash", "Spotlight order updated."));
  }

  async function toggleSpotlightShowTitleAction(formData: FormData) {
    "use server";

    const guard = await requireCmsAdmin(homeListPath);
    if (guard.status !== "authorized") {
      redirect(buildFlashUrl("error", "Not authorized."));
    }

    const itemId = String(formData.get("itemId") ?? "").trim();
    const showTitle = formData.get("showTitle") === "on";

    if (!itemId) {
      redirect(buildFlashUrl("error", "Item ID is required."));
    }

    const result = await updateSpotlightItemShowTitle(itemId, showTitle);
    if (!result) {
      redirect(buildFlashUrl("error", "Unable to update title visibility."));
    }

    revalidatePath(homeListPath);
    revalidatePath("/");
    revalidatePath("/api/v1/catalog");
    redirect(buildFlashUrl("flash", "Title visibility updated."));
  }

  async function toggleSpotlightAction(formData: FormData) {
    "use server";

    const guard = await requireCmsAdmin(homeListPath);
    if (guard.status !== "authorized") {
      redirect(buildFlashUrl("error", "Not authorized."));
    }

    const enabled = formData.get("enabled") === "on";
    await toggleHomeSpotlight(enabled);

    revalidatePath(homeListPath);
    revalidatePath("/");
    revalidatePath("/api/v1/catalog");
    redirect(buildFlashUrl("flash", enabled ? "Spotlight enabled." : "Spotlight disabled."));
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
    revalidatePath("/");
    revalidatePath("/api/v1/catalog");
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

  async function deleteHomeRowAction(formData: FormData) {
    "use server";

    const guard = await requireCmsAdmin(homeListPath);
    if (guard.status !== "authorized") {
      redirect(buildFlashUrl("error", "Not authorized."));
    }

    const rowId = String(formData.get("rowId") ?? "").trim();
    if (!rowId) {
      redirect(buildFlashUrl("error", "Row ID is required."));
    }

    const success = await deleteHomeEditorialRow(rowId);
    if (!success) {
      redirect(buildFlashUrl("error", "Unable to delete row (Start Here and Spotlight cannot be deleted)."));
    }

    revalidatePath(homeListPath);
    revalidatePath("/");
    revalidatePath("/api/v1/catalog");
    redirect(buildFlashUrl("flash", "Home row deleted."));
  }

  async function moveRowAction(formData: FormData) {
    "use server";

    const guard = await requireCmsAdmin(homeListPath);
    if (guard.status !== "authorized") {
      redirect(buildFlashUrl("error", "Not authorized."));
    }

    const rowId = String(formData.get("rowId") ?? "").trim();
    const direction = formData.get("direction") === "up" ? "up" : "down";

    if (!rowId) {
      redirect(buildFlashUrl("error", "Row ID is required."));
    }

    await moveHomeRow(rowId, direction);
    revalidatePath(homeListPath);
    revalidatePath("/");
    revalidatePath("/api/v1/catalog");
    redirect(buildFlashUrl("flash", "Row order updated."));
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

  async function moveItemAction(formData: FormData) {
    "use server";

    const guard = await requireCmsAdmin(homeListPath);
    if (guard.status !== "authorized") {
      redirect(buildFlashUrl("error", "Not authorized."));
    }

    const itemId = String(formData.get("itemId") ?? "").trim();
    const direction = formData.get("direction") === "up" ? "up" : "down";

    if (!itemId) {
      redirect(buildFlashUrl("error", "Item ID is required."));
    }

    await moveHomeRowItem(itemId, direction);
    revalidatePath(homeListPath);
    revalidatePath("/");
    revalidatePath("/api/v1/catalog");
    redirect(buildFlashUrl("flash", "Item order updated."));
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

  const spotlightItems = homeData.spotlight?.items ?? [];
  const isSpotlightEnabled = homeData.spotlight?.enabled ?? true;

  return (
    <main className="min-h-screen bg-deep px-4 py-10 text-bone">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/60">
            0nya CMS
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Home Composer</h1>
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

        {/* SPOTLIGHT SECTION */}
        <section className="border border-teal/30 bg-teal/[0.03] p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-teal">
                Authoritative Spotlight (9:16)
              </p>
              <h2 className="mt-1 text-lg font-semibold">Home Spotlight Stage</h2>
              <p className="mt-1 text-xs text-bone/60">
                Ordered CMS-controlled stage. One or more published Series / Short Films, manually swiped in Android.
              </p>
            </div>
            {homeData.spotlight ? (
              <span className={`border px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-[0.14em] ${
                isSpotlightEnabled ? "border-teal/50 text-teal" : "border-bone/30 text-bone/50"
              }`}>
                {isSpotlightEnabled
                  ? `Spotlight Active · ${spotlightItems.length} item${spotlightItems.length === 1 ? "" : "s"}`
                  : "Spotlight Disabled"}
              </span>
            ) : (
              <span className="border border-bone/20 px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-bone/40">
                No Spotlight Row
              </span>
            )}
          </div>

          {homeData.spotlight && (
            <form action={toggleSpotlightAction} className="mt-4 flex items-center gap-2">
              <CmsAutoSubmitCheckbox
                name="enabled"
                defaultChecked={isSpotlightEnabled}
                inputClassName="h-4 w-4 border border-bone/20 bg-bone/[0.03]"
                labelClassName="flex items-center gap-2 text-xs text-bone/70"
              >
                Spotlight enabled (controls whether stage is shown to consumers)
              </CmsAutoSubmitCheckbox>
            </form>
          )}

          {/* Spotlight items (ordered) */}
          <div className="mt-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-bone/70">
              Spotlight Items ({spotlightItems.length}) · ordered
            </h3>
            {spotlightItems.length === 0 && (
              <p className="text-sm text-bone/60">
                No Spotlight items yet. Add published content below.
              </p>
            )}
            {spotlightItems.map((item, itemIndex) => (
              <div key={item.id} className="border border-bone/10 bg-bone/[0.03] p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-teal">
                      #{itemIndex + 1} · {item.content_type}
                    </span>
                    <p className="mt-1 text-base font-semibold text-bone">
                      {item.contentTitle ?? item.slug ?? item.id}
                    </p>
                    <p className="mt-0.5 text-xs text-bone/50">
                      Status: <span className={item.consumerVisible ? "text-teal" : "text-amber-400"}>
                        {item.contentStatus ?? "unknown"}
                        {item.consumerVisible ? " (Published)" : " (Hidden)"}
                      </span>
                      {item.sharePath && (
                        <> · Path: <span className="text-bone/70">{item.sharePath}</span></>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <form action={moveSpotlightItemAction} className="flex">
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button
                        type="submit"
                        disabled={itemIndex === 0}
                        className="border border-bone/20 px-1.5 py-0.5 text-xs text-bone/60 hover:bg-bone/10 disabled:opacity-30 disabled:pointer-events-none"
                      >
                        ▲
                      </button>
                    </form>
                    <form action={moveSpotlightItemAction} className="flex">
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button
                        type="submit"
                        disabled={itemIndex === spotlightItems.length - 1}
                        className="border border-bone/20 px-1.5 py-0.5 text-xs text-bone/60 hover:bg-bone/10 disabled:opacity-30 disabled:pointer-events-none"
                      >
                        ▼
                      </button>
                    </form>
                    <form action={removeSpotlightItemAction}>
                      <input type="hidden" name="itemId" value={item.id} />
                      <Button type="submit">Remove</Button>
                    </form>
                  </div>
                </div>

                <form action={toggleSpotlightShowTitleAction} className="mt-3 flex items-center gap-2">
                  <input type="hidden" name="itemId" value={item.id} />
                  <CmsAutoSubmitCheckbox
                    name="showTitle"
                    defaultChecked={item.show_title}
                    inputClassName="h-4 w-4 border border-bone/20 bg-bone/[0.03]"
                    labelClassName="flex items-center gap-2 text-xs text-bone/70"
                  >
                    Show title below artwork
                  </CmsAutoSubmitCheckbox>
                </form>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-bone/10">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-bone/70">
              Add Spotlight Content
            </h3>
            <form action={addSpotlightItemAction} className="mt-3 flex flex-wrap items-end gap-3">
              <label className="block space-y-1.5 min-w-[280px] flex-1">
                <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50">
                  Published Content
                </span>
                <CmsSelect
                  name="contentRef"
                  defaultValue=""
                  className="w-full border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone"
                  placeholderLabel="Choose published series or short film"
                  options={[
                    { label: "Choose published series or short film", value: "" },
                    ...publishedSeriesChoices.map((choice) => ({
                      group: "Published Series",
                      label: choice.label,
                      value: choice.value,
                    })),
                    ...publishedShortFilmChoices.map((choice) => ({
                      group: "Published Short films",
                      label: choice.label,
                      value: choice.value,
                    })),
                  ]}
                />
              </label>
              <Button type="submit" variant="secondary">
                Add to Spotlight
              </Button>
            </form>
          </div>
        </section>

        {/* OVERVIEW METRICS */}
        <section className="grid gap-4 sm:grid-cols-2">
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
              Editorial Rows
            </p>
            <p className="mt-2 text-sm text-bone/70">
              {homeData.homeRows.length} editorial row{homeData.homeRows.length === 1 ? "" : "s"} configured
            </p>
          </div>
        </section>

        {/* LOW-HISTORY THRESHOLD */}
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

        {/* CREATE EDITORIAL ROW */}
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
                placeholder="e.g. Micro Dramas, Staff Picks"
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

        {/* HOME ROWS LIST */}
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-bone/70">
              Home Rows (Ordered)
            </h2>
            <p className="text-xs text-bone/40">Only published items within enabled rows are consumer-visible.</p>
          </div>

          {homeData.homeRows.length === 0 && (
            <div className="border border-bone/10 bg-bone/[0.03] p-4 text-sm text-bone/60">
              No home rows configured.
            </div>
          )}

          {homeData.homeRows.map((row, rowIndex) => (
            <article key={row.id} className="border border-bone/10 bg-bone/[0.03] p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">{row.title}</h3>
                  <p className="mt-1 text-xs text-bone/50">
                    role: <span className="text-bone">{row.row_role}</span> ·{" "}
                    <span className="text-bone">{row.enabled ? "enabled" : "disabled"}</span> · sort{" "}
                    <span className="text-bone">{row.sort_order}</span> · items:{" "}
                    <span className="text-bone">{row.items.length}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {row.row_role === "start_here" && (
                    <span className="border border-teal/40 px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-teal">
                      Canonical Start Here
                    </span>
                  )}
                  <form action={moveRowAction} className="flex gap-1">
                    <input type="hidden" name="rowId" value={row.id} />
                    <input type="hidden" name="direction" value="up" />
                    <button
                      type="submit"
                      disabled={rowIndex === 0}
                      className="border border-bone/20 px-2 py-0.5 text-xs text-bone/70 hover:bg-bone/10 disabled:opacity-30 disabled:pointer-events-none"
                    >
                      ▲ Up
                    </button>
                  </form>
                  <form action={moveRowAction} className="flex gap-1">
                    <input type="hidden" name="rowId" value={row.id} />
                    <input type="hidden" name="direction" value="down" />
                    <button
                      type="submit"
                      disabled={rowIndex === homeData.homeRows.length - 1}
                      className="border border-bone/20 px-2 py-0.5 text-xs text-bone/70 hover:bg-bone/10 disabled:opacity-30 disabled:pointer-events-none"
                    >
                      ▼ Down
                    </button>
                  </form>
                  {row.row_role === "editorial" && (
                    <form action={deleteHomeRowAction}>
                      <input type="hidden" name="rowId" value={row.id} />
                      <Button type="submit">Delete row</Button>
                    </form>
                  )}
                </div>
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

              <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.3fr]">
                {/* ADD ITEM TO ROW */}
                <form action={addHomeRowItemAction} className="space-y-3 border border-bone/10 p-4">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-bone/70">
                    Add content to row
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
                      placeholderLabel="Choose content (Series or Short Film)"
                      options={[
                        { label: "Choose content (Series or Short Film)", value: "" },
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

                {/* ROW ITEMS LIST */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-bone/70">
                    Row Items ({row.items.length})
                  </h4>
                  {row.items.length === 0 && (
                    <p className="text-sm text-bone/60">No items in this row yet.</p>
                  )}
                  {row.items.map((item, itemIndex) => (
                    <div key={item.id} className="border border-bone/10 p-3 bg-bone/[0.02]">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{item.contentTitle ?? item.slug ?? item.id}</p>
                          <p className="text-xs text-bone/50">
                            {item.content_type} · {item.contentStatus ?? "unknown"}
                            {item.consumerVisible ? " · visible" : " · hidden"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <form action={moveItemAction} className="flex">
                            <input type="hidden" name="itemId" value={item.id} />
                            <input type="hidden" name="direction" value="up" />
                            <button
                              type="submit"
                              disabled={itemIndex === 0}
                              className="border border-bone/20 px-1.5 py-0.5 text-xs text-bone/60 hover:bg-bone/10 disabled:opacity-30 disabled:pointer-events-none"
                            >
                              ▲
                            </button>
                          </form>
                          <form action={moveItemAction} className="flex">
                            <input type="hidden" name="itemId" value={item.id} />
                            <input type="hidden" name="direction" value="down" />
                            <button
                              type="submit"
                              disabled={itemIndex === row.items.length - 1}
                              className="border border-bone/20 px-1.5 py-0.5 text-xs text-bone/60 hover:bg-bone/10 disabled:opacity-30 disabled:pointer-events-none"
                            >
                              ▼
                            </button>
                          </form>
                          <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-bone/40 pl-1">
                            sort: {item.sort_order}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-end gap-3">
                        <form action={updateHomeRowItemAction} className="flex items-end gap-2">
                          <input type="hidden" name="itemId" value={item.id} />
                          <label className="block space-y-1">
                            <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-bone/40">
                              Sort
                            </span>
                            <input
                              className="w-20 border border-bone/15 bg-bone/[0.03] px-2 py-1.5 text-xs text-bone"
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
                        <p className="text-xs text-bone/40 self-center ml-auto">
                          {item.sharePath ? (
                            <>
                              Path: <span className="text-bone/70">{item.sharePath}</span>
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
