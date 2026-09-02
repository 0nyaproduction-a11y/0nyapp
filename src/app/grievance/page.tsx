import { LEGAL_PAGE_CONFIGS } from "@/lib/legal-content";
import { LegalPageShell, LegalSection, LegalFooterNav } from "@/components/legal/LegalPageShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Grievance Officer — 0nya",
  description: LEGAL_PAGE_CONFIGS.grievance.description,
};

export default function GrievancePage() {
  const config = LEGAL_PAGE_CONFIGS.grievance;

  return (
    <LegalPageShell label={config.label} title={config.title}>
      <p className="text-sm leading-6 text-muted">
        Contact the 0nya Grievance Officer with complaints or concerns about the service.
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
