"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CmsSelect } from "@/components/cms/CmsSelect";
import { EpisodeMetadataForm } from "@/components/cms/EpisodeMetadataForm";
import { formatDuration } from "@/lib/cms/video-intake";
import { buildAccessSummary, type EpisodeRow } from "@/lib/cms/constants";
import type { EpisodeFormState } from "@/lib/cms/episode-form";

type MediaReadiness = {
  preview: string;
  video: string;
};

type EpisodeReviewRow = {
  action: (state: EpisodeFormState, formData: FormData) => Promise<EpisodeFormState>;
  episode: EpisodeRow;
  fullPageHref: string;
  mediaReadiness: MediaReadiness;
};

type SeriesEpisodeManagerProps = {
  addEpisodeHref: string;
  bulkUploadHref: string;
  rows: EpisodeReviewRow[];
};

const inputClassName =
  "w-full border border-bone/15 bg-bone/[0.03] px-3 py-2 text-sm text-bone placeholder:text-bone/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal [color-scheme:dark]";
const labelClassName = "font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50";
const pageSize = 25;

const EPISODE_STATUS_STYLES: Record<string, string> = {
  draft: "text-bone/50 border-bone/20",
  published: "text-teal border-teal/50",
  archived: "text-bone/30 border-bone/10",
};

function filterEpisodeRow(row: EpisodeReviewRow, query: string, statusFilter: string, mediaFilter: string) {
  const normalizedQuery = query.trim().toLowerCase();
  const episode = row.episode;

  if (normalizedQuery) {
    const searchable = `${episode.episode_number} ${episode.title ?? ""}`.toLowerCase();
    if (!searchable.includes(normalizedQuery)) {
      return false;
    }
  }

  if (statusFilter !== "all" && episode.status !== statusFilter) {
    return false;
  }

  if (mediaFilter !== "all") {
    const mediaStatus = row.mediaReadiness.video.toLowerCase();

    if (mediaFilter === "missing") {
      if (mediaStatus !== "not assigned") {
        return false;
      }
    } else if (mediaFilter === "processing") {
      if (mediaStatus !== "processing" && mediaStatus !== "pending") {
        return false;
      }
    } else if (mediaStatus !== mediaFilter) {
      return false;
    }
  }

  return true;
}

