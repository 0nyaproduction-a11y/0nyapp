"use client";

import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { CmsEmptyState } from "@/components/cms/CmsStates";
import { EpisodeMetadataForm } from "@/components/cms/EpisodeMetadataForm";
import { formatDuration } from "@/lib/cms/video-intake";
import { buildAccessSummary, type EpisodeRow } from "@/lib/cms/constants";
import type { EpisodeFormState } from "@/lib/cms/episode-form";
import Link from "next/link";

type MediaReadiness = {
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
  totalCount: number;
  filteredCount: number;
  page: number;
  pageSize: number;
  hasPrevious: boolean;
  hasNext: boolean;
  seriesId: string;
};

const EPISODE_STATUS_STYLES: Record<string, string> = {
  draft: "text-bone/50 border-bone/20",
  published: "text-teal border-teal/50",
  archived: "text-bone/30 border-bone/10",
};

export function SeriesEpisodeManager({
  addEpisodeHref,
  bulkUploadHref,
  rows,
  totalCount,
  filteredCount,
  page,
  pageSize,
  hasPrevious,
  hasNext,
  seriesId,
}: SeriesEpisodeManagerProps) {
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);

  const selectedRow = rows.find((row) => row.episode.id === selectedEpisodeId) ?? null;

  useEffect(() => {
    if (!selectedEpisodeId) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedEpisodeId(null);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedEpisodeId]);

  function buildEpisodeUrl(pageNum: number): string {
    const sp = new URLSearchParams();
    sp.set("page", String(pageNum));
    if (pageSize !== 25) sp.set("pageSize", String(pageSize));
    return `/admin/series/${seriesId}?${sp.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ButtonLink href={addEpisodeHref}>Add episode</ButtonLink>
          <ButtonLink href={bulkUploadHref} variant="secondary">
            Upload batch
          </ButtonLink>
        </div>
        <div className="text-sm text-bone/70">
          {filteredCount} {filteredCount === 1 ? "match" : "matches"} of {totalCount}
        </div>
      </div>

      <div className="divide-y divide-bone/10 border border-bone/10">
        {rows.length === 0 ? (
          <CmsEmptyState
            title="No episodes match"
            description="Adjust search or filters to find episodes."
          />
        ) : (
          rows.map((row) => {
            const episode = row.episode;
            const accessSummary = buildAccessSummary(episode);
            const isSelected = selectedEpisodeId === episode.id;

            return (
              <div
                key={episode.id}
                className={`flex items-center justify-between gap-4 px-4 py-4 transition hover:bg-bone/[0.03] ${
                  isSelected ? "bg-bone/[0.06]" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <p className="font-medium">Episode {episode.episode_number}</p>
                    <span
                      className={`border px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] ${
                        EPISODE_STATUS_STYLES[episode.status] ?? EPISODE_STATUS_STYLES.draft
                      }`}
                    >
                      {episode.status}
                    </span>
                    {!episode.is_free && (
                      <span className="text-xs text-bone/60">
                        {accessSummary}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-bone/50">
                    {episode.title ?? "Untitled"} · {formatDuration(episode.duration_seconds)} · Updated {new Date(episode.updated_at).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <ButtonLink href={row.fullPageHref} variant="secondary">
                    Edit
                  </ButtonLink>
                  <button
                    type="button"
                    onClick={() => setSelectedEpisodeId(episode.id)}
                    className="inline-flex min-h-11 items-center justify-center gap-2 border border-bone/10 bg-bone/[0.03] px-4 py-3 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/80 transition hover:border-bone/25 hover:text-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                  >
                    Access
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {rows.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-bone/60">
            Page {page} of {Math.max(1, Math.ceil(filteredCount / pageSize))}
          </p>
          <div className="flex gap-2">
            {hasPrevious ? (
              <Link
                href={buildEpisodeUrl(page - 1)}
                className="inline-flex min-h-11 items-center justify-center gap-2 border border-bone/20 bg-bone/[0.03] px-4 py-3 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/80 transition hover:border-bone/25 hover:text-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
              >
                Previous
              </Link>
            ) : (
              <span className="inline-flex min-h-11 items-center justify-center gap-2 border border-bone/10 bg-bone/[0.03] px-4 py-3 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/30">
                Previous
              </span>
            )}
            {hasNext ? (
              <Link
                href={buildEpisodeUrl(page + 1)}
                className="inline-flex min-h-11 items-center justify-center gap-2 border border-teal/70 bg-transparent px-4 py-3 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-teal transition hover:border-teal hover:bg-teal/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
              >
                Next
              </Link>
            ) : (
              <span className="inline-flex min-h-11 items-center justify-center gap-2 border border-bone/10 bg-bone/[0.03] px-4 py-3 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-bone/30">
                Next
              </span>
            )}
          </div>
        </div>
      )}

      {selectedRow && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <div className="my-8 max-h-[calc(100vh-4rem)] w-full max-w-3xl overflow-y-auto rounded-lg bg-deep p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Episode {selectedRow.episode.episode_number} — Access</h3>
              <button
                type="button"
                onClick={() => setSelectedEpisodeId(null)}
                className="text-bone/50 hover:text-bone"
              >
                ✕
              </button>
            </div>
            <EpisodeMetadataForm
              episode={selectedRow.episode}
              action={selectedRow.action}
              onSaved={() => setSelectedEpisodeId(null)}
              submitLabel="Save"
            />
          </div>
        </div>
      )}
    </div>
  );
}
