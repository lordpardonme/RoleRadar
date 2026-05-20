import { cultureSignalsFromJob } from "./culture.js";
import { extractKnownSkills } from "./skills.js";
import { parseResume } from "./resume.js";
import { SCORING_WEIGHTS, type CompanyCultureProfile, type JobMatch, type JobPosting, type ScoreComponent, type UserProfile, type WorkValue } from "./types.js";
import { clamp, includesAny, normalizeWhitespace, round, snippet, uniq } from "./utils.js";

export function scoreJob(profile: UserProfile, job: JobPosting, culture?: CompanyCultureProfile): JobMatch {
  const resume = profile.parsedResume ?? parseResume(profile.resumeText);
  const jobText = `${job.title} ${job.location ?? ""} ${job.description}`;
  const skills = scoreSkills(resume.skills, jobText);
  const experience = scoreExperience(resume.yearsExperience, jobText);
  const preferences = scorePreferences(profile, job);
  const cultureScore = scoreCulture(profile, jobText, culture);
  const logistics = scoreLogistics(profile, job);

  const breakdown = {
    skills,
    experience,
    preferences,
    culture: cultureScore,
    logistics
  };

  const weighted = Object.values(breakdown).reduce((sum, item) => sum + item.weighted, 0);
  const confidence = estimateConfidence(job, culture, skills, experience);
  const allEvidence = uniq(Object.values(breakdown).flatMap((item) => item.evidence)).slice(0, 8);
  const allGaps = uniq(Object.values(breakdown).flatMap((item) => item.gaps)).slice(0, 8);
  const score = round(weighted);

  return {
    jobId: job.id,
    score,
    breakdown,
    evidence: allEvidence,
    gaps: allGaps,
    confidence,
    nextAction: nextAction(score, confidence)
  };
}

function component(score: number, weight: number, evidence: string[], gaps: string[]): ScoreComponent {
  const rounded = round(score);
  return {
    score: rounded,
    weight,
    weighted: rounded * weight,
    evidence,
    gaps
  };
}

function scoreSkills(resumeSkills: string[], jobText: string): ScoreComponent {
  const required = extractKnownSkills(jobText);
  if (!required.length) {
    return component(55, SCORING_WEIGHTS.skills, ["Job page has few explicit skill keywords."], ["Skill match confidence limited by sparse posting."]);
  }

  const matched = required.filter((skill) => resumeSkills.some((resumeSkill) => resumeSkill.toLowerCase() === skill.toLowerCase()));
  const score = (matched.length / required.length) * 100;
  const missing = required.filter((skill) => !matched.includes(skill));
  return component(
    score,
    SCORING_WEIGHTS.skills,
    matched.length ? [`Matched skills: ${matched.join(", ")}.`] : [],
    missing.length ? [`Missing or not visible in resume: ${missing.slice(0, 6).join(", ")}.`] : []
  );
}

function scoreExperience(yearsExperience: number | undefined, jobText: string): ScoreComponent {
  const requiredYears = findRequiredYears(jobText);
  if (requiredYears === undefined) {
    return component(65, SCORING_WEIGHTS.experience, ["No explicit years requirement found."], []);
  }
  if (yearsExperience === undefined) {
    return component(45, SCORING_WEIGHTS.experience, [], [`Posting asks for ${requiredYears}+ years; resume years unclear.`]);
  }
  const score = yearsExperience >= requiredYears ? 100 : clamp((yearsExperience / requiredYears) * 100);
  return component(
    score,
    SCORING_WEIGHTS.experience,
    yearsExperience >= requiredYears ? [`Resume shows ${yearsExperience}+ years vs ${requiredYears}+ requested.`] : [],
    yearsExperience < requiredYears ? [`Experience gap: ${yearsExperience}+ years vs ${requiredYears}+ requested.`] : []
  );
}

function findRequiredYears(text: string): number | undefined {
  const matches = [...text.matchAll(/(\d{1,2})\+?\s*(?:years|yrs)(?:[^.]{0,60})?(?:experience|exp|building|working)/gi)]
    .map((match) => Number(match[1]))
    .filter((value) => value > 0 && value < 40);
  return matches.length ? Math.min(...matches) : undefined;
}

function scorePreferences(profile: UserProfile, job: JobPosting): ScoreComponent {
  const evidence: string[] = [];
  const gaps: string[] = [];
  const text = `${job.title} ${job.location ?? ""} ${job.description}`.toLowerCase();
  let score = 70;

  if (profile.preferences.targetRoles.length) {
    const roleHit = profile.preferences.targetRoles.some((role) => text.includes(role.toLowerCase()));
    score += roleHit ? 15 : -12;
    (roleHit ? evidence : gaps).push(roleHit ? "Role matches target role keywords." : "Role title does not match saved target roles.");
  }

  if (profile.preferences.targetLocations.length) {
    const locationText = job.location?.toLowerCase() ?? "";
    const locationHit = profile.preferences.targetLocations.some((location) => locationText.includes(location.toLowerCase()));
    score += locationHit ? 10 : -8;
    (locationHit ? evidence : gaps).push(locationHit ? "Location matches saved preferences." : "Location may not match saved preferences.");
  }

  const hitDealbreaker = profile.preferences.dealbreakers.find((dealbreaker) => dealbreaker && text.includes(dealbreaker.toLowerCase()));
  if (hitDealbreaker) {
    score -= 35;
    gaps.push(`Dealbreaker found: ${hitDealbreaker}.`);
  }

  return component(score, SCORING_WEIGHTS.preferences, evidence, gaps);
}

