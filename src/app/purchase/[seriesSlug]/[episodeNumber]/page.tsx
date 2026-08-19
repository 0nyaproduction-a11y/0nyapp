import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  getEpisode as getMockEpisode,
  getSeriesBySlug as getMockSeriesBySlug,
} from "@/data/content";
import { BrandName } from "@/components/brand/BrandName";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { buyEpisodeWithCoins } from "@/app/purchase/actions";
import { getEpisodeBySeriesSlugAndNumber } from "@/lib/catalog";
import {
  hasActiveSubscription,
  userOwnsEpisode,
  getUserWallet,
} from "@/lib/entitlements";
import { createClient } from "@/lib/supabase/server";

type PurchasePageProps = {
  params: Promise<{ seriesSlug: string; episodeNumber: string }>;
  searchParams: Promise<{ purchase?: string }>;
};

function getPurchaseMessage(status?: string) {
  switch (status) {
    case "purchase_success":
      return "Episode unlocked. You can watch it now.";
    case "insufficient_balance":
      return "Insufficient coins.";
    case "already_owned":
      return "Episode already unlocked.";
    case "active_subscription":
      return "Your active plan already includes this episode.";
    case "already_accessible":
      return "This episode is already available.";
    case "not_authenticated":
      return "Sign in to buy this episode.";
    case "invalid_episode":
    case "purchase_failed":
      return "Purchase is not available right now.";
    default:
      return null;
  }
}

export default async function PurchasePage({
  params,
  searchParams,
}: PurchasePageProps) {
  const { seriesSlug, episodeNumber } = await params;
  const { purchase } = await searchParams;
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
  const [wallet, hasSubscription, ownsEpisode] = user
    ? await Promise.all([
        getUserWallet(user.id),
        hasActiveSubscription(user.id),
        episode.id ? userOwnsEpisode(user.id, episode.id) : Promise.resolve(false),
      ])
    : [null, false, false];
  const coinPrice = episode.coinPrice ?? 0;
  const hasEnoughCoins = Boolean(wallet && wallet.coin_balance >= coinPrice);
  const canBuyWithCoins =
    Boolean(user) &&
    Boolean(episode.id) &&
    !ownsEpisode &&
    !hasSubscription &&
    coinPrice > 0 &&
    hasEnoughCoins;
  const purchaseMessage = getPurchaseMessage(purchase);

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
              Use coins to unlock this episode. Add-coin purchases are coming
              later, so access changes only after a successful coin transaction.
            </p>
            <div className="mx-auto mt-6 max-w-xs border border-bone/10 bg-bone/[0.03] px-4 py-3">
              <p className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-bone/55">
                Coin balance
              </p>
              <p className="mt-1 font-mono text-lg text-bone">
                {wallet ? `${wallet.coin_balance} coins` : "Sign in to view"}
              </p>
              <p className="mt-3 font-mono text-[0.66rem] uppercase tracking-[0.16em] text-bone/55">
                Episode price
              </p>
              <p className="mt-1 font-mono text-lg text-bone">
                {coinPrice > 0 ? `${coinPrice} coins` : "Coming soon"}
              </p>
            </div>
            {purchaseMessage ? (
              <p className="mx-auto mt-5 max-w-md border border-bone/10 bg-bone/[0.03] px-3 py-2 text-sm leading-6 text-bone/80">
                {purchaseMessage}
              </p>
            ) : null}
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {ownsEpisode || hasSubscription ? (
                <ButtonLink href={episodeHref} aria-label={`Watch episode ${episode.number}`}>
                  Watch episode
                </ButtonLink>
              ) : user && coinPrice > 0 && !hasEnoughCoins ? (
                <ButtonLink href="/wallet" aria-label="Add coins">
                  Add coins
                </ButtonLink>
              ) : (
                <form action={buyEpisodeWithCoins}>
                  <input name="episodeId" type="hidden" value={episode.id ?? ""} />
                  <input
                    name="returnTo"
                    type="hidden"
                    value={`/purchase/${series.slug}/${episode.number}`}
                  />
                  <Button
                    aria-label={`Buy episode ${episode.number} with coins`}
                    className="w-full"
                    disabled={!canBuyWithCoins}
                    type="submit"
                  >
                    Buy with coins
                  </Button>
                </form>
              )}
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
