import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { EpisodeList } from "@/components/series/EpisodeList";
import { SeriesHero } from "@/components/series/SeriesHero";
import { getPublishedSeries, getSeriesBySlug } from "@/lib/catalog";
import { getEpisodeAccessStates } from "@/lib/entitlements";
import { createClient } from "@/lib/supabase/server";

type SeriesPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const publishedSeries = await getPublishedSeries();

  return publishedSeries.map((series) => ({ slug: series.slug }));
}

export default async function SeriesPage({ params }: SeriesPageProps) {
  const { slug } = await params;
  const series = await getSeriesBySlug(slug);

  if (!series) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const episodeAccess = await getEpisodeAccessStates(
    user?.id ?? null,
    series.episodes,
    supabase,
  );

  return (
    <div className="min-h-screen bg-background text-bone">
      <Header />
      <main>
        <SeriesHero series={series} />
        <EpisodeList episodeAccess={episodeAccess} series={series} />
      </main>
      <MobileBottomNav />
    </div>
  );
}
