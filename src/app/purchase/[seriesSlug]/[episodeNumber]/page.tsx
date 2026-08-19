import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  getEpisode as getMockEpisode,
  getSeriesBySlug as getMockSeriesBySlug,
} from "@/data/content";
import { BrandName } from "@/components/brand/BrandName";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { getEpisodeBySeriesSlugAndNumber } from "@/lib/catalog";
import { getUserWallet } from "@/lib/entitlements";
import { createClient } from "@/lib/supabase/server";

type PurchasePageProps = {
  params: Promise<{ seriesSlug: string; episodeNumber: string }>;
};

export default async function PurchasePage({ params }: PurchasePageProps) {
  const { seriesSlug, episodeNumber } = await params;
  const parsedEpisodeNumber = Number(episodeNumber);
  const catalogResult = Number.isInteger(parsedEpisodeNumber)
    ? await getEpisodeBySeriesSlugAndNumber(seriesSlug, parsedEpisodeNumber)
    : null;
  const mockSeries = getMockSeriesBySlug(seriesSlug);
  const mockEpisode = Number.isInteger(parsedEpisodeNumber)
    ? getMockEpisode(seriesSlug, parsedEpisodeNumber)
    : undefined;
  const series = catalogResult?.series ?? mockSeries;
  const episode = catalogResult?.episode ?? mockEpisode;

  if (!series || !episode) {
    notFound();
  }

  const episodeHref = `/watch/${series.slug}/${episode.number}`;

  if (episode.isFree) {
    redirect(episodeHref);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const wallet = user ? await getUserWallet(user.id) : null;

  return (
    <main className="min-h-screen bg-deep px-4 py-5 text-bone sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100svh-2.5rem)] max-w-5xl flex-col">
        <Link
          href={episodeHref}
          className="inline-flex w-fit items-center gap-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-bone/60 transition hover:text-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal"
        >
          <Icon name="back" className="h-4 w-4" />
          Back to episode
        </Link>
        <section className="grid flex-1 place-items-center py-10">
          <div className="w-full max-w-xl border border-bone/10 bg-background px-5 py-8 text-center shadow-[0_0_70px_rgba(13,209,188,0.07)] sm:px-8">
            <BrandName className="text-4xl text-bone" />
            <p className="mt-8 font-mono text-[0.7rem] uppercase tracking-[0.24em] text-teal">
              {series.title} / Episode {episode.number}
            </p>
            <h1 className="mt-3 font-display text-5xl font-light leading-none text-bone">
              Unlock this episode
            </h1>
            <p className="mx-auto mt-5 max-w-md text-sm leading-6 text-muted sm:text-base">
              Episode purchase will be available here soon. This preview keeps
              the story locked while the purchase experience is prepared.
            </p>
            <div className="mx-auto mt-6 max-w-xs border border-bone/10 bg-bone/[0.03] px-4 py-3">
              <p className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-bone/55">
                Coin balance
              </p>
              <p className="mt-1 font-mono text-lg text-bone">
                {wallet ? `${wallet.coin_balance} coins` : "Sign in to view"}
              </p>
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <Button disabled aria-label="Purchase coming soon">
                Coming soon
              </Button>
              {/* Rewarded-ad entitlements must be granted only after trusted server-side ad verification. */}
              <Button disabled variant="secondary" aria-label="Rewarded ad unlock coming soon">
                Watch ad to unlock
              </Button>
              <ButtonLink
                className="sm:col-span-2"
                href={episodeHref}
                variant="secondary"
                aria-label={`Back to episode ${episode.number}`}
              >
                Back to episode
              </ButtonLink>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
