
/**
 * Pure playback telemetry metrics.
 *
 * All functions are synchronous, side-effect free, and operate solely on
 * in-memory parameters. No database calls, no network calls, no mutation of
 * input arrays.
 *
 * Formulas are documented in JSDoc below each function.
 */

/**
 * A published episode in the CMS catalog.
 */
export interface PublishedEpisode {
  /** Series slug this episode belongs to. */
  seriesSlug: string;
  /** 1-based episode number within the series. */
  episodeNumber: number;
  /** Publication status in the CMS. */
  status: "draft" | "published" | "archived";
  /** Episode duration in seconds. */
  durationSeconds: number;
}

/**
 * A published short film in the CMS catalog.
 */
export interface PublishedShortFilm {
  /** Unique slug for the short film. */
  slug: string;
  /** Publication status in the CMS. */
  status: "draft" | "published" | "archived";
  /** Short film duration in seconds. */
  durationSeconds: number;
}

/**
 * A single watch_progress row as supplied to the telemetry functions.
 */
export interface WatchProgressRow {
  /** User identifier. */
  userId: string;
  /** Content type discriminator. */
  contentType: "series_episode" | "short_film";
  /** Series slug (null for short films). */
  seriesSlug: string | null;
  /** Episode number (null for short films). */
  episodeNumber: number | null;
  /** Short film slug (null for series episodes). */
  shortFilmSlug: string | null;
  /** Progress row duration in seconds. */
  durationSeconds: number;
  /** Whether the user completed the content. */
  completed: boolean;
}

/**
 * Drop-off data for a single published episode.
 */
export interface EpisodeDropoffPoint {
  /** Series slug. */
  seriesSlug: string;
  /** Episode number. */
  episodeNumber: number;
  /** Number of watch_progress rows reaching this episode. */
  recordsReaching: number;
  /** Number of watch_progress rows reaching the next published episode, or null if this is the last published episode. */
  recordsReachingNext: number | null;
  /** Drop-off rate: (recordsReaching - recordsReachingNext) / recordsReaching, or null if not computable. */
  dropoffRate: number | null;
}

/**
 * Completion data for a single series.
 */
export interface SeriesCompletionPoint {
  /** Series slug. */
  seriesSlug: string;
  /** Number of currently published episodes in the series. */
  publishedEpisodeCount: number;
  /** Count of unique (userId, seriesSlug) pairs with at least one watch_progress row for a published episode in the series. */
  eligibleUserSeriesPairs: number;
  /** Count of eligible pairs where the user completed every published episode. */
  completedUserSeriesPairs: number;
  /** completionRate = completedUserSeriesPairs / eligibleUserSeriesPairs, or null if denominator is 0. */
  completionRate: number | null;
}

/**
 * Series completion rate aggregate.
 */
export interface SeriesCompletionRate {
  /** Overall completion rate across all series, or null if no eligible data. */
  overall: number | null;
  /** Per-series breakdown. */
  bySeries: SeriesCompletionPoint[];
}

/**
 * Top-level telemetry payload produced by buildPlaybackTelemetry.
 *
 * All metrics are derived from the supplied progress rows and published-content
 * catalogs. No raw user identifiers or PII are exposed.
 */
export interface PlaybackTelemetryOutput {
  /** Completion rates split by content type. */
  completionRate: {
    /** Series episode completion rate, or null when no eligible data. */
    seriesEpisodes: number | null;
    /** Short film completion rate, or null when no eligible data. */
    shortFilms: number | null;
  };
  /** Per-episode drop-off snapshot. */
  episodeDropoff: EpisodeDropoffPoint[];
  /** Per-series and overall completion rates. */
  seriesCompletionRate: SeriesCompletionRate;
  /** Unix timestamp (ms) when the telemetry was generated. */
  generatedAt: number;
  /** Fixed authority marker indicating the values are derived, not authoritative source data. */
  authority: "DERIVED";
  /** Fixed source marker indicating the values originate from telemetry. */
  source: "TELEMETRY";
  /** Fixed caveat about historical completeness. */
  caveat: "Historical completeness may be partial.";
}

/**
 * Build lookup sets for published episodes and short films.
 */
