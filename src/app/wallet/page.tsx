import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandName } from "@/components/brand/BrandName";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { getUserWallet } from "@/lib/entitlements";
import { getActiveCoinProducts, getUserPaymentOrders, formatOrderStatus } from "@/lib/payments";
import { getUserCoinTransactions } from "@/lib/purchases";
import { createClient } from "@/lib/supabase/server";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default async function WalletPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/wallet");
  }

  const [wallet, coinProducts, coinTransactions, paymentOrders] =
    await Promise.all([
      getUserWallet(user.id),
      getActiveCoinProducts(),
      getUserCoinTransactions(user.id),
      getUserPaymentOrders(user.id),
    ]);

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
        <section className="py-10">
          <div className="border border-bone/10 bg-background px-5 py-8 shadow-[0_0_70px_rgba(13,209,188,0.07)] sm:px-8">
            <BrandName className="text-4xl text-bone" />
            <p className="mt-8 font-mono text-[0.7rem] uppercase tracking-[0.24em] text-teal">
              Wallet
            </p>
            <div className="mt-3 grid gap-8 md:grid-cols-[1fr_15rem] md:items-end">
              <div>
                <h1 className="font-display text-5xl font-light leading-none text-bone">
                  Your coins
                </h1>
                <p className="mt-5 max-w-xl text-sm leading-6 text-muted sm:text-base">
                  Coin top-ups will appear here after verified store or payment
                  provider purchases. This screen is ready for checkout without
                  allowing browser-side wallet credits.
                </p>
              </div>
              <div className="border border-bone/10 bg-bone/[0.03] px-4 py-3">
                <p className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-bone/55">
                  Balance
                </p>
                <p className="mt-1 font-mono text-2xl text-bone">
                  {wallet ? `${wallet.coin_balance} coins` : "0 coins"}
                </p>
              </div>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {coinProducts.length ? (
                coinProducts.map((product) => (
                  <div
                    className="border border-bone/10 bg-bone/[0.03] p-4"
                    key={product.code}
                  >
                    <p className="font-display text-3xl font-light leading-none text-bone">
                      {product.display_name}
                    </p>
                    <p className="mt-2 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-bone/55">
                      {product.coin_amount} coins
                    </p>
                    <Button
                      className="mt-4 w-full"
                      disabled
                      aria-label={`${product.display_name} coming soon`}
                    >
                      Coming soon
                    </Button>
                  </div>
                ))
              ) : (
                <p className="border border-bone/10 bg-bone/[0.03] p-4 text-sm leading-6 text-muted sm:col-span-3">
                  Coin packs will appear after the wallet top-up migration is
                  applied.
                </p>
              )}
            </div>
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <section>
                <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-teal">
                  Recent coin activity
                </h2>
                <div className="mt-3 border-t border-bone/10">
                  {coinTransactions.length ? (
                    coinTransactions.slice(0, 6).map((transaction) => (
                      <div
                        className="flex items-center justify-between gap-4 border-b border-bone/10 py-3"
                        key={transaction.id}
                      >
                        <div>
                          <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-bone/75">
                            {transaction.transaction_type.replace("_", " ")}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            {formatDate(transaction.created_at)}
                          </p>
                        </div>
                        <p className="font-mono text-sm text-bone">
                          {transaction.amount > 0 ? "+" : ""}
                          {transaction.amount}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="py-4 text-sm leading-6 text-muted">
                      No coin activity yet.
                    </p>
                  )}
                </div>
              </section>
              <section>
                <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-teal">
                  Recent top-ups
                </h2>
                <div className="mt-3 border-t border-bone/10">
                  {paymentOrders.length ? (
                    paymentOrders.map((order) => (
                      <div
                        className="flex items-center justify-between gap-4 border-b border-bone/10 py-3"
                        key={order.id}
                      >
                        <div>
                          <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-bone/75">
                            {formatOrderStatus(order)}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            {order.provider.replace("_", " ")} / {formatDate(order.created_at)}
                          </p>
                        </div>
                        <p className="font-mono text-sm text-bone">
                          +{order.coin_amount}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="py-4 text-sm leading-6 text-muted">
                      No top-up orders yet.
                    </p>
                  )}
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
