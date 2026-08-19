import Link from "next/link";
import type { ContentItem, Episode } from "@/data/content";
import { BrandName } from "@/components/brand/BrandName";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

type LockedEpisodeProps = {
  series: ContentItem;
  episode: Episode;
  isAuthenticated?: boolean;
};

export function LockedEpisode({
  series,
  episode,
  isAuthenticated = false,
}: LockedEpisodeProps) {
  const loginHref = `/login?next=${encodeURIComponent(
    `/watch/${series.slug}/${episode.number}`,
  )}`;

  return (
    <main className="min-h-screen bg-deep px-4 py-5 text-bone sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100svh-2.5rem)] max-w-5xl flex-col">
        <Link
          href={`/series/${series.slug}`}
          className="inline-flex w-fit items-center gap-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-bone/60 transition hover:text-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal"
        >
          <Icon name="back" className="h-4 w-4" />
          Back to series
        </Link>
        <section className="grid flex-1 place-items-center py-10">
          <div className="w-full max-w-xl border border-bone/10 bg-background px-5 py-8 text-center shadow-[0_0_70px_rgba(13,209,188,0.07)] sm:px-8">
            <BrandName className="text-4xl text-bone" />
            <div className="mx-auto mt-8 grid size-14 place-items-center border border-bone/10 text-teal">
              <Icon name="lock" className="h-6 w-6" />
            </div>
            <p className="mt-6 font-mono text-[0.7rem] uppercase tracking-[0.24em] text-teal">
              Continue watching
            </p>
            <h1 className="mt-3 font-display text-5xl font-light leading-none text-bone">
              Episode {episode.number} is waiting for you.
            </h1>
            <p className="mx-auto mt-5 max-w-md text-sm leading-6 text-muted sm:text-base">
              The first 3 episodes are free. Continue the story by unlocking
              this episode or get unlimited access with 0nya.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {isAuthenticated ? (
                <>
                  <Button aria-label="Unlock episode placeholder">
                    Unlock episode
                  </Button>
                  <Button variant="secondary" aria-label="View plans placeholder">
                    View plans
                  </Button>
                </>
              ) : (
                <>
                  <ButtonLink href={loginHref} aria-label="Log in to unlock episode">
                    Unlock episode
                  </ButtonLink>
                  <ButtonLink
                    href={loginHref}
                    variant="secondary"
                    aria-label="Log in to view plans"
                  >
                    View plans
                  </ButtonLink>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
