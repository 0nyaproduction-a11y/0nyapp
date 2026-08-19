import { BrandName } from "@/components/brand/BrandName";
import { Icon } from "@/components/ui/Icon";

const navItems = ["Home", "Browse", "Originals", "New"];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-bone/10 bg-background/88 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-7">
          <a
            href="#home"
            className="text-[2rem] text-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal"
          >
            <BrandName />
          </a>
          <nav aria-label="Primary" className="hidden items-center gap-5 md:flex">
            {navItems.map((item) => (
              <a
                className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-bone/52 transition hover:text-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal"
                href="#home"
                key={item}
              >
                {item}
              </a>
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
          <button
            type="button"
            className="hidden h-10 items-center gap-2 border border-bone/10 px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-bone/70 transition hover:border-teal/50 hover:text-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal sm:inline-flex"
            aria-label="Coin balance"
          >
            <Icon name="coin" className="h-4 w-4" />
            120
          </button>
          <button
            type="button"
            className="grid size-9 place-items-center border border-bone/10 bg-bone/[0.04] text-bone/65 transition hover:border-teal/50 hover:text-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
            aria-label="Profile"
          >
            <Icon name="profile" className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
