/**
 * Home Composer data layer (server actions).
 *
 * These server actions provide the data authority for the Home Composer UI.
 * They read from and write to the Supabase `series` table, preserving
 * existing catalog publication/catalog rules (status, sort_order, featured).
 *
 * Home business rules (NOT changed by C08B-06):
 *  - Spotlight = the series with `featured = true` and lowest `sort_order`
 *    among published series.
 *  - Home rows = editorial groupings of published series by sort_order.
 *  - Row IDs/types are assigned by the system and must not change.
 *  - The system maintains automatic ordering; operators may override
 *    `sort_order` and `visible` state per row.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ContentItem } from "@/data/content";
import type {
  HomeRow,
  HomeRowFormState,
  SpotlightConfig,
  SpotlightFormState,
  RowWarning,
} from "./types";
import {
  buildHomeRows,
  buildSpotlightConfig,
  findSeriesBySlug,
  mapSeriesRow,
  sortSeriesByHomeOrder,
  computeRowWarnings,
} from "./mapping";

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

/**
 * Loads all published series and builds the Home Composer data structure.
 * Returns rows in their committed (saved) state with isDirty=false.
 */
export async function getHomeComposerData(): Promise<{
  rows: HomeRow[];
  spotlight: SpotlightConfig;
  catalog: ContentItem[];
}> {
  const supabase = await createClient();

  const { data: seriesRows, error } = await supabase
    .from("series")
    .select("*")
    .eq("status", "published")
    .order("sort_order", { ascending: true });

  if (error || !seriesRows) {
    console.warn("Unable to load home rows for composer.");
    return { rows: [], spotlight: buildSpotlightConfig([]), catalog: [] };
  }

  const catalog = seriesRows.map(mapSeriesRow);
  const rows = buildHomeRows(catalog);
  const spotlight = buildSpotlightConfig(catalog);

  return { rows, spotlight, catalog };
}

/**
 * Loads full row data with resolved content items and warnings.
 * Used by the page to render collapsed summaries + expanded editors.
 */
export async function getHomeRowsWithContent(): Promise<Array<{
  row: HomeRow;
  items: ContentItem[];
  warnings: RowWarning[];
}>> {
  const { rows, catalog } = await getHomeComposerData();

  return rows.map((row) => {
    const items = row.assignedSlugs
      .map((slug) => findSeriesBySlug(catalog, slug))
      .filter(Boolean) as ContentItem[];

    const warnings: RowWarning[] = computeRowWarnings(row, items, catalog);

    return { row, items, warnings };
  });
}

// ---------------------------------------------------------------------------
// Write operations (row-level)
// ---------------------------------------------------------------------------

/**
 * Updates the `sort_order` of one or more rows.
 * This is the operator-controlled ordering override — it does NOT
 * change the automatic ordering rules of the catalogue, only the
 * Home display order which is itself a `sort_order` field.
 */
export async function updateRowOrder(
  orderedRowIds: string[],
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient();

  try {
    const updates = orderedRowIds.map((id, index) => ({
      id,
      sort_order: index * 10 + 10,
    }));

    const { error } = await supabase
      .from("home_row_order")
      .upsert(updates, { onConflict: "id" });

    if (error) {
      console.warn("Unable to update home row order.");
      throw error;
    }

    revalidatePath("/admin/home");
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update row order.",
    };
  }
}

/**
 * Toggles the visibility (published state) of a Home row.
 *
 * IMPORTANT: This updates a Home-specific `visible` flag, NOT the series
 * `status` field. Publication/catalog rules are untouched.
 */
export async function toggleRowVisibility(
  rowId: string,
  visible: boolean,
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient();

  try {
    const { error } = await supabase
      .from("home_row_order")
      .update({ visible })
      .eq("id", rowId);

    if (error) {
      console.warn("Unable to toggle row visibility.");
      throw error;
    }

    revalidatePath("/admin/home");
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update row visibility.",
    };
  }
}

/**
 * Deletes (removes from Home) a row. Does NOT delete the underlying series.
 */
export async function deleteHomeRow(
  rowId: string,
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient();

  try {
    const { error } = await supabase.from("home_row_order").delete().eq("id", rowId);

    if (error) {
      console.warn("Unable to delete home row.");
      throw error;
    }

    revalidatePath("/admin/home");
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete row.",
    };
  }
}

/**
 * Saves a row's configuration: title, kicker, visibility, and assigned titles.
 *
 * C08B-01: The caller is responsible for ensuring the row is dirty before
 * calling this. If the form state matches the committed row, this is a no-op.
 */
export async function saveHomeRow(
  rowId: string,
  formState: HomeRowFormState,
): Promise<{ success: boolean; error: string | null; row: HomeRow | null }> {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("home_row_order")
      .update({
        title: formState.title,
        kicker: formState.kicker || null,
        visible: formState.visible,
        assigned_slugs: formState.assignedSlugs,
        updated_at: new Date().toISOString(),
      })
      .eq("id", rowId)
      .select("*")
      .single();

    if (error) {
      console.warn("Unable to save home row.");
      throw error;
    }

    revalidatePath("/admin/home");

    const savedRow: HomeRow = {
      id: data.id,
      title: data.title,
      type: data.type as HomeRow["type"],
      sortOrder: data.sort_order,
      visible: data.visible,
      assignedSlugs: data.assigned_slugs ?? [],
      kicker: data.kicker,
    };

    return { success: true, error: null, row: savedRow };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save row.",
      row: null,
    };
  }
}

// ---------------------------------------------------------------------------
// Spotlight
// ---------------------------------------------------------------------------

/**
 * Saves the Spotlight configuration.
 * Preserves all current controls while keeping Spotlight visually distinct
 * from ordinary Home rows.
 */
export async function saveSpotlight(
  formState: SpotlightFormState,
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient();

  try {
    const result = await supabase.rpc("set_home_spotlight", {
      p_featured_slug: formState.featuredSlug,
      p_enabled: formState.enabled,
      p_badge: formState.badge || null,
      p_headline: formState.headline || null,
    });

    if (result.error) {
      console.warn("Unable to save spotlight config.");
      throw result.error;
    }

    revalidatePath("/admin/home");
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save spotlight.",
    };
  }
}

// Re-export for convenience
export { sortSeriesByHomeOrder };
