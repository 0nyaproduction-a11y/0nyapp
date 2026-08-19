import Link from "next/link";
import type { ContentItem, Episode } from "@/data/content";
import { Icon } from "@/components/ui/Icon";
import type { EpisodeAccessState } from "@/lib/entitlements";

type EpisodeCardProps = {
  series: ContentItem;
  episode: Episode;
  access?: EpisodeAccessState;
};

export function EpisodeCard({ series, episode, access }: EpisodeCardProps) {
  const episodeAccess =
    access ??
    (episode.isFree
      ? ({ canWatch: true, kind: "free", label: "Free" } satisfies EpisodeAccessState)
      : ({ canWatch: false, kind: "locked", label: "Locked" } satisfies EpisodeAccessState));
  const isLocked = !episodeAccess.canWatch;
  const isFree = episodeAccess.kind === "free";

  return (
    <Link
      href={`/watch/${series.slug}/${episode.number}`}
      className="group grid gap-4 border-t border-bone/10 py-4 transition hover:border-teal/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal sm:grid-cols-[5rem_1fr_auto] sm:items-center"
    >
      <div className="flex items-center justify-between gap-3 sm:block">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-teal/80">
          Episode {episode.number}
        </p>
        <span
          className={`inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[0.62rem] uppercase tracking-[0.12em] ${
            isFree
              ? "border-teal/45 text-teal"
              : episodeAccess.canWatch
                ? "border-teal/25 text-bone/82"
                : "border-bone/10 text-bone/58"
          }`}
        >
          {isLocked ? <Icon name="lock" className="h-3.5 w-3.5" /> : null}
          {episodeAccess.label}
        </span>
      </div>
      <div>
        <h3 className="font-display text-2xl font-light leading-none text-bone transition group-hover:text-teal sm:text-3xl">
          {episode.title}
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted sm:text-base">
          {episode.description}
        </p>
        {typeof episode.progress === "number" ? (
          <div className="mt-3 h-[3px] max-w-sm bg-bone/14">
            <div
              className="h-full bg-teal shadow-[0_0_10px_rgba(13,209,188,0.25)]"
              style={{ width: `${episode.progress}%` }}
            />
          </div>
        ) : null}
      </div>
      <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-bone/60">
        {episode.runtime}
      </p>
    </Link>
  );
}
