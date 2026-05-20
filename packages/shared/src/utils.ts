export function clamp(value: number, min = 0, max = 100): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function round(value: number): number {
  return Math.round(clamp(value));
}

export function uniq<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function words(value: string): string[] {
  return normalizeWhitespace(value)
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/i)
    .filter(Boolean);
}

export function includesAny(haystack: string, needles: string[]): boolean {
  const normalized = haystack.toLowerCase();
  return needles.some((needle) => normalized.includes(needle.toLowerCase()));
}

export function snippet(text: string, max = 240): string {
  const clean = normalizeWhitespace(text);
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}...`;
}
