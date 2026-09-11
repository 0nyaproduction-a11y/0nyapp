import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  SHORT_FILM_LIST_QUERY_KEYS,
  sanitizeAdminReturnTarget,
  sanitizeShortFilmListQuery,
  shortFilmListPath,
  shortFilmListReturnHref,
  withListContext,
} from "@/lib/routes";

describe("CMS-C08B-05 short-film list-context preservation", () => {
  test("page=3 preserved", () => {
    assert.equal(
      shortFilmListReturnHref({ page: "3" }),
      `${shortFilmListPath}?page=3`,
    );
  });

  test("pageSize=50 preserved", () => {
    assert.equal(
      shortFilmListReturnHref({ pageSize: "50" }),
      `${shortFilmListPath}?pageSize=50`,
    );
  });

  test("search preserved", () => {
    const href = shortFilmListReturnHref({ search: "neon tide" });
    assert.ok(href.includes("search=neon"));
  });

  test("status preserved", () => {
    assert.equal(
      shortFilmListReturnHref({ status: "published" }),
      `${shortFilmListPath}?status=published`,
    );
  });

  test("combined query preserved", () => {
    const href = shortFilmListReturnHref({
      page: "3",
      pageSize: "50",
      search: "neon",
      status: "published",
    });
    const params = new URLSearchParams(href.split("?")[1]);
    assert.equal(params.get("page"), "3");
    assert.equal(params.get("pageSize"), "50");
    assert.equal(params.get("search"), "neon");
    assert.equal(params.get("status"), "published");
  });

  test("malformed return target falls back to canonical list path", () => {
    assert.equal(
      sanitizeAdminReturnTarget(
        "/admin/short-films?page=abc&pageSize=nope&status=bogus",
        shortFilmListPath,
        SHORT_FILM_LIST_QUERY_KEYS,
      ),
      shortFilmListPath,
    );
    assert.equal(
      sanitizeAdminReturnTarget("", shortFilmListPath, SHORT_FILM_LIST_QUERY_KEYS),
      shortFilmListPath,
    );
  });

  test("external and non-admin return targets rejected", () => {
    assert.equal(
      sanitizeAdminReturnTarget(
        "https://evil.example/admin/short-films?page=3",
        shortFilmListPath,
        SHORT_FILM_LIST_QUERY_KEYS,
      ),
      shortFilmListPath,
    );
    assert.equal(
      sanitizeAdminReturnTarget(
        "//evil.example/admin/short-films",
        shortFilmListPath,
        SHORT_FILM_LIST_QUERY_KEYS,
      ),
      shortFilmListPath,
    );
    assert.equal(
      sanitizeAdminReturnTarget(
        "/admin/series?page=3",
        shortFilmListPath,
        SHORT_FILM_LIST_QUERY_KEYS,
      ),
      shortFilmListPath,
    );
  });

  test("unknown query keys never leak into return URLs", () => {
    const href = shortFilmListReturnHref({ page: "3", evil: "1" } as unknown as Record<string, string>);
    const params = new URLSearchParams(href.split("?")[1] ?? "");
    assert.equal(params.get("evil"), null);
    assert.equal(params.get("page"), "3");
  });

  test("dirty breadcrumb target carries full query through existing helper", () => {
    const href = withListContext(
      shortFilmListPath,
      sanitizeShortFilmListQuery({ page: "3", pageSize: "50", search: "neon", status: "draft" }),
    );
    assert.ok(href.startsWith(shortFilmListPath));
    const params = new URLSearchParams(href.split("?")[1]);
    assert.equal(params.get("page"), "3");
    assert.equal(params.get("pageSize"), "50");
    assert.equal(params.get("search"), "neon");
    assert.equal(params.get("status"), "draft");
  });
});
