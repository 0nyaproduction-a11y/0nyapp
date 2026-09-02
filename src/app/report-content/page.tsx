import { LEGAL_PAGE_CONFIGS } from "@/lib/legal-content";
import { LegalPageShell, LegalSection, LegalFooterNav } from "@/components/legal/LegalPageShell";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Report Content Issue — 0nya",
  description: LEGAL_PAGE_CONFIGS.reportContent.description,
};

export default function ReportContentPage() {
  const config = LEGAL_PAGE_CONFIGS.reportContent;

  return (
    <LegalPageShell label={config.label} title={config.title}>
      <p className="text-sm leading-6 text-muted">
        Report content on 0nya that you believe violates the terms.
      </p>
      {config.sections.map((section) => (
        <LegalSection key={section.id} id={section.id} heading={section.heading}>
          {section.body}
        </LegalSection>
      ))}

      <LegalSection id="quick-report" heading="Quick Report">
        You can also report content directly via email. Include as much detail as possible so we
        can respond promptly. For the full Grievance Officer contact details, see{" "}
        <Link
          href="/grievance"
          className="text-teal underline underline-offset-2 hover:text-bone"
        >
          the Grievance page
        </Link>
        .
      </LegalSection>

      <LegalFooterNav />
    </LegalPageShell>
  );
}
