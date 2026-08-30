import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

export type HomeSettingsRow = Database["public"]["Tables"]["home_settings"]["Row"];
export type HomeRowRow = Database["public"]["Tables"]["home_rows"]["Row"];
export type HomeRowItemRow = Database["public"]["Tables"]["home_row_items"]["Row"];
export type HomeContentType = HomeRowItemRow["content_type"];

export type HomeItemAdminRecord = HomeRowItemRow & {
  contentStatus: string | null;
  contentTitle: string | null;
  consumerVisible: boolean;
  sharePath: string;
  slug: string | null;
};

export type HomeRowAdminRecord = HomeRowRow & {
  items: HomeItemAdminRecord[];
};

export type HomeAdminData = {
  featuredSeriesSlug: string | null;
  homeRows: HomeRowAdminRecord[];
  lowHistoryThreshold: number | null;
  spotlight: {
    enabled: boolean;
    row: HomeRowRow | null;
    items: HomeItemAdminRecord[];
  } | null;
};

export type HomeContentChoice = {
  contentType: HomeContentType;
  consumerVisible: boolean;
  id: string;
  label: string;
  slug: string;
  status: string;
  title: string;
  value: string;
};

function getAdminClient() {
  return createAdminClient();
}

function getLowHistoryThreshold(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return Number.isInteger(value) ? value : Math.floor(value);
}

function isPublishedShortFilm(row: Pick<Database["public"]["Tables"]["short_films"]["Row"], "status" | "publish_at">) {
  return row.status === "published" && (!row.publish_at || new Date(row.publish_at).getTime() <= Date.now());
}

