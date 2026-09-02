// Foundation design tokens sourced from the verified 0nya web design system
// (src/app/globals.css) and aligned to docs/0nya_DESIGN_SYSTEM_v1.0.md §3–§11.
// Existing tokens are preserved for backward-compatibility.
// Typography tokens now follow the restrained Quiet Cinema scale (§7).

export const colors = {
  // ── Core brand ──────────────────────────────────────────────
  // web --background (src/app/globals.css)
  background: "#050505",
  // web --deep (src/app/globals.css)
  backgroundDeep: "#030504",
  // web --soft (src/app/globals.css)
  backgroundSoft: "#071414",
  // design-system §4 color.bg.secondary
  backgroundSecondary: "#0b0b0b",
  // design-system §4 color.bg.elevated
  bgElevated: "#111111",
  // web --surface (src/app/globals.css)
  surface: "#1a1a1a",
  // web --foreground / --bone (src/app/globals.css)
  text: "#e8e4da",
  // web --muted (src/app/globals.css)
  muted: "#a0a0a0",
  // design-system §4 color.text.secondary (~72% bone)
  textSecondary: "rgba(232,228,218,0.72)",
  // design-system §4 color.text.muted (~52% bone)
  textMuted: "rgba(232,228,218,0.52)",
  // design-system §4 color.text.disabled (~32% bone)
  textDisabled: "rgba(232,228,218,0.32)",
  // web --teal / design-system §3 0nya Teal
  accent: "#0dd1bc",
  // design-system §3 Teal Highlight (#4DE5D2)
  accentHighlight: "#4de5d2",
  // design-system §4 color.accent.onPrimary (text on teal buttons)
  accentOnPrimary: "#050505",
  // actual rendered web border value (Tailwind `border-bone/10`)
  border: "rgba(232, 228, 218, 0.10)",
  // design-system §4 color.border.subtle
  borderSubtle: "rgba(232,228,218,0.12)",
  // design-system §4 color.border.strong
  borderStrong: "rgba(232,228,218,0.22)",
  // design-system §4 color.surface.selected (teal tint)
  surfaceSelected: "rgba(13,209,188,0.10)",
  // design-system §4 color.surface.pressed (bone tint)
  surfacePressed: "rgba(232,228,218,0.08)",
  // design-system §4 color.bg.overlay
  overlay: "rgba(0,0,0,0.72)",
  // existing app semantic error tone (previously hardcoded in shared UI)
  error: "#ff8d76",
} as const;

// ── Spacing ────────────────────────────────────────────────────
// design-system §9: 4pt base with 8pt rhythm.
// Existing cardPadding kept for backward-compatibility.
export const spacing = {
  // matches existing Android Card padding and web card/tile padding (p-4/p-5)
  cardPadding: 16,
  // Semantic scale
  xs:   4,
  sm:   8,
  md:   12,
  base: 16,
  lg:   20,
  xl:   24,
  xxl:  32,
  xxxl: 40,
} as const;

// ── Radii ──────────────────────────────────────────────────────
// design-system §11: restrained set.
// Posters: 8–12. Primary buttons: 12–14. Sheets: 20–24.
export const radii = {
  // web design language uses square corners for some elements; keep for existing uses
  none: 0,
  xs:   6,
  sm:   8,
  md:   12,
  lg:   16,
  sheet: 22,
  pill: 999,
} as const;

// ── Typography ─────────────────────────────────────────────────
// design-system §7: Display 30–34 / H1 26–28 / H2 ~22 / H3 18–20
// / Body 15–16 / Label 14 / Caption 12–13 / Micro 11.
// Weights: 400–600. Avoid widespread 700/800.
// Mapped to approved font families:
// English/Latin: Plus Jakarta Sans (400 Regular / 500 Medium / 600 SemiBold)
// Hindi/Devanagari: Mukta (400 Regular / 500 Medium / 600 SemiBold)

export type AppLanguage = "en" | "hi";

export const fontFamilies = {
  en: {
    regular: "PlusJakartaSans-Regular",
    medium: "PlusJakartaSans-Medium",
    semiBold: "PlusJakartaSans-SemiBold",
  },
  hi: {
    regular: "Mukta-Regular",
    medium: "Mukta-Medium",
    semiBold: "Mukta-SemiBold",
  },
} as const;

export function createTypography(lang: AppLanguage = "en") {
  const families = fontFamilies[lang];
  const isHi = lang === "hi";

  return {
    // ── Semantic scale ──────────────────────────
    display: {
      fontFamily: families.semiBold,
      fontSize: 32,
      fontWeight: "600" as const,
      lineHeight: isHi ? 40 : 38,
    },
    h1: {
      fontFamily: families.semiBold,
      fontSize: 28,
      fontWeight: "600" as const,
      lineHeight: isHi ? 36 : 34,
    },
    h2: {
      fontFamily: families.semiBold,
      fontSize: 22,
      fontWeight: "600" as const,
      lineHeight: isHi ? 30 : 28,
    },
    h3: {
      fontFamily: families.semiBold,
      fontSize: 18,
      fontWeight: "600" as const,
      lineHeight: isHi ? 26 : 24,
    },
    bodyLg: {
      fontFamily: families.regular,
      fontSize: 17,
      fontWeight: "400" as const,
      lineHeight: isHi ? 28 : 26,
    },
    body: {
      fontFamily: families.regular,
      fontSize: 15,
      fontWeight: "400" as const,
      lineHeight: isHi ? 24 : 22,
    },
    label: {
      fontFamily: families.medium,
      fontSize: 14,
      fontWeight: "500" as const,
      lineHeight: isHi ? 22 : 20,
    },
    caption: {
      fontFamily: families.regular,
      fontSize: 12,
      fontWeight: "400" as const,
      lineHeight: isHi ? 18 : 17,
    },
    micro: {
      fontFamily: families.medium,
      fontSize: 11,
      fontWeight: "500" as const,
      lineHeight: isHi ? 16 : 14,
    },
    // ── Legacy / specific tokens (preserved for backward-compatibility) ─────
    homeSectionTitle: {
      fontFamily: families.semiBold,
      fontSize: 18,
      fontWeight: "600" as const,
      lineHeight: isHi ? 24 : 22,
    },
    homeCardTitle: {
      fontFamily: families.medium,
      fontSize: 13,
      fontWeight: "600" as const,
      lineHeight: isHi ? 19 : 18,
    },
    homeCardMeta: {
      fontFamily: families.regular,
      fontSize: 12,
      fontWeight: "500" as const,
      lineHeight: isHi ? 17 : 16,
      letterSpacing: 0.2,
    },
    navLabel: {
      fontFamily: families.medium,
      fontSize: 12,
      fontWeight: "500" as const,
      lineHeight: isHi ? 15 : 14,
      letterSpacing: 0.2,
    },
  };
}

export const typography = createTypography("en");

export const borders = {
  width: 1,
  color: colors.border,
} as const;

export const artwork = {
  // web canonical content artwork ratio (aspect-[9/16]), width / height
  posterAspectRatio: 9 / 16,
  // 0nya vertical video-derived stills use the same width / height ratio.
  resumeAspectRatio: 9 / 16,
} as const;
