// Centralized configuration/content for public legal, help, compliance,
// and account-deletion surfaces.
//
// Identity and approved legal/business values are centralized here so they
// never diverge across pages, footers, or Android link building.
//
// MISSING fields would previously have been represented as pending markers.
// All required identity fields are now filled with approved values below.

export type LegalPageKey =
  | "privacy"
  | "terms"
  | "help"
  | "grievance"
  | "reportContent"
  | "deleteAccount";

export type LegalSectionContent = {
  id: string;
  heading: string;
  body: string;
};

export type LegalPageConfig = {
  key: LegalPageKey;
  path: string;
  label: string;
  title: string;
  description: string;
  sections: LegalSectionContent[];
};

// ---------------------------------------------------------------------------
// Approved identity constants
// ---------------------------------------------------------------------------

export const brandName = "0nya";

export const companyLegalName = "0NYA PRIVATE LIMITED";

export const registeredOffice =
  "A 321, 3rd Floor, Master Mind 4 Royal Palms, Aareymilk Colony, Goregaon East, Mumbai - 400065, Maharashtra, India";

export const grievanceOfficerName = "Jitesh Pathak";

export const supportEmail = "support@0nya.com";

export const privacyEmail = "privacy@0nya.com";

export const grievanceEmail = "grievance@0nya.com";

export const jurisdiction = "India (Maharashtra, Mumbai)";

export const DELETE_ACCOUNT_PATH = "/delete-account";

// ---------------------------------------------------------------------------
// Section content for each legal page
// ---------------------------------------------------------------------------

