import { ContentRow } from "@/components/content/ContentRow";
import { FeaturedHero } from "@/components/home/FeaturedHero";
import { Header } from "@/components/layout/Header";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { getFeaturedSeries, getPublishedSeries, getPublishedShortFilms } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import { getContinueWatching, progressToContentItems } from "@/lib/watch-progress";

export async function HomePage() {
  const [catalogFeaturedSeries, catalogSeries, catalogShortFilms, supabase] = await Promise.all([
    getFeaturedSeries(),
    getPublishedSeries(),
    getPublishedShortFilms(),
    createClient(),
  ]);
  const savedProgress = await getContinueWatching(supabase);
  const savedContinueWatching = progressToContentItems(
    savedProgress,
    catalogSeries,
    catalogShortFilms,
  );
  const continueWatchingItems = savedContinueWatching;
  const startHereItems = catalogSeries.slice(0, 6);
  const trendingItems = catalogSeries.slice(1, 7);
  const newReleaseItems = catalogSeries.toReversed().slice(0, 6);

  return (
    <div className="min-h-screen bg-background text-bone">
      <Header />
      <main>
        {catalogFeaturedSeries ? (
          <FeaturedHero item={catalogFeaturedSeries} />
        ) : (
          <section className="border-b border-bone/10 px-4 py-16 sm:px-6 lg:px-8">
            <div className="mx-auto flex min-h-[40vh] max-w-7xl items-center">
              <div className="max-w-2xl space-y-4">
                <p className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-teal/85">
                  Featured premiere
                </p>
                <h1 className="font-display text-5xl font-light leading-tight text-bone sm:text-6xl">
                  No published editorial content yet.
                </h1>
                <p className="text-base leading-7 text-muted sm:text-lg">
                  Published series will appear here once they are available.
                </p>
              </div>
            </div>
          </section>
        )}
        <ContentRow
          title="Continue Watching"
          kicker="Resume"
          items={continueWatchingItems}
        />
        <ContentRow title="Start Here" kicker="0nya essentials" items={startHereItems} />
        <ContentRow title="Trending" kicker="Tonight in India" items={trendingItems} />
        <ContentRow title="New Releases" kicker="Fresh episodes" items={newReleaseItems} />
      </main>
      <MobileBottomNav />
    </div>
  );
}