function buildPublishedLookups(
  publishedEpisodes: PublishedEpisode[],
  publishedShortFilms: PublishedShortFilm[]
) {
  const publishedEpisodeKeys = new Set(
    publishedEpisodes
      .filter((ep) => ep.status === "published")
      .map((ep) => `${ep.seriesSlug}:${ep.episodeNumber}`)
  );

  const publishedShortFilmKeys = new Set(
    publishedShortFilms
      .filter((sf) => sf.status === "published")
      .map((sf) => sf.slug)
  );

  return { publishedEpisodeKeys, publishedShortFilmKeys };
}

/**
 * EXACT FORMULA — Completion Rate
 *
 * Denominator = eligible watch_progress rows.
 * Numerator = completed eligible watch_progress rows.
 *
 * Eligible series_episode rows:
 *   - contentType === 'series_episode'
 *   - durationSeconds > 0
 *   - seriesSlug !== null
 *   - episodeNumber !== null
 *   - AND the episode exists in publishedEpisodes with status === 'published'
 *
 * Eligible short_film rows:
 *   - contentType === 'short_film'
 *   - durationSeconds > 0
 *   - shortFilmSlug !== null
 *   - AND the short film exists in publishedShortFilms with status === 'published'
 *
 * Incomplete rows ARE INCLUDED in denominator, EXCLUDED from numerator.
 * Short films and series episodes are computed SEPARATELY.
 * Zero denominator returns null (not 0) to distinguish "no data" from "0%".
 * Duplicate/upsert: database UNIQUE constraints prevent duplicates per user per content;
 * formula assumes clean data, no dedup needed.
 * Historical gaps: archived/draft content excluded from both numerator and denominator.
 *
 * @param progressRows - All watch_progress rows to evaluate.
 * @param publishedEpisodes - CMS episode catalog.
 * @param publishedShortFilms - CMS short film catalog.
 * @returns Separate completion rates for series episodes and short films.
 */
export function computeCompletionRate(
  progressRows: WatchProgressRow[],
  publishedEpisodes: PublishedEpisode[],
  publishedShortFilms: PublishedShortFilm[]
): { seriesEpisodes: number | null; shortFilms: number | null } {
  const { publishedEpisodeKeys, publishedShortFilmKeys } =
    buildPublishedLookups(publishedEpisodes, publishedShortFilms);

  // --- Series episodes ---
  const eligibleSeriesRows = progressRows.filter((row) => {
    if (row.contentType !== "series_episode") return false;
    if (row.durationSeconds <= 0) return false;
    if (row.seriesSlug === null || row.episodeNumber === null) return false;
    return publishedEpisodeKeys.has(`${row.seriesSlug}:${row.episodeNumber}`);
  });

  const seriesDenominator = eligibleSeriesRows.length;
  const seriesNumerator = eligibleSeriesRows.filter((row) => row.completed).length;
  const seriesEpisodes =
    seriesDenominator === 0 ? null : seriesNumerator / seriesDenominator;

  // --- Short films ---
  const eligibleShortFilmRows = progressRows.filter((row) => {
    if (row.contentType !== "short_film") return false;
    if (row.durationSeconds <= 0) return false;
    if (row.shortFilmSlug === null) return false;
    return publishedShortFilmKeys.has(row.shortFilmSlug);
  });

  const shortFilmDenominator = eligibleShortFilmRows.length;
  const shortFilmNumerator = eligibleShortFilmRows.filter((row) => row.completed).length;
  const shortFilms =
    shortFilmDenominator === 0 ? null : shortFilmNumerator / shortFilmDenominator;

  return { seriesEpisodes, shortFilms };
}

/**
 * EXACT FORMULA — Episode Drop-off
 *
 * Snapshot definition (NOT trend analysis).
 *
 * For each series, for each published episode N (sorted by episodeNumber ascending):
 *   - recordsReachingN = count of watch_progress rows where
 *       contentType='series_episode', durationSeconds>0, seriesSlug matches,
 *       episodeNumber === N.
 *   - If N is the LAST published episode in the series:
 *       recordsReachingNext = null, dropoffRate = null (no next episode).
 *   - Otherwise:
 *       recordsReachingNext = count for the next published episode in the series.
 *   - dropoffRate = (recordsReachingN - recordsReachingNext) / recordsReachingN
 *       when recordsReachingN > 0, else null.
 *
 * Denominator = recordsReachingN.
 * Numerator = recordsReachingN - recordsReachingNext.
 * Last episode: excluded from drop-off (no N+1).
 * Skipped episodes: naturally handled — if a user reached ep3 but not ep2,
 *   they count in ep3 but not ep2. Dropoff from ep2 to ep3 reflects users
 *   who stopped.
 * Partial series: users counted only in episodes they reached.
 * Zero denominator: returns null.
 * Gaps: only existing rows counted; missing rows = user did not reach.
 *
 * @param progressRows - All watch_progress rows to evaluate.
 * @param publishedEpisodes - CMS episode catalog.
 * @returns One drop-off point per published episode, sorted by series then episode number.
 */
