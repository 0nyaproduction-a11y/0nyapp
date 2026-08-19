import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { accountPath } from "@/lib/routes";

const items = [
  { label: "Home", icon: "home", href: "/", active: true },
  { label: "Browse", icon: "browse", href: "/", active: false },
  { label: "Search", icon: "search", href: "/", active: false },
  { label: "Profile", icon: "profile", href: accountPath, active: false },
] as const;

export function MobileBottomNav() {
  return (
    <nav
      aria-label="Mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-bone/10 bg-background/92 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md md:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-4">
        {items.map((item) => (
          <Link
            href={item.href}
            key={item.label}
            className={`flex flex-col items-center gap-1 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.1em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${
              item.active ? "text-teal" : "text-bone/45 hover:text-bone/75"
            }`}
            aria-current={item.active ? "page" : undefined}
          >
            <Icon name={item.icon} className="h-5 w-5" />
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
