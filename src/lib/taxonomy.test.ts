import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CANONICAL_GENRES,
  normalizeGenreAssignments,
  normalizeSeriesContentFormat,
  normalizeShortFilmContentFormat,
  serializeGenreLabel,
} from "@/lib/taxonomy";
import { getSeriesBySlug } from "@/data/content";

test("canonical genres expose stable machine ids separate from display names", () => {
  assert.deepEqual(
    CANONICAL_GENRES.map((genre) => genre.id),
    ["romance", "drama", "comedy", "thriller", "mystery", "family"],
  );
  assert.equal(CANONICAL_GENRES[0].displayName, "Romance");
  assert.notEqual(CANONICAL_GENRES[0].id, CANONICAL_GENRES[0].displayName);
});

test("genre normalization maps legacy display phrases to primary and secondary genres", () => {
  const assignment = normalizeGenreAssignments("Romantic drama");

  assert.deepEqual(assignment.primaryGenre, { id: "romance", displayName: "Romance" });
  assert.deepEqual(assignment.secondaryGenres, [{ id: "drama", displayName: "Drama" }]);
  assert.equal(serializeGenreLabel(assignment), "Romance, Drama");
});

test("genre normalization de-duplicates primary from secondary genres", () => {
  const assignment = normalizeGenreAssignments("drama, Drama, Romantic drama");

  assert.deepEqual(assignment.primaryGenre, { id: "drama", displayName: "Drama" });
  assert.deepEqual(assignment.secondaryGenres, [{ id: "romance", displayName: "Romance" }]);
});

test("unknown genre input is safely ignored instead of becoming canonical identity", () => {
  const assignment = normalizeGenreAssignments("Totally New Display Label");

  assert.equal(assignment.primaryGenre, null);
  assert.deepEqual(assignment.secondaryGenres, []);
  assert.equal(serializeGenreLabel(assignment), null);
});

test("Micro Drama and Short Film are content formats, not genres", () => {
  assert.equal(normalizeSeriesContentFormat(), "MICRO_DRAMA");
  assert.equal(normalizeShortFilmContentFormat(), "SHORT_FILM");
  assert.equal(normalizeGenreAssignments("Micro Drama").primaryGenre, null);
  assert.equal(normalizeGenreAssignments("Short Film").primaryGenre, null);
});

test("DB/CMS taxonomy wins over mock fallback taxonomy for seeded slugs", () => {
  const fallback = getSeriesBySlug("aadha-takiya");
  const assignment = normalizeGenreAssignments("thriller");

  assert.equal(fallback?.genre, "Romantic drama");
  assert.equal(serializeGenreLabel(assignment), "Thriller");
  assert.deepEqual(assignment.primaryGenre, { id: "thriller", displayName: "Thriller" });
  assert.deepEqual(assignment.secondaryGenres, []);
});

test("missing DB/CMS taxonomy does not fall back to mock genre", () => {
  const fallback = getSeriesBySlug("aadha-takiya");
  const assignment = normalizeGenreAssignments(null);

  assert.equal(fallback?.genre, "Romantic drama");
  assert.equal(serializeGenreLabel(assignment), null);
  assert.equal(assignment.primaryGenre, null);
  assert.deepEqual(assignment.secondaryGenres, []);
});
