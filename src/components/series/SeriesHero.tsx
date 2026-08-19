import Image from "next/image";
import type { ContentItem } from "@/data/content";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

type SeriesHeroProps = {
  series: ContentItem;
};

export function SeriesHero({ series }: SeriesHeroProps) {
  return (
    <section className="relative overflow-hidden border-b border-bone/10">
      <div className="absolute inset-0 opacity-20">
        <Image
          src={series.poster}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,5,0.7),#030504_88%)]" />
      </div>
      <div className="relative mx-auto grid max-w-7xl gap-8 px-4 pb-8 pt-7 sm:px-6 md:grid-cols-[minmax(240px,360px)_1fr] md:items-end md:gap-12 md:pb-12 md:pt-12 lg:px-8">
        <div className="mx-auto w-full max-w-[310px] md:mx-0 md:max-w-[340px]">
          <div className="relative aspect-[9/16] overflow-hidden border border-bone/10 bg-soft shadow-[0_0_70px_rgba(13,209,188,0.08)]">
            <Image
              src={series.poster}
              alt={`${series.title} poster`}
              fill
              priority
              sizes="(max-width: 768px) 82vw, 340px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,5,4,0.04),rgba(3,5,4,0.78))]" />
            <span className="absolute bottom-4 left-4 border border-teal/60 px-2 py-1 font-mono text-[0.64rem] uppercase tracking-[0.12em] text-teal">
              9:16
            </span>
          </div>
        </div>
        <div className="max-w-3xl text-center md:text-left">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-teal/85">
            {series.format} / {series.genre}
          </p>
          <h1 className="mt-3 font-display text-6xl font-light leading-[0.88] text-bone sm:text-7xl lg:text-8xl">
            {series.title}
          </h1>
          <p className="mt-4 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-bone/68">
            {series.episodeCount} episodes / {series.episodeDuration}
          </p>
          <p className="mx-auto mt-5 max-w-2xl text-base font-light leading-7 text-muted md:mx-0 md:text-lg">
            {series.synopsis}
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center md:justify-start">
            <ButtonLink
              href={`/watch/${series.slug}/1`}
              className="w-full sm:w-auto"
              aria-label={`Watch episode 1 of ${series.title}`}
            >
              <Icon name="play" className="h-4 w-4 fill-current" />
              Watch episode 1
            </ButtonLink>
            <ButtonLink href="/" variant="ghost" className="w-full sm:w-auto">
              <Icon name="back" className="h-4 w-4" />
              Back home
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
