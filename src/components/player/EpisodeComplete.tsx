import type { ContentItem, Episode } from "@/data/content";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

type EpisodeCompleteProps = {
  series: ContentItem;
  nextEpisode?: Episode;
};

export function EpisodeComplete({ series, nextEpisode }: EpisodeCompleteProps) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/84 px-6 text-center">
      <div className="max-w-sm">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.24em] text-teal">
          Episode complete
        </p>
        <h2 className="mt-3 font-display text-4xl font-light leading-none text-bone">
          {nextEpisode ? `Next: Episode ${nextEpisode.number}` : "Series caught up"}
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          {nextEpisode
            ? nextEpisode.title
            : "You have reached the end of this mock episode list."}
        </p>
        <div className="mt-6 flex flex-col gap-3">
          {nextEpisode ? (
            <ButtonLink href={`/watch/${series.slug}/${nextEpisode.number}`}>
              <Icon name="next" className="h-4 w-4" />
              Watch next
            </ButtonLink>
          ) : null}
          <ButtonLink href={`/series/${series.slug}`} variant="secondary">
            Back to series
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
