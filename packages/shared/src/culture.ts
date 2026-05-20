import type { CompanyCultureProfile, CultureSignal, WorkValue } from "./types.js";
import { normalizeWhitespace, round, snippet, uniq } from "./utils.js";

const CULTURE_KEYWORDS: Record<WorkValue, string[]> = {
  autonomy: ["ownership", "autonomy", "self-directed", "independent", "empowered", "freedom"],
  collaboration: ["collaboration", "teamwork", "cross-functional", "partner", "supportive", "inclusive"],
  structure: ["process", "standards", "documentation", "quality", "reliable", "operational excellence"],
  pace: ["fast-paced", "urgency", "move fast", "rapid growth", "high-growth", "startup"],
  purpose: ["mission", "impact", "purpose", "meaningful", "customers", "community"],
  learning: ["learning", "growth", "development", "mentorship", "curiosity", "training"],
  stability: ["stability", "sustainable", "work-life", "balance", "predictable", "long-term"],
  compensation: ["compensation", "equity", "benefits", "bonus", "salary", "competitive pay"],
  remote: ["remote", "distributed", "flexible", "hybrid", "work from home", "async"]
};

export function extractCultureProfile(text: string, sourceUrl?: string, company?: string): CompanyCultureProfile {
  const clean = normalizeWhitespace(text);
  const sentences = clean.split(/(?<=[.!?])\s+|\n+/).filter(Boolean);
  const signals = Object.entries(CULTURE_KEYWORDS)
    .map(([value, keywords]) => {
      const evidence = sentences
        .filter((sentence) => keywords.some((keyword) => sentence.toLowerCase().includes(keyword)))
        .map((sentence) => snippet(sentence, 180))
        .slice(0, 3);
      const strength = round(Math.min(100, (evidence.length / 3) * 100));
      return {
        value: value as WorkValue,
        label: value,
        evidence,
        strength
      } satisfies CultureSignal;
    })
    .filter((signal) => signal.evidence.length > 0);

  return {
    ...(company ? { company } : {}),
    ...(sourceUrl ? { sourceUrl } : {}),
    values: uniq(signals.map((signal) => signal.value)),
    signals,
    rawTextSnippet: snippet(clean, 900)
  };
}

export function cultureSignalsFromJob(text: string): CultureSignal[] {
  return extractCultureProfile(text).signals;
}
