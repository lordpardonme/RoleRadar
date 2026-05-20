import { extractKnownSkills } from "./skills.js";
import type { ResumeProfile } from "./types.js";
import { normalizeWhitespace, snippet, uniq } from "./utils.js";

const TITLE_KEYWORDS = [
  "Software Engineer",
  "Frontend Engineer",
  "Backend Engineer",
  "Full Stack Engineer",
  "Product Manager",
  "Project Manager",
  "Data Analyst",
  "Data Scientist",
  "Designer",
  "UX Designer",
  "Marketing Manager",
  "Sales Development Representative",
  "Account Executive",
  "Customer Success Manager",
  "Recruiter",
  "Operations Manager"
];

const EDUCATION_KEYWORDS = ["bachelor", "master", "phd", "university", "college", "degree", "bootcamp"];

export function parseResume(text: string): ResumeProfile {
  const clean = normalizeWhitespace(text);
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const email = clean.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const phone = clean.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0]?.trim();
  const links = uniq(clean.match(/https?:\/\/[^\s)]+/gi) ?? []);
  const name = findLikelyName(lines, email);
  const [firstName, ...lastParts] = name ? name.split(/\s+/) : [];
  const yearsExperience = findYearsExperience(clean);
  const lower = clean.toLowerCase();
  const titles = TITLE_KEYWORDS.filter((title) => lower.includes(title.toLowerCase()));
  const education = lines.filter((line) => EDUCATION_KEYWORDS.some((keyword) => line.toLowerCase().includes(keyword))).slice(0, 5);

  return {
    ...(name ? { name } : {}),
    ...(firstName ? { firstName } : {}),
    ...(lastParts.length ? { lastName: lastParts.join(" ") } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    links,
    skills: extractKnownSkills(clean),
    titles,
    ...(yearsExperience !== undefined ? { yearsExperience } : {}),
    education,
    summary: snippet(clean, 500)
  };
}

function findLikelyName(lines: string[], email?: string): string | undefined {
  const candidate = lines.find((line) => {
    if (email && line.includes(email)) return false;
    if (line.length > 70) return false;
    if (/[0-9@:/\\]/.test(line)) return false;
    const parts = line.split(/\s+/);
    return parts.length >= 2 && parts.length <= 4;
  });
  return candidate ? normalizeWhitespace(candidate) : undefined;
}

function findYearsExperience(text: string): number | undefined {
  const matches = [...text.matchAll(/(\d{1,2})\+?\s*(?:years|yrs)\b/gi)]
    .map((match) => Number(match[1]))
    .filter((value) => value > 0 && value < 60);
  return matches.length ? Math.max(...matches) : undefined;
}
