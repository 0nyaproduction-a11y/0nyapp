import {
  continueWatching,
  featuredSeries,
  newReleases,
  startHere,
  trending,
} from "@/data/content";
import { ContentRow } from "@/components/content/ContentRow";
import { FeaturedHero } from "@/components/home/FeaturedHero";
import { Header } from "@/components/layout/Header";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import {
  getFeaturedSeries,
  getMockOrCatalogRows,
  getPublishedSeries,
} from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import { getContinueWatching, progressToContentItems } from "@/lib/watch-progress";

export async function HomePage() {
  const [catalogFeaturedSeries, catalogSeries, supabase] = await Promise.all([
    getFeaturedSeries(),
    getPublishedSeries(),
    createClient(),
  ]);
  const catalogItems = getMockOrCatalogRows(catalogSeries);
  const savedProgress = await getContinueWatching(supabase);
  const savedContinueWatching = progressToContentItems(savedProgress, catalogItems);
  const featuredItem = catalogFeaturedSeries ?? featuredSeries;
  const continueWatchingItems = savedContinueWatching.length
    ? savedContinueWatching
    : continueWatching;
  const startHereItems = catalogSeries.length ? catalogItems.slice(0, 6) : startHere;
  const trendingItems = catalogSeries.length ? catalogItems.slice(1, 7) : trending;
  const newReleaseItems = catalogSeries.length
    ? catalogItems.toReversed().slice(0, 6)
    : newReleases;

  return (
    <div className="min-h-screen bg-background text-bone">
      <Header />
      <main>
        <FeaturedHero item={featuredItem} />
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
