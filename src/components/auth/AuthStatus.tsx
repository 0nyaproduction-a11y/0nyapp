import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

type AuthStatusProps = {
  isAuthenticated: boolean;
  phone?: string;
};

export function AuthStatus({ isAuthenticated, phone }: AuthStatusProps) {
  if (!isAuthenticated) {
    return (
      <Link
        href="/account"
        className="hidden h-10 items-center gap-2 border border-bone/10 px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-bone/70 transition hover:border-teal/50 hover:text-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal sm:inline-flex"
      >
        Account
      </Link>
    );
  }

  return (
    <Link
      href="/account"
      aria-label="Account"
      className="hidden h-10 items-center gap-2 border border-bone/10 px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-bone/70 transition hover:border-teal/50 hover:text-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal sm:inline-flex"
    >
      <Icon name="profile" className="h-4 w-4" />
      {phone ? phone.slice(-4) : "Account"}
    </Link>
  );
}
