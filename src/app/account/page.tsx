import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/account/actions";
import { BrandName } from "@/components/brand/BrandName";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { getPublishedSeries } from "@/lib/catalog";
import { getUserSubscription, getUserWallet } from "@/lib/entitlements";
import { getUserProfile } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";
import { getContinueWatching, progressToContentItems } from "@/lib/watch-progress";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getMetadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getDisplayName(
  profileName: string | null | undefined,
  metadata: Record<string, unknown>,
  email: string | undefined,
  phone: string | undefined,
) {
  return (
    profileName?.trim() ||
    getMetadataString(metadata, "display_name") ||
    email ||
    phone ||
    "0nya member"
  );
}

function getIdentifier(email: string | undefined, phone: string | undefined) {
  if (phone) {
    return phone;
  }

  if (email) {
    return email;
  }

  return "Signed in";
}

function getSubscriptionLabel(
  subscription: Awaited<ReturnType<typeof getUserSubscription>>,
) {
  if (subscription?.status !== "active") {
    return "No active plan";
  }

  if (subscription.ends_at) {
    return `Active until ${formatDate(subscription.ends_at)}`;
  }

  return "Active plan";
}

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account");
  }

  const [profile, wallet, subscription, catalogItems, progressRows] =
    await Promise.all([
      getUserProfile(user.id),
      getUserWallet(user.id),
      getUserSubscription(user.id),
      getPublishedSeries(),
      getContinueWatching(supabase),
    ]);

  const continueWatching = progressToContentItems(progressRows, catalogItems).slice(0, 3);
  const metadata = user.user_metadata ?? {};
  const displayName = getDisplayName(profile?.display_name, metadata, user.email, user.phone);
  const identifier = getIdentifier(user.email, user.phone);

  return (
    <main className="min-h-screen bg-deep px-4 py-5 text-bone sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100svh-2.5rem)] max-w-5xl flex-col">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-bone/60 transition hover:text-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal"
        >
          <Icon name="back" className="h-4 w-4" />
          Back
        </Link>
        <section className="py-8 sm:py-10">
          <div className="border border-bone/10 bg-background px-5 py-8 shadow-[0_0_70px_rgba(13,209,188,0.07)] sm:px-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <BrandName className="text-4xl text-bone" />
                <p className="mt-8 font-mono text-[0.7rem] uppercase tracking-[0.24em] text-teal">
                  Account
                </p>
                <h1 className="mt-3 break-words font-display text-5xl font-light leading-none text-bone sm:text-6xl">
                  {displayName}
                </h1>
                <p className="mt-4 break-words text-sm leading-6 text-muted sm:text-base">
                  {identifier}
                </p>
              </div>
              <form action={signOut}>
                <Button type="submit" variant="ghost" aria-label="Sign out of 0nya">
                  Sign out
                </Button>
              </form>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Link
                href="/wallet"
                className="border border-bone/10 bg-bone/[0.03] p-4 transition hover:border-teal/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
              >
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-bone/55">
                  Wallet
                </p>
                <p className="mt-2 font-mono text-2xl text-bone">
                  {wallet ? `${wallet.coin_balance} coins` : "0 coins"}
                </p>
              </Link>
              <Link
                href="/plans"
                className="border border-bone/10 bg-bone/[0.03] p-4 transition hover:border-teal/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
              >
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-bone/55">
                  Plan
                </p>
                <p className="mt-2 text-sm leading-6 text-bone/82">
                  {getSubscriptionLabel(subscription)}
                </p>
              </Link>
              <Link
                href="/"
                className="border border-bone/10 bg-bone/[0.03] p-4 transition hover:border-teal/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal sm:col-span-2 lg:col-span-1"
              >
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-bone/55">
                  Continue watching
                </p>
                <p className="mt-2 text-sm leading-6 text-bone/82">
                  {continueWatching.length
                    ? `${continueWatching.length} active title${continueWatching.length === 1 ? "" : "s"}`
                    : "No active episodes"}
                </p>
              </Link>
            </div>

            <section className="mt-9">
              <div className="flex items-center justify-between gap-4">
                <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-teal">
                  Continue watching
                </h2>
                <Link
                  href="/"
                  className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-bone/55 transition hover:text-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                >
                  Browse
                </Link>
              </div>
              <div className="mt-3 border-t border-bone/10">
                {continueWatching.length ? (
                  continueWatching.map((item) => (
                    <Link
                      href={`/watch/${item.slug}/${item.currentEpisode?.replace("Episode ", "") ?? 1}`}
                      className="grid grid-cols-[3.5rem_1fr] gap-4 border-b border-bone/10 py-3 transition hover:border-teal/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                      key={item.id}
                    >
                      <div className="relative aspect-[9/16] overflow-hidden border border-bone/10 bg-bone/[0.04]">
                        <Image
                          src={item.poster}
                          alt=""
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0 self-center">
                        <p className="truncate font-display text-2xl font-light leading-none text-bone">
                          {item.title}
                        </p>
                        <p className="mt-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-bone/55">
                          {item.currentEpisode ?? "Resume"}
                        </p>
                        <div className="mt-3 h-px bg-bone/10">
                          <div
                            className="h-px bg-teal"
                            style={{ width: `${item.progress ?? 0}%` }}
                          />
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <p className="py-4 text-sm leading-6 text-muted">
                    Episodes you start will appear here.
                  </p>
                )}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