export const LEGAL_PAGE_CONFIGS: Record<LegalPageKey, LegalPageConfig> = {
  privacy: {
    key: "privacy",
    path: "/privacy",
    label: "Privacy",
    title: "Privacy Policy",
    description: "How 0nya collects, uses, and protects your personal data.",
    sections: [
      {
        id: "organization",
        heading: "Organization Identity",
        body: `${companyLegalName} ("0nya", "we", "us") is the data controller for this website and mobile app. Our registered office is at ${registeredOffice}.`,
      },
      {
        id: "collect",
        heading: "Data Categories & Collection Sources",
        body: "We collect the information you provide directly: waitlist email addresses, optional phone numbers for WhatsApp updates, and filmmaker submission details such as contact information, project links, and story notes. We also receive limited technical data automatically (device type, browser, IP address) for security and analytics.",
      },
      {
        id: "purposes",
        heading: "Purposes of Processing",
        body: "We use information to manage early access, contact waitlist members, review filmmaker submissions, respond to questions, and improve the 0nya launch experience. We process data based on the performance of our agreement with you, our legitimate interests in operating and improving 0nya, and where required, your consent.",
      },
      {
        id: "sharing",
        heading: "Service Providers & Processors",
        body: "We do not sell personal information. We may use trusted infrastructure providers to host the website, store submissions, send operational messages, and protect the platform. All processors are contractually bound to protect your data.",
      },
      {
        id: "analytics",
        heading: "Analytics & Advertising",
        body: "We do not use third-party advertising or tracking cookies on this launch website. Analytics is limited to essential infrastructure monitoring.",
      },
      {
        id: "billing",
        heading: "Billing & Order Data",
        body: "Payment and order data is processed by our payment providers. We store the minimum information needed to record and audit transactions. We do not store full payment card details ourselves.",
      },
      {
        id: "security",
        heading: "Security & Fraud",
        body: "We process information to detect and prevent fraud, abuse, and unauthorized access to our services.",
      },
      {
        id: "retention",
        heading: "Data Retention",
        body: "We retain information for as long as necessary to fulfill the purposes described in this policy, unless a longer retention period is required by law.",
      },
      {
        id: "deletion",
        heading: "Account Deletion & Data Retained After Deletion",
        body: `You can request account deletion through the in-app authenticated flow at ${DELETE_ACCOUNT_PATH} or by emailing ${privacyEmail}. In-app deletion removes your account-linked personal and product data via a server-side Supabase admin delete. Some de-identified or pseudonymous records required for legal, accounting, or security obligations may be retained where applicable, but no invented numeric retention period applies. Payment and transaction records necessary for financial compliance are also retained where required.`,
      },
      {
        id: "rights",
        heading: "User Rights & Process",
        body: `You have the right to access, correct, or delete your information. You may also object to processing and withdraw consent where consent is relied upon. To exercise these rights, contact us at ${privacyEmail}.`,
      },
      {
        id: "children",
        heading: "Children & Minors",
        body: "0nya is not intended for children under 18. We do not knowingly collect personal information from children under 18. If we become aware of such collection, we will delete the information promptly.",
      },
      {
        id: "international",
        heading: "International Processing",
        body: "Your data may be processed in India and in other countries where our infrastructure providers operate. We take reasonable steps to ensure your data is protected.",
      },
      {
        id: "changes",
        heading: "Policy Changes",
        body: "We may update this policy. Changes will be posted on this page with an updated effective date.",
      },
      {
        id: "contact",
        heading: "Grievance & Privacy Contact",
        body: `For privacy questions, data requests, or account deletion requests, contact ${privacyEmail}. The Grievance Officer is ${grievanceOfficerName}, reachable at ${grievanceEmail}.`,
      },
    ],
  },

  terms: {
    key: "terms",
    path: "/terms",
    label: "Terms",
    title: "Terms of Use",
    description: "Terms governing use of the 0nya app and service.",
    sections: [
      {
        id: "eligibility",
        heading: "Service Eligibility",
        body: `These terms are governed by ${companyLegalName}. You must be at least 18 years old and of legal age in your jurisdiction to use this website or submit content.`,
      },
      {
        id: "account",
        heading: "Account Rules",
        body: "You are responsible for maintaining the security of your account. You must notify us immediately of any unauthorized use of your account or any other breach of security.",
      },
      {
        id: "license",
        heading: "Content Licence & Viewing Rights",
        body: "You keep ownership of your submitted work. 0nya owns its brand, website, design, copy, platform systems, and original materials unless otherwise stated. The platform grants you a limited, non-exclusive licence to view content for personal, non-commercial use.",
      },
      {
        id: "coins",
        heading: "Coins & Permanent Unlocks",
        body: "Coins are a virtual currency for unlocking content within 0nya. Coins have no cash value, are non-transferable outside the platform, and do not expire while the service is active. We may modify the coin system with reasonable notice.",
      },
      {
        id: "plus",
        heading: "0nya Plus",
        body: "0nya Plus is a subscription tier that unlocks additional content and features. Subscriptions are billed in advance and renew automatically unless cancelled. No refunds are provided for partial periods unless required by law.",
      },
      {
        id: "billing",
        heading: "Billing & Renewal",
        body: "You are responsible for any applicable taxes. Payment providers handle billing for subscriptions and coin packs. 0nya does not store full payment card details.",
      },
      {
        id: "chai",
        heading: "Chai Coin Tipping",
        body: "Viewers may send chai (coin tips) directly to creators. Chai is non-refundable, non-transferable, and has no cash value. Creators receive chai according to the platform's revenue model.",
      },
      {
        id: "prohibited",
        heading: "Prohibited Misuse",
        body: "You agree to use 0nya honestly, lawfully, and without attempting to disrupt the site, misuse forms, or interfere with other users or creators.",
      },
      {
        id: "ip",
        heading: "Content & IP",
        body: "When you submit a project, you confirm that you have the rights needed to share it with 0nya for editorial review. Submission does not guarantee selection, publication, payment, or distribution.",
      },
      {
        id: "support",
        heading: "User Support",
        body: `For support, contact ${supportEmail}. We will respond to questions and concerns reasonably but do not guarantee resolution of every issue.`,
      },
      {
        id: "termination",
        heading: "Account Suspension & Termination",
        body: "0nya may restrict or end access to the website or submission process if there is misuse, unlawful activity, or conduct that harms the platform or community.",
      },
      {
        id: "disclaimer",
        heading: "Disclaimers",
        body: "The website is provided as-is while 0nya prepares for launch. Features, timelines, policies, and availability may change before the platform goes live. We do not warrant that the service will be uninterrupted or error-free.",
      },
      {
        id: "liability",
        heading: "Limitation of Liability",
        body: "To the fullest extent permitted by law, 0nya shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of data or profits, arising out of or in connection with your use of the website. Our total liability for any claim shall not exceed the amount you paid us in the 12 months preceding the claim.",
      },
      {
        id: "governing-law",
        heading: "Governing Law & Dispute Terms",
        body: `These terms are governed by the laws of ${jurisdiction}, without regard to conflict of law principles. Any dispute arising under these terms shall be subject to the exclusive jurisdiction of the courts in Mumbai, India.`,
      },
      {
        id: "contact",
        heading: "Contact",
        body: `Contact us at ${supportEmail} or visit ${registeredOffice}.`,
      },
    ],
  },

  help: {
    key: "help",
    path: "/help",
    label: "Support",
    title: "Help & Support",
    description: "Get help with the 0nya app.",
    sections: [
      {
        id: "getting-started",
        heading: "Getting Started",
        body: "0nya is India's premium vertical cinema platform. You can join the waitlist with your email to get early access, or filmmakers can submit vertical short films for editorial review.",
      },
      {
        id: "waitlist",
        heading: "Joining the Waitlist",
        body: "Enter your email on the 0nya website and optionally provide a phone number for WhatsApp launch updates. You can unsubscribe from updates at any time via the link in each email.",
      },
      {
        id: "submitting",
        heading: "Submitting Your Film",
        body: "Filmmakers can submit vertical-format projects through the submission form on our website. Include project links, contact details, and any story notes. Review does not guarantee selection or publication.",
      },
      {
        id: "watching",
        heading: "Watching on 0nya",
        body: "Once the platform launches, vertical stories are designed for full-screen phone viewing. No account is needed to browse the catalog when access is open.",
      },
      {
        id: "technical",
        heading: "Technical Support",
        body: "If something isn't working, try refreshing your browser or checking your connection. For account-specific help, contact support@0nya.com.",
      },
      {
        id: "contact",
        heading: "Contact Support",
        body: `Email ${supportEmail} for questions about the waitlist, submissions, or using 0nya.`,
      },
    ],
  },

  grievance: {
    key: "grievance",
    path: "/grievance",
    label: "Grievance",
    title: "Grievance Officer",
    description: "Contact the 0nya Grievance Officer.",
    sections: [
      {
        id: "officer",
        heading: "Grievance Officer",
        body: `The Grievance Officer for 0nya is ${grievanceOfficerName}.`,
      },
      {
        id: "contact",
        heading: "Contact Information",
        body: `Email: ${grievanceEmail}. Postal: ${companyLegalName}, ${registeredOffice}.`,
      },
      {
        id: "scope",
        heading: "What We Handle",
        body: "We acknowledge complaints about content, user conduct, or platform issues. We will acknowledge receipt and respond within a reasonable time.",
      },
      {
        id: "removal",
        heading: "Content Takedown",
        body: "If content violates our policies or applicable law, we will remove it and notify the affected party where appropriate.",
      },
      {
        id: "gov",
        heading: "Governing Law",
        body: `This grievance process is governed by the laws of ${jurisdiction}, under the Information Technology Act, 2000, and the courts of Mumbai.`,
      },
    ],
  },

  reportContent: {
    key: "reportContent",
    path: "/report-content",
    label: "Report",
    title: "Report Content Issue",
    description: "Report content on 0nya that violates the terms.",
    sections: [
      {
        id: "reporting",
        heading: "How to Report",
        body: `To report content that you believe violates our policies or applicable law, email ${grievanceEmail} with the subject line "Content Report".`,
      },
      {
        id: "details",
        heading: "What to Include",
        body: "Please provide the URL or location of the content, a description of the issue, and why you believe it should be reviewed. More detail helps us respond quickly.",
      },
      {
        id: "review",
        heading: "What Happens Next",
        body: "We will acknowledge your report and review it promptly. If the content violates our policies or applicable law, we will take appropriate action, which may include removal or restriction of access.",
      },
      {
        id: "confidentiality",
        heading: "Confidentiality",
        body: "We handle reports confidentially. Where possible, we will not disclose your identity to the person who posted the content being reported.",
      },
      {
        id: "alternative",
        heading: "Alternative Contact",
        body: `If you cannot use email, you may also send written notices to our registered office: ${registeredOffice}.`,
      },
    ],
  },

  deleteAccount: {
    key: "deleteAccount",
    path: DELETE_ACCOUNT_PATH,
    label: "Delete Account",
    title: "Delete Account",
    description: "Request permanent deletion of your 0nya account.",
    sections: [],
  },
};

export const LEGAL_PAGE_ORDER: LegalPageKey[] = [
  "privacy",
  "terms",
  "help",
  "grievance",
  "reportContent",
  "deleteAccount",
];

export const LEGAL_PAGE_LINKS = LEGAL_PAGE_ORDER.map((key) => ({
  label: LEGAL_PAGE_CONFIGS[key].label,
  href: LEGAL_PAGE_CONFIGS[key].path,
  description: LEGAL_PAGE_CONFIGS[key].description,
}));

export const PENDING_LEGAL_COPY_MARKER = "FINAL LEGAL COPY REQUIRED";
export const PENDING_BACKEND_MARKER = "REPORT SUBMISSION BACKEND REQUIRED";
export const PENDING_CONTACT_MARKER = "APPROVED CONTACT REQUIRED";