export function computeEpisodeDropoff(
  progressRows: WatchProgressRow[],
  publishedEpisodes: PublishedEpisode[]
): EpisodeDropoffPoint[] {
  // Group published episodes by series, sorted by episodeNumber.
  const seriesEpisodesMap = new Map<string, PublishedEpisode[]>();
  for (const ep of publishedEpisodes) {
    if (ep.status !== "published") continue;
    const arr = seriesEpisodesMap.get(ep.seriesSlug) ?? [];
    arr.push(ep);
    seriesEpisodesMap.set(ep.seriesSlug, arr);
  }
  for (const arr of seriesEpisodesMap.values()) {
    arr.sort((a, b) => a.episodeNumber - b.episodeNumber);
  }

  // Build progress row count lookup: key = `${seriesSlug}:${episodeNumber}`
  const progressCountMap = new Map<string, number>();
  for (const row of progressRows) {
    if (row.contentType !== "series_episode") continue;
    if (row.durationSeconds <= 0) continue;
    if (row.seriesSlug === null || row.episodeNumber === null) continue;
    const key = `${row.seriesSlug}:${row.episodeNumber}`;
    progressCountMap.set(key, (progressCountMap.get(key) ?? 0) + 1);
  }

  const result: EpisodeDropoffPoint[] = [];

  for (const [seriesSlug, episodes] of seriesEpisodesMap) {
    for (let i = 0; i < episodes.length; i++) {
      const ep = episodes[i];
      const recordsReachingN =
        progressCountMap.get(`${seriesSlug}:${ep.episodeNumber}`) ?? 0;

      let recordsReachingNext: number | null = null;
      let dropoffRate: number | null = null;

      if (i < episodes.length - 1) {
        const nextEp = episodes[i + 1];
        recordsReachingNext =
          progressCountMap.get(`${seriesSlug}:${nextEp.episodeNumber}`) ?? 0;
        if (recordsReachingN > 0) {
          dropoffRate =
            (recordsReachingN - recordsReachingNext) / recordsReachingN;
        }
      }

      result.push({
        seriesSlug,
        episodeNumber: ep.episodeNumber,
        recordsReaching: recordsReachingN,
        recordsReachingNext,
        dropoffRate,
      });
    }
  }

  return result;
}

/**
 * EXACT FORMULA — Series Completion Rate
 *
 * A series is complete for a user if ALL currently published episodes have
 * completed=true for that user.
 *
 * Denominator = eligible-series telemetry records =
 *   count of unique (userId, seriesSlug) pairs where the user has at least one
 *   watch_progress row for any published episode in the series.
 *
 * Numerator = completed-series telemetry records =
 *   count of eligible pairs where the user has completed=true for EVERY
 *   published episode in the series.
 *
 * Published episode denominator: only episodes with status === 'published' count.
 * Draft/archived episodes: EXCLUDED from published episode count.
 *   Do not require completion.
 * Newly added episodes: when a new episode is published, publishedEpisodeCount
 *   increases. Previously complete series may become incomplete.
 *   Historical data is NOT retroactively adjusted.
 * Incomplete series: user missing ANY published episode OR having any published
 *   episode incomplete = incomplete.
 * Zero denominator: returns null.
 * Historical incompleteness: disclosed in caveat.
 *
 * @param progressRows - All watch_progress rows to evaluate.
 * @param publishedEpisodes - CMS episode catalog.
 * @returns Per-series completion points and overall aggregate.
 */
