import Image from "next/image";
import type { ContentItem } from "@/data/content";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

type FeaturedHeroProps = {
  item: ContentItem;
};

export function FeaturedHero({ item }: FeaturedHeroProps) {
  return (
    <section
      id="home"
      className="relative overflow-hidden border-b border-bone/10"
      aria-labelledby="featured-title"
    >
      <div className="absolute inset-0 opacity-35">
        <Image
          src={item.poster}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,5,0.55),#030504_82%)]" />
      </div>
      <div className="relative mx-auto grid min-h-[calc(100svh-4rem)] max-w-7xl items-center gap-8 px-4 pb-10 pt-6 sm:px-6 md:min-h-[650px] md:grid-cols-[minmax(280px,0.86fr)_minmax(340px,1fr)] md:py-10 lg:px-8">
        <div className="mx-auto w-full max-w-[330px] md:order-2 md:max-w-[360px] lg:max-w-[390px]">
          <div className="relative aspect-[9/16] overflow-hidden border border-bone/10 bg-soft shadow-[0_0_80px_rgba(13,209,188,0.1)]">
            <Image
              src={item.poster}
              alt={`${item.title} featured artwork`}
              fill
              priority
              sizes="(max-width: 768px) 86vw, 430px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,5,4,0.08)_0%,rgba(3,5,4,0.18)_45%,rgba(3,5,4,0.82)_100%)]" />
            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
              <p className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-bone/76 sm:text-[0.62rem]">
                Vertical original
              </p>
              <span className="border border-teal/60 px-2 py-1 font-mono text-[0.64rem] uppercase tracking-[0.12em] text-teal sm:text-[0.6rem]">
                9:16
              </span>
            </div>
          </div>
        </div>
        <div className="max-w-2xl text-center md:text-left">
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-teal/85 sm:text-[0.66rem]">
            Featured premiere
          </p>
          <h1
            id="featured-title"
            className="mt-3 font-display text-6xl font-light leading-[0.88] text-bone sm:text-7xl lg:text-8xl"
          >
            {item.title}
          </h1>
          <p className="mt-4 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-bone/68 sm:text-[0.66rem]">
            {item.genre} / {item.format} / {item.episodeCount} episodes / {item.episodeDuration}
          </p>
          <p className="mx-auto mt-5 max-w-xl text-base font-light leading-7 text-muted md:mx-0 md:text-lg">
            {item.synopsis}
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center md:justify-start">
            <ButtonLink
              href={`/watch/${item.slug}/1`}
              className="w-full sm:w-auto"
              aria-label={`Watch ${item.title} now`}
            >
              <Icon name="play" className="h-4 w-4 fill-current" />
              Watch now
            </ButtonLink>
            <ButtonLink
              href={`/series/${item.slug}`}
              variant="secondary"
              className="w-full sm:w-auto"
              aria-label={`More information about ${item.title}`}
            >
              <Icon name="info" className="h-4 w-4" />
              Info
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
