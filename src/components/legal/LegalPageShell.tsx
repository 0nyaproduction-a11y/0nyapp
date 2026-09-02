import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { LEGAL_PAGE_LINKS } from "@/lib/legal-content";

function renderBrandText(content: React.ReactNode): React.ReactNode {
  if (typeof content !== "string") {
    return content;
  }

  const parts = content.split(/(0nya)/g);

  return parts.map((part, index) =>
    part === "0nya" ? (
      <span key={`${part}-${index}`} className="text-teal font-brand">
        0nya
      </span>
    ) : (
      part
    ),
  );
}

export type LegalPageShellProps = {
  label: string;
  title: string;
  statusNote?: string;
  children: React.ReactNode;
};

export function LegalPageShell({ label, title, statusNote, children }: LegalPageShellProps) {
  return (
    <main className="min-h-screen bg-deep px-4 py-5 text-bone sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100svh-2.5rem)] max-w-3xl flex-col">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-bone/60 transition hover:text-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal"
        >
          <Icon name="back" className="h-4 w-4" />
          Back
        </Link>
        <section className="py-10">
          <div className="border border-bone/10 bg-background px-5 py-8 shadow-[0_0_70px_rgba(13,209,188,0.07)] sm:px-8">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-teal">
              {label}
            </p>
            <h1 className="mt-3 font-display text-4xl font-light leading-none text-bone sm:text-5xl">
              {renderBrandText(title)}
            </h1>
            {statusNote ? (
              <p className="mt-5 border border-bone/10 bg-bone/[0.03] px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-bone/70">
                {statusNote}
              </p>
            ) : null}
            <div className="mt-6 space-y-8">{children}</div>
          </div>
        </section>
      </div>
    </main>
  );
}

export type LegalSectionProps = {
  id?: string;
  heading: string;
  children: React.ReactNode;
};

export function LegalSection({ id, heading, children }: LegalSectionProps) {
  return (
    <section id={id}>
      <h2 className="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-teal">
        {renderBrandText(heading)}
      </h2>
      <div className="mt-3 text-sm leading-6 text-muted">
        {renderBrandText(children)}
      </div>
    </section>
  );
}

export function LegalFooterNav() {
  return (
    <nav
      aria-label="Legal pages"
      className="border-t border-bone/10 mt-8"
    >
      <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-bone/60 mb-3">
        Related legal pages
      </p>
      <div className="space-y-2">
        {LEGAL_PAGE_LINKS.map((page) => (
          <Link
            key={page.href}
            href={page.href}
            className="flex items-center justify-between font-mono text-[0.66rem] uppercase tracking-[0.12em] text-bone/70 transition hover:text-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal"
          >
            <span>{page.label}</span>
            <span className="text-xs text-muted normal-case font-normal">
              {page.description}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
