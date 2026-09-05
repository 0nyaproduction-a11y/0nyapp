import { createHash } from "node:crypto";

export const EDITORIAL_RANKING_POLICY = "editorial" as const;
export const HOME_EDITORIAL_POLICY_VERSION = "home_editorial_v1" as const;
export const HOME_EDITORIAL_CONFIG_SCHEMA_VERSION = "home_editorial_config_v1" as const;

export const NEW_RELEASES_EDITORIAL_SOURCE = "editorial_pin" as const;
export const NEW_RELEASES_CHRONOLOGICAL_SOURCE = "deterministic_release_date" as const;

export type RankingPolicy = typeof EDITORIAL_RANKING_POLICY;
export type HomeEditorialPolicyVersion = typeof HOME_EDITORIAL_POLICY_VERSION;
export type HomeEditorialConfigSchemaVersion = typeof HOME_EDITORIAL_CONFIG_SCHEMA_VERSION;
export type NewReleasesSource =
  | typeof NEW_RELEASES_EDITORIAL_SOURCE
  | typeof NEW_RELEASES_CHRONOLOGICAL_SOURCE;

export type EditorialInterventionType =
  | "EDITORIAL_PIN"
  | "EDITORIAL_BOOST"
  | "EDITORIAL_REMOVE"
  | "EDITORIAL_ORDER";

export type EditorialChangeType =
  | "ROW_CREATE"
  | "ROW_UPDATE"
  | "ROW_DELETE"
  | "ROW_REORDER"
  | "ITEM_ADD"
  | "ITEM_UPDATE"
  | "ITEM_REMOVE"
  | "ITEM_REORDER"
  | "SPOTLIGHT_TOGGLE"
  | "HOME_SETTING_UPDATE";

export type HomeEditorialConfigInput = {
  lowHistoryThreshold: number | null;
  rows: Array<{
    enabled: boolean;
    id: string;
    row_role: string;
    sort_order: number;
    title: string;
    updated_at?: string | null;
  }>;
  items: Array<{
    content_type: string;
    id: string;
    row_id: string;
    series_id: string | null;
    short_film_id: string | null;
    show_title?: boolean | null;
    sort_order: number;
    updated_at?: string | null;
  }>;
};

export function editorialInterventionForChange(changeType: EditorialChangeType): EditorialInterventionType {
  switch (changeType) {
    case "ITEM_ADD":
      return "EDITORIAL_PIN";
    case "ITEM_REMOVE":
    case "ROW_DELETE":
      return "EDITORIAL_REMOVE";
    case "ROW_CREATE":
    case "ROW_UPDATE":
    case "ROW_REORDER":
    case "ITEM_UPDATE":
    case "ITEM_REORDER":
    case "SPOTLIGHT_TOGGLE":
    case "HOME_SETTING_UPDATE":
      return "EDITORIAL_ORDER";
    default: {
      const exhaustive: never = changeType;
      return exhaustive;
    }
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

export function buildHomeEditorialConfigSnapshot(input: HomeEditorialConfigInput) {
  return {
    schemaVersion: HOME_EDITORIAL_CONFIG_SCHEMA_VERSION,
    lowHistoryThreshold: input.lowHistoryThreshold,
    rows: [...input.rows]
      .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
      .map((row) => ({
        id: row.id,
        title: row.title,
        role: row.row_role,
        enabled: row.enabled,
        sortOrder: row.sort_order,
        updatedAt: row.updated_at ?? null,
      })),
    items: [...input.items]
      .sort((a, b) => a.row_id.localeCompare(b.row_id) || a.sort_order - b.sort_order || a.id.localeCompare(b.id))
      .map((item) => ({
        id: item.id,
        rowId: item.row_id,
        contentType: item.content_type,
        seriesId: item.series_id,
        shortFilmId: item.short_film_id,
        sortOrder: item.sort_order,
        showTitle: item.show_title ?? true,
        updatedAt: item.updated_at ?? null,
      })),
  };
}

export function computeHomeEditorialConfigHash(input: HomeEditorialConfigInput): string {
  const snapshot = buildHomeEditorialConfigSnapshot(input);
  return createHash("sha256").update(stableJson(snapshot)).digest("hex");
}

export function computeHomeEditorialConfigVersion(input: HomeEditorialConfigInput): string {
  return `${HOME_EDITORIAL_CONFIG_SCHEMA_VERSION}:${computeHomeEditorialConfigHash(input).slice(0, 12)}`;
}
