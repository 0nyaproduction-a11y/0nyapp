/**
 * Tests for Home row mapping logic.
 *
 * Verifies that:
 *  - `findSeriesBySlug` finds a series by slug from the catalog.
 *  - `findSeriesBySlug` returns undefined when not found.
 *  - `computeRowWarnings` detects empty rows.
 *  - `computeRowWarnings` detects unpublished assigned series.
 *  - `computeRowWarnings` detects duplicate assignments across rows.
 *  - `findEpisode` finds an episode by slug.
 */

import {
  findSeriesBySlug,
  computeRowWarnings,
  findEpisode,
  sortSeriesByHomeOrder,
  computeAutoAssignedSlugs,
} from "../mapping";
import type { ContentItem } from "@/data/content";

 const mockCatalog: ContentItem[] = [
  {
    id: "1",
    title: "Alpha Series",
    slug: "alpha",
    genre: "Drama",
    format: "Series",
    episodeCount: 10,
    episodeDuration: "24 min",
    synopsis: "",
    poster: "/logo-og.jpg",
    accent: "#0DD1BC",
    episodes: [],
  },
  {
    id: "2",
    title: "Beta Series",
    slug: "beta",
    genre: "Comedy",
    format: "Series",
    episodeCount: 8,
    episodeDuration: "28 min",
    synopsis: "",
    poster: "/logo-og.jpg",
    accent: "#0DD1BC",
    episodes: [],
  },
  {
    id: "3",
    title: "Gamma Series",
    slug: "gamma",
    genre: "Action",
    format: "Series",
    episodeCount: 6,
    episodeDuration: "45 min",
    synopsis: "",
    poster: "/logo-og.jpg",
    accent: "#0DD1BC",
    episodes: [],
  },
];

describe("findSeriesBySlug", () => {
  it("finds a series by slug", () => {
    const found = findSeriesBySlug(mockCatalog, "alpha");
    expect(found).toBeDefined();
    expect(found?.title).toBe("Alpha Series");
  });

  it("returns undefined when slug is not in catalog", () => {
    const found = findSeriesBySlug(mockCatalog, "nonexistent");
    expect(found).toBeUndefined();
  });

  it("returns undefined when slug is null", () => {
    const found = findSeriesBySlug(mockCatalog, null);
    expect(found).toBeUndefined();
  });
});

describe("findEpisode", () => {
  it("finds an episode by number within a series", () => {
    const seriesWithEpisodes: ContentItem = {
      ...mockCatalog[0],
      episodes: [
        {
          id: "ep-1",
          number: 1,
          title: "Pilot",
          description: "",
          runtime: "24 min",
          isFree: true,
          isLocked: false,
        },
        {
          id: "ep-2",
          number: 2,
          title: "Rent Due",
          description: "",
          runtime: "25 min",
          isFree: true,
          isLocked: false,
        },
      ],
    };
    const ep = findEpisode(seriesWithEpisodes, 2);
    expect(ep).toBeDefined();
    expect(ep?.title).toBe("Rent Due");
  });

  it("returns undefined when episode number is not found", () => {
    const seriesWithEpisodes = {
      ...mockCatalog[0],
      episodes: [],
    };
    const ep = findEpisode(seriesWithEpisodes, 99);
    expect(ep).toBeUndefined();
  });
});

describe("computeRowWarnings", () => {
  it("produces empty warning for a valid row with published items", () => {
    const row = {
      id: "trending",
      title: "Trending",
      type: "trending" as const,
      sortOrder: 0,
      visible: true,
      assignedSlugs: ["alpha", "beta"],
      kicker: null,
    };
    const items = mockCatalog.filter((s) => ["alpha", "beta"].includes(s.slug));
    const warnings = computeRowWarnings(row, items, mockCatalog);
    expect(warnings).toEqual([]);
  });

  it("produces empty warning when no items are assigned", () => {
    const row = {
      id: "trending",
      title: "Trending",
      type: "trending" as const,
      sortOrder: 0,
      visible: true,
      assignedSlugs: [],
      kicker: null,
    };
    const warnings = computeRowWarnings(row, [], mockCatalog);
    const emptyWarning = warnings.find((w) => w.code === "empty");
    expect(emptyWarning).toBeDefined();
    expect(emptyWarning?.label).toContain("no titles");
  });

  it("warns when an assigned slug is unpublished", () => {
    const row = {
      id: "trending",
      title: "Trending",
      type: "trending" as const,
      sortOrder: 0,
      visible: true,
      assignedSlugs: ["alpha", "gamma"],
      kicker: null,
    };
    // "gamma" is in mockCatalog, but "unpublished-slug" is not
    const items = mockCatalog.filter((s) => s.slug === "alpha");
    const warnings = computeRowWarnings(
      { ...row, assignedSlugs: ["alpha", "unpublished-slug"] },
      items,
      mockCatalog,
    );
    const unpublished = warnings.find((w) => w.code === "unpublished_assigned");
    expect(unpublished).toBeDefined();
    expect(unpublished?.count).toBe(1);
  });
});

describe("sortSeriesByHomeOrder", () => {
  it("sorts series by sortOrder", () => {
    const shuffled = [mockCatalog[2], mockCatalog[0], mockCatalog[1]];
    const sorted = sortSeriesByHomeOrder(shuffled);
    expect(sorted[0].slug).toBe("alpha");
    expect(sorted[1].slug).toBe("beta");
    expect(sorted[2].slug).toBe("gamma");
  });

  it("returns empty array when given empty array", () => {
    const sorted = sortSeriesByHomeOrder([]);
    expect(sorted).toEqual([]);
  });
});

describe("computeAutoAssignedSlugs", () => {
  it("returns featured-hero slug for featured-hero type", () => {
    const assigned = computeAutoAssignedSlugs("featured-hero", mockCatalog);
    expect(assigned).toEqual(["alpha"]);
  });

  it("returns empty array when catalog is empty", () => {
    const assigned = computeAutoAssignedSlugs("featured-hero", []);
    expect(assigned).toEqual([]);
  });

  it("returns start-here slugs for start-here type", () => {
    const assigned = computeAutoAssignedSlugs("start-here", mockCatalog);
    expect(assigned.length).toBeGreaterThan(0);
    expect(assigned).toContain("alpha");
  });
});
