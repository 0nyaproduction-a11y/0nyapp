import Image from "next/image";
import type { ContentItem } from "@/data/content";
import { Icon } from "@/components/ui/Icon";

type ContentCardProps = {
  item: ContentItem;
  priority?: boolean;
};

export function ContentCard({ item, priority = false }: ContentCardProps) {
  return (
    <article className="group w-[39vw] max-w-[176px] min-w-[136px] sm:w-[176px] md:w-[212px] lg:w-[232px] xl:w-[244px]">
      <div
        className="relative aspect-[9/16] overflow-hidden border border-bone/10 bg-surface"
        style={{ "--card-accent": item.accent } as React.CSSProperties}
      >
        <Image
          src={item.poster}
          alt={`${item.title} poster`}
          fill
          priority={priority}
          sizes="(max-width: 640px) 39vw, (max-width: 768px) 176px, (max-width: 1024px) 212px, (max-width: 1280px) 232px, 244px"
          className="object-cover opacity-80 transition duration-500 group-hover:scale-[1.03] group-hover:opacity-95 motion-reduce:transition-none"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,5,4,0.04)_0%,rgba(3,5,4,0.1)_48%,rgba(3,5,4,0.86)_100%)]" />
        <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,var(--card-accent),transparent_62%)] opacity-30" />
        <div className="absolute left-2 top-2 flex items-center gap-1">
          <span className="border border-bone/10 bg-black/60 px-1.5 py-1 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-bone/85 sm:text-[0.58rem]">
            {item.format}
          </span>
          {item.isLocked ? (
            <span className="grid size-6 place-items-center border border-bone/10 bg-black/55 text-bone/80">
              <Icon name="lock" className="h-3.5 w-3.5" />
            </span>
          ) : null}
        </div>
        <button
          className="absolute right-2 top-2 grid size-7 place-items-center border border-bone/10 bg-black/45 text-bone/70 transition hover:text-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
          type="button"
          aria-label={`More information about ${item.title}`}
        >
          <Icon name="info" className="h-4 w-4" />
        </button>
        <div className="absolute inset-x-0 bottom-0 p-3">
          <h3 className="line-clamp-2 font-display text-[1.35rem] font-light leading-[0.95] text-bone sm:text-2xl">
            {item.title}
          </h3>
          <p className="mt-1.5 font-mono text-[0.64rem] uppercase tracking-[0.11em] text-bone/76 sm:text-[0.62rem]">
            {item.currentEpisode ?? `${item.episodes} episodes`}
          </p>
          {typeof item.progress === "number" ? (
            <div
              className="mt-2.5 h-[3px] bg-bone/18"
              aria-label={`${item.progress}% watched`}
            >
              <div
                className="h-full bg-teal shadow-[0_0_10px_rgba(13,209,188,0.28)]"
                style={{ width: `${item.progress}%` }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
