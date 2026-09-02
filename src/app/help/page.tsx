import { LEGAL_PAGE_CONFIGS } from "@/lib/legal-content";
import { LegalPageShell, LegalSection, LegalFooterNav } from "@/components/legal/LegalPageShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Help & Support — 0nya",
  description: LEGAL_PAGE_CONFIGS.help.description,
};

export default function HelpPage() {
  const config = LEGAL_PAGE_CONFIGS.help;

  return (
    <LegalPageShell label={config.label} title={config.title}>
      <p className="text-sm leading-6 text-muted">
        Get help with the 0nya app.
      </p>
      {config.sections.map((section) => (
        <LegalSection key={section.id} id={section.id} heading={section.heading}>
          {section.body}
        </LegalSection>
      ))}
      <LegalFooterNav />
    </LegalPageShell>
  );
}
