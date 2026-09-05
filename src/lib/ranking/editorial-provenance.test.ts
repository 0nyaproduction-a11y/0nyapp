import { test } from "node:test";
import assert from "node:assert/strict";

import {
  EDITORIAL_RANKING_POLICY,
  HOME_EDITORIAL_CONFIG_SCHEMA_VERSION,
  HOME_EDITORIAL_POLICY_VERSION,
  NEW_RELEASES_CHRONOLOGICAL_SOURCE,
  NEW_RELEASES_EDITORIAL_SOURCE,
  buildHomeEditorialConfigSnapshot,
  computeHomeEditorialConfigHash,
  computeHomeEditorialConfigVersion,
  editorialInterventionForChange,
} from "@/lib/ranking/editorial-provenance";

const config = {
  lowHistoryThreshold: 5,
  rows: [
    {
      id: "row-b",
      title: "Staff Picks",
      row_role: "editorial",
      enabled: true,
      sort_order: 20,
      updated_at: "2026-09-05T01:00:00.000Z",
    },
    {
      id: "row-a",
      title: "Start Here",
      row_role: "start_here",
      enabled: true,
      sort_order: 10,
      updated_at: "2026-09-05T00:00:00.000Z",
    },
  ],
  items: [
    {
      id: "item-b",
      row_id: "row-b",
      content_type: "short_film",
      series_id: null,
      short_film_id: "sf-1",
      sort_order: 10,
      show_title: false,
      updated_at: "2026-09-05T01:00:00.000Z",
    },
    {
      id: "item-a",
      row_id: "row-a",
      content_type: "series",
      series_id: "series-1",
      short_film_id: null,
      sort_order: 0,
      show_title: true,
      updated_at: "2026-09-05T00:00:00.000Z",
    },
  ],
};

test("editorial provenance constants use stable policy/version identity", () => {
  assert.equal(EDITORIAL_RANKING_POLICY, "editorial");
  assert.equal(HOME_EDITORIAL_POLICY_VERSION, "home_editorial_v1");
  assert.equal(HOME_EDITORIAL_CONFIG_SCHEMA_VERSION, "home_editorial_config_v1");
});

test("home editorial config hash is deterministic and order-normalized", () => {
  const reordered = {
    ...config,
    rows: [...config.rows].reverse(),
    items: [...config.items].reverse(),
  };

  assert.equal(computeHomeEditorialConfigHash(config), computeHomeEditorialConfigHash(reordered));
  assert.match(computeHomeEditorialConfigHash(config), /^[a-f0-9]{64}$/);
});

test("home editorial config version is reconstructible from the config hash", () => {
  const hash = computeHomeEditorialConfigHash(config);
  assert.equal(
    computeHomeEditorialConfigVersion(config),
    `${HOME_EDITORIAL_CONFIG_SCHEMA_VERSION}:${hash.slice(0, 12)}`,
  );
});

test("config snapshot preserves enabled state and exact editorial order inputs", () => {
  const snapshot = buildHomeEditorialConfigSnapshot(config);

  assert.deepEqual(
    snapshot.rows.map((row) => row.id),
    ["row-a", "row-b"],
  );
  assert.deepEqual(
    snapshot.items.map((item) => item.id),
    ["item-a", "item-b"],
  );
  assert.equal(snapshot.rows[0].enabled, true);
  assert.equal(snapshot.items[1].showTitle, false);
});

test("editorial change mapping matches current CMS semantics", () => {
  assert.equal(editorialInterventionForChange("ITEM_ADD"), "EDITORIAL_PIN");
  assert.equal(editorialInterventionForChange("ITEM_REMOVE"), "EDITORIAL_REMOVE");
  assert.equal(editorialInterventionForChange("ROW_DELETE"), "EDITORIAL_REMOVE");
  assert.equal(editorialInterventionForChange("ITEM_REORDER"), "EDITORIAL_ORDER");
  assert.equal(editorialInterventionForChange("ROW_REORDER"), "EDITORIAL_ORDER");
  assert.equal(editorialInterventionForChange("HOME_SETTING_UPDATE"), "EDITORIAL_ORDER");
});

test("boost is not invented by the current CMS provenance mapping", () => {
  const mapped = [
    "ITEM_ADD",
    "ITEM_REMOVE",
    "ROW_DELETE",
    "ITEM_REORDER",
    "ROW_REORDER",
    "ITEM_UPDATE",
    "ROW_UPDATE",
    "SPOTLIGHT_TOGGLE",
    "HOME_SETTING_UPDATE",
  ].map((change) => editorialInterventionForChange(change as Parameters<typeof editorialInterventionForChange>[0]));

  assert.equal(mapped.includes("EDITORIAL_BOOST"), false);
});

test("New Releases source values distinguish editorial pins from chronological fill", () => {
  assert.equal(NEW_RELEASES_EDITORIAL_SOURCE, "editorial_pin");
  assert.equal(NEW_RELEASES_CHRONOLOGICAL_SOURCE, "deterministic_release_date");
});
