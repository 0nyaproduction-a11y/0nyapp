import { LEGAL_PAGE_CONFIGS } from "@/lib/legal-content";
import { LegalPageShell, LegalSection, LegalFooterNav } from "@/components/legal/LegalPageShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use — 0nya",
  description: LEGAL_PAGE_CONFIGS.terms.description,
};

export default function TermsPage() {
  const config = LEGAL_PAGE_CONFIGS.terms;

  return (
    <LegalPageShell label={config.label} title={config.title}>
      <p className="text-sm leading-6 text-muted">
        These are the terms that govern your use of the 0nya app and service.
      </p>
      <div>
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-bone/80">
          Contents
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm leading-6 text-muted">
          {config.sections.map((section) => (
            <li key={section.id}>{section.heading}</li>
          ))}
        </ul>
      </div>
      {config.sections.map((section) => (
        <LegalSection key={section.id} id={section.id} heading={section.heading}>
          {section.body}
        </LegalSection>
      ))}
      <LegalFooterNav />
    </LegalPageShell>
  );
}
