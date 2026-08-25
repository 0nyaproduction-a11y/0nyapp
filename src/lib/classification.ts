export const CONTENT_RATINGS = ["U", "U/A 7+", "U/A 13+", "U/A 16+", "A"] as const;
export type ContentRating = (typeof CONTENT_RATINGS)[number];

export const CONTENT_DESCRIPTORS = [
  "language",
  "violence",
  "sexual content",
  "substance use",
  "fear / horror",
  "mature themes",
] as const;
export type ContentDescriptor = (typeof CONTENT_DESCRIPTORS)[number];

const HIGHER_PARENTAL_RATINGS: ContentRating[] = ["U/A 13+", "U/A 16+", "A"];

export function normalizeContentRating(value: string | null | undefined): ContentRating | null {
  return CONTENT_RATINGS.includes(value as ContentRating) ? (value as ContentRating) : null;
}

export function normalizeContentDescriptors(
  values: Array<string | null | undefined> | null | undefined,
) {
  if (!values) {
    return [] as ContentDescriptor[];
  }

  const descriptors: ContentDescriptor[] = [];

  for (const value of values) {
    if (!CONTENT_DESCRIPTORS.includes(value as ContentDescriptor)) {
      continue;
    }

    const descriptor = value as ContentDescriptor;
    if (!descriptors.includes(descriptor)) {
      descriptors.push(descriptor);
    }
  }

  return descriptors;
}

export function getParentalLockRequired(contentRating: ContentRating | null) {
  return contentRating ? HIGHER_PARENTAL_RATINGS.includes(contentRating) : false;
}

export function getAgeVerificationRequired(contentRating: ContentRating | null) {
  return contentRating === "A";
}

export function resolveContentClassification(
  contentRating: ContentRating | null,
  contentDescriptors: ContentDescriptor[] = [],
) {
  return {
    contentRating,
    contentDescriptors,
    parentalLockRequired: getParentalLockRequired(contentRating),
    ageVerificationRequired: getAgeVerificationRequired(contentRating),
  };
}
