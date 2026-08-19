import Link from "next/link";
import { BrandName } from "@/components/brand/BrandName";
import { AuthStatus } from "@/components/auth/AuthStatus";
import { Icon } from "@/components/ui/Icon";
import { getUserWallet } from "@/lib/entitlements";
import { createClient } from "@/lib/supabase/server";

const navItems = ["Home", "Browse", "Originals", "New"];

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const phone = user?.phone;
  const wallet = user ? await getUserWallet(user.id) : null;
  const coinBalance = wallet?.coin_balance ?? 0;

  return (
    <header className="sticky top-0 z-40 border-b border-bone/10 bg-background/88 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-7">
          <Link
            href="/"
            className="text-[2rem] text-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal"
          >
            <BrandName />
          </Link>
          <nav aria-label="Primary" className="hidden items-center gap-5 md:flex">
            {navItems.map((item) => (
              <Link
                className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-bone/52 transition hover:text-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal"
                href="/"
                key={item}
              >
                {item}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="grid size-10 place-items-center text-bone/70 transition hover:text-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
            aria-label="Search"
          >
            <Icon name="search" />
          </button>
          {user ? (
            <Link
              href="/wallet"
              className="hidden h-10 items-center gap-2 border border-bone/10 px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-bone/70 transition hover:border-teal/50 hover:text-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal sm:inline-flex"
              aria-label={`Wallet balance ${coinBalance} coins`}
            >
              <Icon name="coin" className="h-4 w-4" />
              {coinBalance}
            </Link>
          ) : null}
          <AuthStatus phone={phone} />
          <Link
            href={phone ? "/" : "/login"}
            className="grid size-9 place-items-center border border-bone/10 bg-bone/[0.04] text-bone/65 transition hover:border-teal/50 hover:text-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
            aria-label={phone ? "Profile" : "Log in"}
          >
            <Icon name="profile" className="h-4.5 w-4.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
