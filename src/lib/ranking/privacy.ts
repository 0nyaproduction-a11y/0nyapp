const PHONE = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

export function sanitizeSearchQueryContext(value: string) {
  return value.replace(EMAIL, "[redacted]").replace(PHONE, "[redacted]").trim().slice(0, 200);
}
