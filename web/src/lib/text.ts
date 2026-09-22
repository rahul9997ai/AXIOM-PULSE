// Capitalizes the first letter of each word (e.g. "john smith" -> "John Smith").
export function capitalizeWords(s: string): string {
  return s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}
