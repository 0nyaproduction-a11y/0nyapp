import type { ContentItem } from "@/data/content";
import { ContentCard } from "@/components/content/ContentCard";

type ContentRowProps = {
  title: string;
  kicker?: string;
  items: ContentItem[];
};

export function ContentRow({ title, kicker, items }: ContentRowProps) {
  return (
    <section className="content-band py-4 sm:py-5" aria-labelledby={`${title}-heading`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-2.5 flex items-end justify-between gap-4">
          <div>
            {kicker ? (
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-teal/80 sm:text-[0.64rem]">
                {kicker}
              </p>
            ) : null}
            <h2
              id={`${title}-heading`}
              className="font-display text-2xl font-light leading-none text-bone sm:text-3xl"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            className="hidden border-b border-bone/20 pb-1 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-bone/60 transition hover:border-teal hover:text-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal sm:inline-flex"
          >
            View all
          </button>
        </div>
      </div>
      <div className="scrollbar-none flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:gap-4 sm:px-6 lg:px-[max(2rem,calc((100vw-80rem)/2+2rem))]">
        {items.map((item, index) => (
          <div className="snap-start" key={item.id}>
            <ContentCard item={item} priority={index < 2} />
          </div>
        ))}
      </div>
    </section>
  );
}
