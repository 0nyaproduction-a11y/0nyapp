import type { ContentItem } from "@/data/content";
import { EpisodeCard } from "@/components/series/EpisodeCard";

type EpisodeListProps = {
  series: ContentItem;
};

export function EpisodeList({ series }: EpisodeListProps) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-6 sm:py-8 md:pb-12 lg:px-8">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-teal/80">
            Episodes
          </p>
          <h2 className="font-display text-3xl font-light leading-none text-bone">
            Start watching
          </h2>
        </div>
        <p className="hidden max-w-xs text-right font-mono text-[0.66rem] uppercase tracking-[0.12em] text-bone/48 sm:block">
          First 3 episodes are free
        </p>
      </div>
      <div>
        {series.episodes.map((episode) => (
          <EpisodeCard episode={episode} key={episode.number} series={series} />
        ))}
      </div>
    </section>
  );
}