function scoreCulture(profile: UserProfile, jobText: string, culture?: CompanyCultureProfile): ScoreComponent {
  const signals = culture?.signals.length ? culture.signals : cultureSignalsFromJob(jobText);
  if (!signals.length) {
    return component(50, SCORING_WEIGHTS.culture, [], ["No visible company culture signals found on page."]);
  }

  const desiredValues = Object.entries(profile.personality.workValues)
    .filter(([, value]) => value >= 65)
    .map(([key]) => key as WorkValue);
  const visibleValues = signals.map((signal) => signal.value);
  const matchedValues = desiredValues.filter((value) => visibleValues.includes(value));
  const valueScore = desiredValues.length ? (matchedValues.length / desiredValues.length) * 100 : 65;
  const traitScore = scoreTraitsAgainstSignals(profile, visibleValues);
  const score = valueScore * 0.65 + traitScore * 0.35;
  return component(
    score,
    SCORING_WEIGHTS.culture,
    matchedValues.length ? [`Culture signals match: ${matchedValues.join(", ")}.`] : signals.slice(0, 2).map((signal) => `${signal.label}: ${signal.evidence[0]}`),
    desiredValues.filter((value) => !matchedValues.includes(value)).slice(0, 4).map((value) => `Culture signal not found for ${value}.`)
  );
}

function scoreTraitsAgainstSignals(profile: UserProfile, visibleValues: WorkValue[]): number {
  const checks = [
    profile.personality.traits.openness >= 65 && visibleValues.some((value) => value === "learning" || value === "autonomy"),
    profile.personality.traits.conscientiousness >= 65 && visibleValues.includes("structure"),
    profile.personality.traits.extraversion >= 65 && visibleValues.includes("collaboration"),
    profile.personality.traits.agreeableness >= 65 && visibleValues.includes("collaboration"),
    profile.personality.traits.emotionalStability >= 65 && visibleValues.includes("pace")
  ];
  const positive = checks.filter(Boolean).length;
  return checks.length ? (positive / checks.length) * 100 : 50;
}

function scoreLogistics(profile: UserProfile, job: JobPosting): ScoreComponent {
  const text = `${job.title} ${job.location ?? ""} ${job.description}`.toLowerCase();
  const evidence: string[] = [];
  const gaps: string[] = [];
  let score = 70;

  if (profile.preferences.remote !== "any") {
    const wantsRemote = profile.preferences.remote === "remote";
    const remoteVisible = includesAny(text, ["remote", "distributed", "work from home"]);
    const onsiteVisible = includesAny(text, ["onsite", "on-site", "in office"]);
    if (wantsRemote && remoteVisible) {
      score += 20;
      evidence.push("Remote language found.");
    } else if (wantsRemote && onsiteVisible) {
      score -= 30;
      gaps.push("Posting appears onsite while profile prefers remote.");
    }
  }

  if (profile.preferences.needsVisaSponsorship) {
    if (includesAny(text, ["visa sponsorship", "sponsor visa", "h-1b"])) {
      score += 10;
      evidence.push("Visa sponsorship language found.");
    } else if (includesAny(text, ["no sponsorship", "cannot sponsor", "must be authorized"])) {
      score -= 35;
      gaps.push("Posting may not support visa sponsorship.");
    }
  }

  return component(score, SCORING_WEIGHTS.logistics, evidence, gaps);
}

function estimateConfidence(
  job: JobPosting,
  culture: CompanyCultureProfile | undefined,
  skills: ScoreComponent,
  experience: ScoreComponent
): number {
  let confidence = 35;
  if (normalizeWhitespace(job.description).length > 700) confidence += 20;
  if (skills.evidence.length || skills.gaps.length) confidence += 15;
  if (experience.evidence.length || experience.gaps.length) confidence += 10;
  if (culture?.signals.length) confidence += 15;
  if (job.company && job.location) confidence += 5;
  return round(confidence);
}

function nextAction(score: number, confidence: number): string {
  if (score >= 82 && confidence >= 65) return "Strong fit. Review autofill, tailor one paragraph, then apply.";
  if (score >= 68) return "Good fit. Check gaps before applying.";
  if (score >= 52) return "Possible fit. Apply only if gaps are acceptable.";
  return "Weak fit. Save only if company or role is strategically important.";
}

export function summarizeJob(job: JobPosting): string {
  return snippet(`${job.title} ${job.company ?? ""} ${job.location ?? ""} ${job.description}`, 280);
}
