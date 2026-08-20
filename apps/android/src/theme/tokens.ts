// Foundation design tokens sourced from the verified 0nya web design system
// (src/app/globals.css). Values are transcribed exactly; none are invented.
// Typography tokens are intentionally deferred (see design-system audit).

export const colors = {
  // web --background (src/app/globals.css)
  background: "#050505",
  // web --deep (src/app/globals.css) — not yet consumed by any foundation file
  backgroundDeep: "#030504",
  // web --soft (src/app/globals.css) — not yet consumed by any foundation file
  backgroundSoft: "#071414",
  // web --surface (src/app/globals.css)
  surface: "#1a1a1a",
  // web --foreground / --bone (src/app/globals.css)
  text: "#e8e4da",
  // web --muted (src/app/globals.css)
  muted: "#a0a0a0",
  // web --teal (src/app/globals.css)
  accent: "#0dd1bc",
  // actual rendered web border value (Tailwind `border-bone/10`), not the
  // unused 8%-opacity --border-bone CSS variable
  border: "rgba(232, 228, 218, 0.10)",
} as const;

export const spacing = {
  // matches existing Android Card padding and web card/tile padding (p-4/p-5)
  cardPadding: 16,
} as const;

export const radii = {
  // web design language uses square corners everywhere (no rounded-* usage found)
  none: 0,
} as const;

export const borders = {
  width: 1,
  color: colors.border,
} as const;

export const artwork = {
  // web canonical content artwork ratio (aspect-[9/16]), width / height
  posterAspectRatio: 9 / 16,
} as const;
