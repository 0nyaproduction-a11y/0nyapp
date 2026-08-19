"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { createClient } from "@/lib/supabase/client";

type AuthStatusProps = {
  phone?: string;
};

export function AuthStatus({ phone }: AuthStatusProps) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.push("/");
  }

  if (!phone) {
    return (
      <a
        href="/login"
        className="hidden h-10 items-center gap-2 border border-bone/10 px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-bone/70 transition hover:border-teal/50 hover:text-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal sm:inline-flex"
      >
        Account
      </a>
    );
  }

  return (
    <button
      aria-label="Log out"
      className="hidden h-10 items-center gap-2 border border-bone/10 px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-bone/70 transition hover:border-teal/50 hover:text-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal sm:inline-flex"
      onClick={handleLogout}
      type="button"
    >
      <Icon name="profile" className="h-4 w-4" />
      {phone.slice(-4)}
    </button>
  );
}