export function SeriesEpisodeManager({ addEpisodeHref, bulkUploadHref, rows }: SeriesEpisodeManagerProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [mediaFilter, setMediaFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);

  const filteredRows = useMemo(
    () => rows.filter((row) => filterEpisodeRow(row, query, statusFilter, mediaFilter)),
    [mediaFilter, query, rows, statusFilter],
  );

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selectedRow = rows.find((row) => row.episode.id === selectedEpisodeId) ?? null;
  const selectedIndex = rows.findIndex((row) => row.episode.id === selectedEpisodeId);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset pagination when filters change.
    setPage(1);
  }, [mediaFilter, query, statusFilter]);

  useEffect(() => {
    if (!selectedEpisodeId || selectedRow) {
      return;
    }

    // The previously selected episode no longer exists in the current rows
    // (e.g. it was deleted) — close the modal instead of opening a different one.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Close stale selection after rows update.
    setSelectedEpisodeId(null);
  }, [selectedEpisodeId, selectedRow]);

  useEffect(() => {
    if (page > pageCount) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Clamp pagination after row count changes.
      setPage(pageCount);
    }
  }, [page, pageCount]);

  useEffect(() => {
    if (!selectedEpisodeId) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedEpisodeId(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedEpisodeId]);

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.total += 1;
        acc[row.episode.status as "draft" | "published" | "archived"] += 1;
        return acc;
      },
      { total: 0, draft: 0, published: 0, archived: 0 },
    );
  }, [rows]);

  function openEpisode(episodeId: string) {
    setSelectedEpisodeId(episodeId);
  }

  function closeEpisode() {
    setSelectedEpisodeId(null);
  }

  function advanceToNextEpisode() {
    if (selectedIndex < 0) {
      closeEpisode();
      return;
    }

    const nextRow = rows[selectedIndex + 1];
    if (nextRow) {
      setSelectedEpisodeId(nextRow.episode.id);
      return;
    }

    closeEpisode();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 border border-bone/10 bg-bone/[0.03] p-4 sm:grid-cols-4">
        <div>
          <p className={labelClassName}>Episodes</p>
          <p className="mt-1 text-lg font-semibold">{summary.total}</p>
        </div>
        <div>
          <p className={labelClassName}>Draft</p>
          <p className="mt-1 text-lg font-semibold">{summary.draft}</p>
        </div>
        <div>
          <p className={labelClassName}>Published</p>
          <p className="mt-1 text-lg font-semibold">{summary.published}</p>
        </div>
        <div>
          <p className={labelClassName}>Archived</p>
          <p className="mt-1 text-lg font-semibold">{summary.archived}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-56 flex-1 space-y-1.5">
          <span className={labelClassName}>Search</span>
          <input
            className={inputClassName}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Episode number or title"
          />
        </label>

        <label className="block min-w-40 space-y-1.5">
          <span className={labelClassName}>Status</span>
          <CmsSelect
            className={inputClassName}
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { label: "All", value: "all" },
              { label: "Draft", value: "draft" },
              { label: "Published", value: "published" },
              { label: "Archived", value: "archived" },
            ]}
          />
        </label>

        <label className="block min-w-44 space-y-1.5">
          <span className={labelClassName}>Media</span>
          <CmsSelect
            className={inputClassName}
            value={mediaFilter}
            onChange={setMediaFilter}
            options={[
              { label: "All", value: "all" },
              { label: "Ready", value: "ready" },
              { label: "Processing", value: "processing" },
              { label: "Failed", value: "failed" },
              { label: "Missing", value: "missing" },
            ]}
          />
        </label>

        <div className="relative">
          <details className="group relative">
            <summary className="list-none cursor-pointer border border-teal/70 bg-transparent px-4 py-3 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-teal transition hover:border-teal hover:bg-teal/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal">
              Add episodes
            </summary>
            <div className="absolute right-0 z-10 mt-2 w-56 border border-bone/10 bg-deep p-2 shadow-xl">
              <div className="space-y-2">
                <ButtonLink href={bulkUploadHref} variant="secondary" className="w-full justify-start">
                  Upload batch
                </ButtonLink>
                <ButtonLink href={addEpisodeHref} variant="secondary" className="w-full justify-start">
                  Add single episode
                </ButtonLink>
              </div>
            </div>
          </details>
        </div>
      </div>

      <div className="space-y-3">
        {filteredRows.length === 0 ? (
          <p className="border border-bone/10 bg-bone/[0.03] px-4 py-6 text-sm text-bone/60">No episodes match the current filters.</p>
        ) : (
          <>
            {visibleRows.map((row) => (
              <article key={row.episode.id} className="border border-bone/10 bg-bone/[0.03] p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">
                        EP {String(row.episode.episode_number).padStart(2, "0")}
                        {row.episode.title ? ` — ${row.episode.title}` : ""}
                      </p>
                      <span
                        className={`border px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] ${EPISODE_STATUS_STYLES[row.episode.status] ?? EPISODE_STATUS_STYLES.draft}`}
                      >
                        {row.episode.status}
                      </span>
                    </div>
                    <p className="text-sm text-bone/65">
                      Duration: {formatDuration(row.episode.duration_seconds)} · Media: {row.mediaReadiness.video} · Access:{" "}
                      {buildAccessSummary(row.episode)}
                    </p>
                    <p className="text-xs text-bone/45">Preview clip: {row.mediaReadiness.preview}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => openEpisode(row.episode.id)}>
                      Configure access
                    </Button>
                    <ButtonLink href={row.fullPageHref} variant="ghost">
                      Full episode editor
                    </ButtonLink>
                  </div>
                </div>
              </article>
            ))}

            {pageCount > 1 && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-bone/60">
                  Page {currentPage} of {pageCount}
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage <= 1}>
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                    disabled={currentPage >= pageCount}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selectedRow && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 py-6 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="episode-configure-title"
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden border border-bone/10 bg-deep shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-bone/10 px-5 py-4">
              <div>
                <p className={labelClassName}>Quick configure access &amp; metadata</p>
                <h3 id="episode-configure-title" className="mt-1 text-xl font-semibold">
                  EP {String(selectedRow.episode.episode_number).padStart(2, "0")}
                  {selectedRow.episode.title ? ` — ${selectedRow.episode.title}` : ""}
                </h3>
                <p className="mt-1 text-sm text-bone/60">
                  Status: {selectedRow.episode.status} · Media: {selectedRow.mediaReadiness.video} · Access:{" "}
                  {buildAccessSummary(selectedRow.episode)}
                </p>
              </div>
              <Button variant="ghost" onClick={closeEpisode}>
                Close
              </Button>
            </div>

            <div className="max-h-[calc(90vh-5rem)] overflow-y-auto px-5 py-5">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border border-teal/25 bg-teal/[0.06] px-4 py-3">
                  <p className="text-sm text-bone/75">
                    This panel is scoped to quick access and metadata configuration. For Media,
                    Thumbnail, Status and advanced controls, open the full episode editor.
                  </p>
                  <ButtonLink href={selectedRow.fullPageHref} variant="secondary">
                    Open full episode editor
                  </ButtonLink>
                </div>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div>
                    <EpisodeMetadataForm
                      key={selectedRow.episode.id}
                      action={selectedRow.action}
                      episode={selectedRow.episode}
                      onSaved={(state) => {
                        if (state.submitMode === "save-and-next") {
                          advanceToNextEpisode();
                        }
                      }}
                      secondarySubmitLabel="Save & Next"
                      secondarySubmitValue="save-and-next"
                      submitLabel="Save"
                    />
                  </div>

                  <aside className="space-y-4 border border-bone/10 bg-bone/[0.03] p-4">
                    <div>
                      <p className={labelClassName}>Summary</p>
                      <dl className="mt-2 space-y-2 text-sm text-bone/70">
                        <div className="flex justify-between gap-4">
                          <dt>Duration</dt>
                          <dd className="text-bone">{formatDuration(selectedRow.episode.duration_seconds)}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt>Media video</dt>
                          <dd className="text-bone">{selectedRow.mediaReadiness.video}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt>Preview clip</dt>
                          <dd className="text-bone">{selectedRow.mediaReadiness.preview}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt>Access</dt>
                          <dd className="text-bone">{buildAccessSummary(selectedRow.episode)}</dd>
                        </div>
                      </dl>
                    </div>

                    <div className="space-y-2">
                      <p className={labelClassName}>Full episode editor</p>
                      <div className="flex flex-col gap-2">
                        <p className="text-sm text-bone/60">
                          Media, Thumbnail, Status and advanced controls.
                        </p>
                        <ButtonLink href={selectedRow.fullPageHref} variant="ghost">
                          Open full episode page
                        </ButtonLink>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            const nextRow = rows[selectedIndex + 1];
                            if (nextRow) {
                              setSelectedEpisodeId(nextRow.episode.id);
                            }
                          }}
                          disabled={selectedIndex < 0 || selectedIndex >= rows.length - 1}
                        >
                          Next episode
                        </Button>
                      </div>
                    </div>
                  </aside>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