export async function getHomeAdminData(): Promise<HomeAdminData> {
  const supabase = getAdminClient();

  const [{ data: settingsRow }, { data: rows }, { data: featuredSeries }] = await Promise.all([
    supabase.from("home_settings").select("value").eq("key", "low_history_threshold").maybeSingle(),
    supabase.from("home_rows").select("*").order("sort_order", { ascending: true }),
    supabase
      .from("series")
      .select("slug")
      .eq("featured", true)
      .eq("status", "published")
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const allRows = rows ?? [];
  const rowIds = allRows.map((row) => row.id);
  const { data: items } = rowIds.length
    ? await supabase
        .from("home_row_items")
        .select("*")
        .in("row_id", rowIds)
        .order("sort_order", { ascending: true })
    : { data: [] as HomeRowItemRow[] };

  const seriesIds = (items ?? [])
    .filter((item) => item.content_type === "series" && item.series_id)
    .map((item) => item.series_id as string);
  const shortFilmIds = (items ?? [])
    .filter((item) => item.content_type === "short_film" && item.short_film_id)
    .map((item) => item.short_film_id as string);

  const [seriesRows, shortFilmRows] = await Promise.all([
    seriesIds.length
      ? supabase.from("series").select("*").in("id", seriesIds)
      : Promise.resolve({ data: [] as Database["public"]["Tables"]["series"]["Row"][] }),
    shortFilmIds.length
      ? supabase.from("short_films").select("*").in("id", shortFilmIds)
      : Promise.resolve({ data: [] as Database["public"]["Tables"]["short_films"]["Row"][] }),
  ]);

  const seriesById = new Map((seriesRows.data ?? []).map((series) => [series.id, series]));
  const shortFilmById = new Map((shortFilmRows.data ?? []).map((shortFilm) => [shortFilm.id, shortFilm]));
  const itemsByRow = new Map<string, HomeItemAdminRecord[]>();

  for (const item of items ?? []) {
    const current = itemsByRow.get(item.row_id) ?? [];

    if (item.content_type === "series") {
      const series = item.series_id ? seriesById.get(item.series_id) : null;
      current.push({
        ...item,
        contentStatus: series?.status ?? null,
        contentTitle: series?.title ?? null,
        consumerVisible: Boolean(series && series.status === "published"),
        sharePath: series ? `/series/${series.slug}` : "",
        slug: series?.slug ?? null,
      });
    } else {
      const shortFilm = item.short_film_id ? shortFilmById.get(item.short_film_id) : null;
      current.push({
        ...item,
        contentStatus: shortFilm?.status ?? null,
        contentTitle: shortFilm?.title ?? null,
        consumerVisible: Boolean(shortFilm && isPublishedShortFilm(shortFilm)),
        sharePath: shortFilm ? `/short-films/${shortFilm.slug}` : "",
        slug: shortFilm?.slug ?? null,
      });
    }

    itemsByRow.set(item.row_id, current);
  }

  // Resolve Spotlight collection (ordered by sort_order ASC)
  const spotlightRow = allRows.find((r) => r.row_role === "spotlight") ?? null;
  const spotlightItems = spotlightRow ? (itemsByRow.get(spotlightRow.id) ?? []) : [];

  const editorialAndStartHereRows = allRows
    .filter((r) => r.row_role !== "spotlight")
    .map((row) => ({
      ...row,
      items: itemsByRow.get(row.id) ?? [],
    }));

  return {
    featuredSeriesSlug: featuredSeries?.slug ?? null,
    homeRows: editorialAndStartHereRows,
    lowHistoryThreshold: getLowHistoryThreshold(settingsRow?.value ?? null),
    spotlight: spotlightRow
      ? {
          enabled: spotlightRow.enabled,
          row: spotlightRow,
          items: spotlightItems,
        }
      : null,
  };
}

export async function listHomeContentChoices(publishedOnly?: boolean): Promise<HomeContentChoice[]> {
  const supabase = getAdminClient();

  let seriesQuery = supabase.from("series").select("id,slug,title,status,featured");
  let shortFilmsQuery = supabase.from("short_films").select("id,slug,title,status,publish_at");

  if (publishedOnly) {
    seriesQuery = seriesQuery.eq("status", "published");
    shortFilmsQuery = shortFilmsQuery.eq("status", "published");
  }

  const [seriesRows, shortFilmRows] = await Promise.all([
    seriesQuery.order("updated_at", { ascending: false }),
    shortFilmsQuery.order("updated_at", { ascending: false }),
  ]);

  const seriesChoices = (seriesRows.data ?? []).map((series) => ({
    contentType: "series" as const,
    consumerVisible: series.status === "published",
    id: series.id,
    label: `${series.title} · series · ${series.status}${series.featured ? " · featured" : ""}`,
    slug: series.slug,
    status: series.status,
    title: series.title,
    value: `series:${series.id}`,
  }));

  const shortFilmChoices = (shortFilmRows.data ?? [])
    .filter((shortFilm) => !publishedOnly || isPublishedShortFilm(shortFilm))
    .map((shortFilm) => ({
      contentType: "short_film" as const,
      consumerVisible: isPublishedShortFilm(shortFilm),
      id: shortFilm.id,
      label: `${shortFilm.title} · short film · ${shortFilm.status}${
        shortFilm.publish_at && new Date(shortFilm.publish_at).getTime() > Date.now() ? " · scheduled" : ""
      }`,
      slug: shortFilm.slug,
      status: shortFilm.status,
      title: shortFilm.title,
      value: `short_film:${shortFilm.id}`,
    }));

  return [...seriesChoices, ...shortFilmChoices];
}

async function getOrCreateSpotlightRow() {
  const supabase = getAdminClient();
  let { data: spotlightRow } = await supabase
    .from("home_rows")
    .select("*")
    .eq("row_role", "spotlight")
    .maybeSingle();

  if (!spotlightRow) {
    const { data: created, error: createError } = await supabase
      .from("home_rows")
      .insert({
        enabled: true,
        row_role: "spotlight",
        sort_order: 0,
        title: "Spotlight",
      })
      .select("*")
      .maybeSingle();

    if (createError || !created) {
      return { error: true as const };
    }
    spotlightRow = created;
  }

  return { spotlightRow };
}

export async function addSpotlightItem(input: {
  contentId: string;
  contentType: HomeContentType;
}) {
  const supabase = getAdminClient();

  // Validate published status (Spotlight only allows published canonical content)
  if (input.contentType === "series") {
    const { data: series } = await supabase
      .from("series")
      .select("id,status")
      .eq("id", input.contentId)
      .maybeSingle();

    if (!series || series.status !== "published") {
      return { invalidContent: true as const };
    }
  } else {
    const { data: shortFilm } = await supabase
      .from("short_films")
      .select("id,status,publish_at")
      .eq("id", input.contentId)
      .maybeSingle();

    if (!shortFilm || !isPublishedShortFilm(shortFilm)) {
      return { invalidContent: true as const };
    }
  }

  const rowResult = await getOrCreateSpotlightRow();
  if ("error" in rowResult) {
    return { error: true as const };
  }
  const spotlightRow = rowResult.spotlightRow;

  // Compute next sort order so new items are appended to the end
  const { data: existingItems } = await supabase
    .from("home_row_items")
    .select("sort_order")
    .eq("row_id", spotlightRow.id)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextSortOrder = (existingItems?.[0]?.sort_order ?? -1) + 1;

  const result = await addHomeRowItem({
    contentId: input.contentId,
    contentType: input.contentType,
    rowId: spotlightRow.id,
    sortOrder: nextSortOrder,
  });

  if (!result) {
    return { error: true as const };
  }

  if ("missing" in result || "missingContent" in result) {
    return { error: true as const };
  }

  if ("duplicate" in result) {
    return { duplicate: true as const };
  }

  return { item: result };
}

export async function removeSpotlightItem(id: string) {
  return removeHomeRowItem(id);
}

export async function moveSpotlightItem(id: string, direction: "up" | "down") {
  return moveHomeRowItem(id, direction);
}

export async function updateSpotlightItemShowTitle(id: string, showTitle: boolean) {
  const supabase = getAdminClient();
  const { data: existing } = await supabase.from("home_row_items").select("id").eq("id", id).maybeSingle();

  if (!existing) {
    return null;
  }

  const { data, error } = await supabase
    .from("home_row_items")
    .update({ show_title: showTitle })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function toggleHomeSpotlight(enabled: boolean) {
  const supabase = getAdminClient();
  const { data: spotlightRow } = await supabase
    .from("home_rows")
    .select("id")
    .eq("row_role", "spotlight")
    .maybeSingle();

  if (!spotlightRow) {
    const { data: created } = await supabase
      .from("home_rows")
      .insert({
        enabled,
        row_role: "spotlight",
        sort_order: 0,
        title: "Spotlight",
      })
      .select("*")
      .maybeSingle();
    return created;
  }

  const { data, error } = await supabase
    .from("home_rows")
    .update({ enabled })
    .eq("id", spotlightRow.id)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function updateHomeLowHistoryThreshold(value: number) {
  const supabase = getAdminClient();
  const normalizedValue = Math.max(0, Math.floor(value));

  const { data, error } = await supabase
    .from("home_settings")
    .upsert({
      key: "low_history_threshold",
      value: normalizedValue,
    })
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function createHomeEditorialRow(input: { title: string; sortOrder: number }) {
  const supabase = getAdminClient();
  if (!input.title.trim()) {
    return null;
  }

  const { data, error } = await supabase
    .from("home_rows")
    .insert({
      enabled: true,
      row_role: "editorial",
      sort_order: input.sortOrder,
      title: input.title.trim(),
    })
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return { createdRow: data };
}

export async function updateHomeRow(
  id: string,
  input: { enabled: boolean; sortOrder: number; title: string },
) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("home_rows")
    .update({
      enabled: input.enabled,
      sort_order: input.sortOrder,
      title: input.title.trim(),
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function deleteHomeEditorialRow(id: string) {
  const supabase = getAdminClient();
  const { data: row } = await supabase.from("home_rows").select("id,row_role").eq("id", id).maybeSingle();

  if (!row || row.row_role !== "editorial") {
    return false;
  }

  const { error } = await supabase.from("home_rows").delete().eq("id", id);
  return !error;
}

export async function moveHomeRow(id: string, direction: "up" | "down") {
  const supabase = getAdminClient();
  const { data: rows } = await supabase
    .from("home_rows")
    .select("id,sort_order,row_role")
    .neq("row_role", "spotlight")
    .order("sort_order", { ascending: true });

  const currentRows = rows ?? [];
  const currentIndex = currentRows.findIndex((r) => r.id === id);

  if (currentIndex === -1) {
    return false;
  }

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= currentRows.length) {
    return false;
  }

  const currentRow = currentRows[currentIndex];
  const targetRow = currentRows[targetIndex];

  if (!currentRow || !targetRow) {
    return false;
  }

  const currentOrder = currentRow.sort_order;
  const targetOrder = targetRow.sort_order;

  await Promise.all([
    supabase.from("home_rows").update({ sort_order: targetOrder }).eq("id", currentRow.id),
    supabase.from("home_rows").update({ sort_order: currentOrder }).eq("id", targetRow.id),
  ]);

  return true;
}

export async function addHomeRowItem(input: {
  contentId: string;
  contentType: HomeContentType;
  rowId: string;
  sortOrder: number;
}) {
  const supabase = getAdminClient();
  const { data: row } = await supabase.from("home_rows").select("id").eq("id", input.rowId).maybeSingle();

  if (!row) {
    return { missing: true as const };
  }

  if (input.contentType === "series") {
    const { data: content } = await supabase.from("series").select("id").eq("id", input.contentId).maybeSingle();
    if (!content) {
      return { missingContent: true as const };
    }
  } else {
    const { data: content } = await supabase
      .from("short_films")
      .select("id")
      .eq("id", input.contentId)
      .maybeSingle();
    if (!content) {
      return { missingContent: true as const };
    }
  }

  const duplicate =
    input.contentType === "series"
      ? await supabase
          .from("home_row_items")
          .select("id")
          .eq("row_id", input.rowId)
          .eq("content_type", "series")
          .eq("series_id", input.contentId)
          .maybeSingle()
      : await supabase
          .from("home_row_items")
          .select("id")
          .eq("row_id", input.rowId)
          .eq("content_type", "short_film")
          .eq("short_film_id", input.contentId)
          .maybeSingle();

  if (duplicate.data) {
    return { duplicate: true as const };
  }

  const { data, error } =
    input.contentType === "series"
      ? await supabase
          .from("home_row_items")
          .insert({
            content_type: "series",
            row_id: input.rowId,
            series_id: input.contentId,
            short_film_id: null,
            sort_order: input.sortOrder,
          })
          .select("*")
          .maybeSingle()
      : await supabase
          .from("home_row_items")
          .insert({
            content_type: "short_film",
            row_id: input.rowId,
            series_id: null,
            short_film_id: input.contentId,
            sort_order: input.sortOrder,
          })
          .select("*")
          .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function updateHomeRowItem(id: string, sortOrder: number) {
  const supabase = getAdminClient();
  const { data: existing } = await supabase.from("home_row_items").select("id").eq("id", id).maybeSingle();

  if (!existing) {
    return null;
  }

  const { data, error } = await supabase
    .from("home_row_items")
    .update({ sort_order: sortOrder })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function moveHomeRowItem(id: string, direction: "up" | "down") {
  const supabase = getAdminClient();
  const { data: currentItem } = await supabase
    .from("home_row_items")
    .select("id,row_id,sort_order")
    .eq("id", id)
    .maybeSingle();

  if (!currentItem) {
    return false;
  }

  const { data: rowItems } = await supabase
    .from("home_row_items")
    .select("id,sort_order")
    .eq("row_id", currentItem.row_id)
    .order("sort_order", { ascending: true });

  const items = rowItems ?? [];
  const currentIndex = items.findIndex((item) => item.id === id);

  if (currentIndex === -1) {
    return false;
  }

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= items.length) {
    return false;
  }

  const targetItem = items[targetIndex];
  if (!targetItem) {
    return false;
  }

  const currentOrder = currentItem.sort_order;
  const targetOrder = targetItem.sort_order;

  await Promise.all([
    supabase.from("home_row_items").update({ sort_order: targetOrder }).eq("id", currentItem.id),
    supabase.from("home_row_items").update({ sort_order: currentOrder }).eq("id", targetItem.id),
  ]);

  return true;
}

export async function removeHomeRowItem(id: string) {
  const supabase = getAdminClient();
  const { data: existing } = await supabase.from("home_row_items").select("id").eq("id", id).maybeSingle();

  if (!existing) {
    return false;
  }

  const { error } = await supabase.from("home_row_items").delete().eq("id", id);
  return !error;
}