export function computeSeriesCompletionRate(
  progressRows: WatchProgressRow[],
  publishedEpisodes: PublishedEpisode[]
): SeriesCompletionRate {
  // Group published episodes by series.
  const seriesPublishedEpisodesMap = new Map<string, PublishedEpisode[]>();
  for (const ep of publishedEpisodes) {
    if (ep.status !== "published") continue;
    const arr = seriesPublishedEpisodesMap.get(ep.seriesSlug) ?? [];
    arr.push(ep);
    seriesPublishedEpisodesMap.set(ep.seriesSlug, arr);
  }

  if (seriesPublishedEpisodesMap.size === 0) {
    return { overall: null, bySeries: [] };
  }

  // Build a set of published episode numbers per series for O(1) lookup.
  const publishedEpisodeNumbersMap = new Map<string, Set<number>>();
  for (const [seriesSlug, eps] of seriesPublishedEpisodesMap) {
    const numbers = new Set(eps.map((ep) => ep.episodeNumber));
    publishedEpisodeNumbersMap.set(seriesSlug, numbers);
  }

  // Track eligible user-series pairs and completed episodes per pair.
  // eligibleBySeries: seriesSlug -> Set of "userId:seriesSlug"
  const eligibleBySeriesMap = new Map<string, Set<string>>();
  // completedEpisodes: "userId:seriesSlug" -> Set of completed episodeNumbers
  const completedEpisodesMap = new Map<string, Set<number>>();

  for (const row of progressRows) {
    if (row.contentType !== "series_episode") continue;
    if (row.seriesSlug === null || row.episodeNumber === null) continue;

    const publishedNumbers = publishedEpisodeNumbersMap.get(row.seriesSlug);
    if (!publishedNumbers || !publishedNumbers.has(row.episodeNumber)) continue;

    const userSeriesKey = `${row.userId}:${row.seriesSlug}`;

    const eligibleSet = eligibleBySeriesMap.get(row.seriesSlug) ?? new Set();
    eligibleSet.add(userSeriesKey);
    eligibleBySeriesMap.set(row.seriesSlug, eligibleSet);

    if (row.completed) {
      const completedSet = completedEpisodesMap.get(userSeriesKey) ?? new Set();
      completedSet.add(row.episodeNumber);
      completedEpisodesMap.set(userSeriesKey, completedSet);
    }
  }

  const bySeries: SeriesCompletionPoint[] = [];
  let totalEligible = 0;
  let totalCompleted = 0;

  for (const [seriesSlug, publishedEps] of seriesPublishedEpisodesMap) {
    const publishedEpisodeCount = publishedEps.length;
    const eligibleSet = eligibleBySeriesMap.get(seriesSlug) ?? new Set();
    const eligible = eligibleSet.size;

    let completed = 0;
    for (const userSeriesKey of eligibleSet) {
      const completedSet = completedEpisodesMap.get(userSeriesKey);
      if (completedSet && completedSet.size === publishedEpisodeCount) {
        completed++;
      }
    }

    const completionRate = eligible === 0 ? null : completed / eligible;

    bySeries.push({
      seriesSlug,
      publishedEpisodeCount,
      eligibleUserSeriesPairs: eligible,
      completedUserSeriesPairs: completed,
      completionRate,
    });

    totalEligible += eligible;
    totalCompleted += completed;
  }

  const overall = totalEligible === 0 ? null : totalCompleted / totalEligible;

  return { overall, bySeries };
}

/**
 * Assemble the full playback telemetry output.
 *
 * Calls computeCompletionRate, computeEpisodeDropoff, and
 * computeSeriesCompletionRate and stamps the result with metadata.
 *
 * @param progressRows - All watch_progress rows.
 * @param publishedEpisodes - CMS episode catalog.
 * @param publishedShortFilms - CMS short film catalog.
 * @returns Derived telemetry payload safe for aggregation/export.
 */
export function buildPlaybackTelemetry(
  progressRows: WatchProgressRow[],
  publishedEpisodes: PublishedEpisode[],
  publishedShortFilms: PublishedShortFilm[]
): PlaybackTelemetryOutput {
  const completionRate = computeCompletionRate(
    progressRows,
    publishedEpisodes,
    publishedShortFilms
  );
  const episodeDropoff = computeEpisodeDropoff(progressRows, publishedEpisodes);
  const seriesCompletionRate = computeSeriesCompletionRate(
    progressRows,
    publishedEpisodes
  );

  return {
    completionRate,
    episodeDropoff,
    seriesCompletionRate,
    generatedAt: Date.now(),
    authority: "DERIVED",
    source: "TELEMETRY",
    caveat: "Historical completeness may be partial.",
  };
}

