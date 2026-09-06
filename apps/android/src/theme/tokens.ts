// Foundation design tokens aligned to docs/0nya_PRODUCT_UIUX_BIBLE_v3.0.md
// (B04-VIS supersession) and docs/0nya_DESIGN_SYSTEM_v1.0.md §3–§11.
// Existing tokens are preserved as aliases for backward-compatibility.
// Typography tokens follow the restrained Quiet Cinema scale (§7).

export const colors = {
  // ── Core brand / Canvas (B04-VIS V1) ─────────────────────────
  // Cinema Canvas (S0 base background)
  background: "#030504",
  // Cinema Canvas deep alias
  backgroundDeep: "#030504",
  // S1 Quiet Matte
  backgroundSoft: "#080B0A",
  // S1 Quiet Matte (design-system §4 color.bg.secondary)
  backgroundSecondary: "#080B0A",
  // S2 Structural Elevated Matte (design-system §4 color.bg.elevated)
  bgElevated: "#101312",
  // S1 Quiet Matte default card/surface
  surface: "#080B0A",
  // S2 Structural Elevated Matte
  surfaceElevated: "#101312",

  // ── Typography & Text (B04-VIS V1) ───────────────────────────
  // Soft White (design-system §4 color.text.primary)
  text: "#FEFDFD",
  // Neutral Grey (B04-VIS core neutral)
  muted: "#5F6160",
  // design-system §4 color.text.secondary (~72% soft white)
  textSecondary: "rgba(254, 253, 253, 0.72)",
  // design-system §4 color.text.muted (~52% soft white)
  textMuted: "rgba(254, 253, 253, 0.52)",
  // design-system §4 color.text.disabled (~32% soft white)
  textDisabled: "rgba(254, 253, 253, 0.32)",

  // ── Accents & Brand (B04-VIS V1) ─────────────────────────────
  // Primary Muted Teal (interaction / selection / progress)
  accent: "#2B7E7D",
  // Secondary Muted Teal (highlight / companion)
  accentHighlight: "#47746F",
  // Secondary Muted Teal alias
  accentSecondary: "#47746F",
  // Soft White text on teal buttons (design-system §4 color.accent.onPrimary)
  accentOnPrimary: "#FEFDFD",
  // Resting CTA candidate (design-system §3 / §4)
  ctaResting: "#1A4D4C",
  // 0nya+ Red (rare identity, no glow)
  plusRed: "#B91825",

  // ── Borders (B04-VIS) ────────────────────────────────────────
  // Base subtle border
  border: "rgba(254, 253, 253, 0.10)",
  // design-system §4 color.border.subtle
  borderSubtle: "rgba(254, 253, 253, 0.12)",
  // design-system §4 color.border.strong
  borderStrong: "rgba(254, 253, 253, 0.22)",

  // ── Surface states (B04-VIS) ─────────────────────────────────
  // design-system §4 color.surface.selected (teal tint)
  surfaceSelected: "rgba(43, 126, 125, 0.14)",
  // design-system §4 color.surface.pressed (soft white tint)
  surfacePressed: "rgba(254, 253, 253, 0.08)",
  // S3 smoked transient media overlay (design-system §4 color.bg.overlay)
  overlay: "rgba(0, 0, 0, 0.72)",

  // ── Status ───────────────────────────────────────────────────
  error: "#ff8d76",
} as const;

// ── Surface Hierarchy (B04-VIS V3) ────────────────────────────
// S0: Cinema Canvas base background
// S1: Quiet Matte cards and content surfaces
// S2: Structural Elevated Matte sheets, dialogs, elevated actions
// S3: Smoked transient media overlays
export const surfaces = {
  s0: "#030504",
  s1: "#080B0A",
  s2: "#101312",
  s3: "rgba(0, 0, 0, 0.72)",
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
// design-system §11 & B04-VIS V2 geometry:
// Posters: 8dp. Secondary/Search: 8dp. Primary CTA: 9dp.
// Access row: 10dp. Dialog: 12dp. Sheet top: 16dp. Pill: 999.
export const radii = {
  none: 0,
  xs: 6,
  sm: 8,
  poster: 8,
  cta: 9,
  row: 10,
  md: 12,
  dialog: 12,
  lg: 16,
  sheet: 16,
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

// ── Motion ─────────────────────────────────────────────────────
// design-system §V4 touch/motion: fast acknowledgement, calm settling,
// no decorative spring/bounce, reduced-motion parity.
// loaderPeriod is a tunable runtime candidate for the 16-facet loader
// (roadmap B04-I1), not a universal constant.
export const motion = {
  loaderPeriod: 1400,
} as const;

export const artwork = {
  // web canonical content artwork ratio (aspect-[9/16]), width / height
  posterAspectRatio: 9 / 16,
  // 0nya vertical video-derived stills use the same width / height ratio.
  resumeAspectRatio: 9 / 16,
} as const;
