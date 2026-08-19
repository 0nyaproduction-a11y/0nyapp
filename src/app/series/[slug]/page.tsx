import { notFound } from "next/navigation";
import { contentItems, getSeriesBySlug } from "@/data/content";
import { Header } from "@/components/layout/Header";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { EpisodeList } from "@/components/series/EpisodeList";
import { SeriesHero } from "@/components/series/SeriesHero";

type SeriesPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return contentItems.map((series) => ({ slug: series.slug }));
}

export default async function SeriesPage({ params }: SeriesPageProps) {
  const { slug } = await params;
  const series = getSeriesBySlug(slug);

  if (!series) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background text-bone">
      <Header />
      <main>
        <SeriesHero series={series} />
        <EpisodeList series={series} />
      </main>
      <MobileBottomNav />
    </div>
  );
}
