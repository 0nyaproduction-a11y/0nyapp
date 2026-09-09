/**
 * CMS-C08B-06: Home Composer — Admin page.
 *
 * PAGE
 * → SPOTLIGHT (SpotlightComposer — visually distinct, separate hierarchy)
 * → ROWS (collapsible list with one-row focus)
 *   → ROW (RowHeader + HomeRowEditor)
 *     → ITEMS / CONFIG / ACTIONS
 *
 * C08B-05: Breadcrumb remains "Admin → Home".
 */

import { HomeComposer } from "@/components/admin/home/HomeComposer";
import { getHomeComposerData } from "@/lib/home/actions";
import { findSeriesBySlug, computeRowWarnings } from "@/lib/home/mapping";
import type { HomeRowWithContent, HomeComposerData, RowWarning } from "@/lib/home/types";

export default async function AdminHomePage() {
  let data: HomeComposerData | null = null;
  let error: string | null = null;

  try {
    const raw = await getHomeComposerData();

    // Enrich rows with resolved content items and warnings.
    const enrichedRows: HomeRowWithContent[] = raw.rows.map((row) => {
      const items = row.assignedSlugs
        .map((slug) => findSeriesBySlug(raw.catalog, slug))
        .filter(Boolean) as HomeRowWithContent["items"];

      const warnings: RowWarning[] = computeRowWarnings(row, items, raw.catalog);

      return {
        ...row,
        items,
        warnings,
        isDirty: false,
      };
    });

    const spotlightWarnings: RowWarning[] = [];

    if (!raw.spotlight.featuredSlug) {
      spotlightWarnings.push({
        code: "empty",
        label: "No featured title selected.",
      });
    } else if (!findSeriesBySlug(raw.catalog, raw.spotlight.featuredSlug)) {
      spotlightWarnings.push({
        code: "unpublished_assigned",
        label: "Featured title is not published.",
        count: 1,
      });
    }

    data = {
      rows: enrichedRows,
      spotlight: {
        ...raw.spotlight,
        warnings: spotlightWarnings,
      },
      catalog: raw.catalog,
    };
  } catch (err) {
    error =
      err instanceof Error ? err.message : "Failed to load Home Composer data.";
  }

  return (
    <main className="min-h-screen bg-background text-bone">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <HomeComposer data={data} error={error} onRetry={() => {}} />
      </div>
    </main>
  );
}
