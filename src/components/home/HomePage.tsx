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

export function HomePage() {
  return (
    <div className="min-h-screen bg-background text-bone">
      <Header />
      <main>
        <FeaturedHero item={featuredSeries} />
        <ContentRow
          title="Continue Watching"
          kicker="Resume"
          items={continueWatching}
        />
        <ContentRow title="Start Here" kicker="0nya essentials" items={startHere} />
        <ContentRow title="Trending" kicker="Tonight in India" items={trending} />
        <ContentRow title="New Releases" kicker="Fresh episodes" items={newReleases} />
      </main>
      <MobileBottomNav />
    </div>
  );
}
