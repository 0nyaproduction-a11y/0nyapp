import Link from "next/link";
import { BrandName } from "@/components/brand/BrandName";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { getUserSubscription } from "@/lib/entitlements";
import { createClient } from "@/lib/supabase/server";

function formatSubscriptionEnd(endsAt: string | null) {
  if (!endsAt) {
    return "No renewal date";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(endsAt));
}

export default async function PlansPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const subscription = user ? await getUserSubscription(user.id) : null;
  const hasActivePlan = subscription?.status === "active";

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
        <section className="grid flex-1 place-items-center py-10">
          <div className="w-full max-w-xl border border-bone/10 bg-background px-5 py-8 text-center shadow-[0_0_70px_rgba(13,209,188,0.07)] sm:px-8">
            <BrandName className="text-4xl text-bone" />
            <p className="mt-8 font-mono text-[0.7rem] uppercase tracking-[0.24em] text-teal">
              Membership
            </p>
            <h1 className="mt-3 font-display text-5xl font-light leading-none text-bone">
              0nya Plans
            </h1>
            <p className="mx-auto mt-5 max-w-md text-sm leading-6 text-muted sm:text-base">
              Subscription access will be available here soon, with a restrained
              plan experience built for premium vertical cinema.
            </p>
            <div className="mx-auto mt-6 max-w-sm border border-bone/10 bg-bone/[0.03] px-4 py-3">
              <p className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-bone/55">
                Current plan
              </p>
              <p className="mt-1 text-sm leading-6 text-bone/82">
                {hasActivePlan
                  ? `${subscription.plan_code ?? "Active plan"} / ${formatSubscriptionEnd(subscription.ends_at)}`
                  : user
                    ? "No active plan"
                    : "Sign in to view"}
              </p>
            </div>
            <div className="mt-7">
              <Button disabled aria-label="Plans coming soon">
                Coming soon
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
