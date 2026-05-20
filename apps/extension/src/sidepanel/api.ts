import {
  buildAutofillPlan,
  draftOutreachEmail,
  extractCultureProfile,
  parseResume,
  scoreJob,
  scorePersonality,
  type AutofillPlan,
  type CompanyCultureProfile,
  type ContactEmail,
  type EmailDraft,
  type FormFieldDescriptor,
  type JobMatch,
  type JobPosting,
  type PersonalityAnswer,
  type UserProfile,
  type WorkValue
} from "@job-fit-hunter/shared";

export interface ApiSettings {
  apiBaseUrl: string;
}

const DEFAULT_API_BASE = "http://127.0.0.1:8787";

export function defaultSettings(): ApiSettings {
  return { apiBaseUrl: DEFAULT_API_BASE };
}

export async function scorePersonalityViaApi(
  answers: PersonalityAnswer[],
  workValues: Partial<Record<WorkValue, number>>,
  settings: ApiSettings
) {
  try {
    return await post<ReturnType<typeof scorePersonality>>(settings, "/v1/personality/score", { answers, workValues });
  } catch {
    return scorePersonality(answers, workValues);
  }
}

export async function saveProfile(profile: UserProfile, settings: ApiSettings): Promise<{ profileId?: string; warning?: string }> {
  if (!canUseExtensionApi()) {
    return { warning: "Preview mode. Profile kept for current browser session only." };
  }

  try {
    const response = await post<{ profileId: string }>(settings, "/v1/profile", profile);
    return { profileId: response.profileId };
  } catch {
    return { warning: "API offline. Profile kept for current browser session only." };
  }
}

export async function extractCulture(settings: ApiSettings, pageText: string, sourceUrl?: string, company?: string): Promise<CompanyCultureProfile> {
  try {
    return await post<CompanyCultureProfile>(settings, "/v1/company/culture", { pageText, sourceUrl, company });
  } catch {
    return extractCultureProfile(pageText, sourceUrl, company);
  }
}

export async function scoreJobFit(
  settings: ApiSettings,
  profile: UserProfile,
  job: JobPosting,
  culture?: CompanyCultureProfile,
  profileId?: string
): Promise<JobMatch> {
  if (!canUseExtensionApi()) {
    return scoreJob(profile, job, culture);
  }

  try {
    return await post<JobMatch>(settings, "/v1/jobs/score", {
      ...(profileId ? { profileId } : { profile }),
      job,
      culture
    });
  } catch {
    return scoreJob(profile, job, culture);
  }
}

export async function mapForm(
  settings: ApiSettings,
  profile: UserProfile,
  job: JobPosting,
  fields: FormFieldDescriptor[],
  profileId?: string
): Promise<AutofillPlan> {
  if (!canUseExtensionApi()) {
    return buildAutofillPlan(profile, job, fields);
  }

  try {
    return await post<AutofillPlan>(settings, "/v1/forms/map", {
      ...(profileId ? { profileId } : { profile }),
      job,
      fields
    });
  } catch {
    return buildAutofillPlan(profile, job, fields);
  }
}

export async function draftEmail(
  settings: ApiSettings,
  profile: UserProfile,
  job: JobPosting,
  contactEmails: ContactEmail[],
  profileId?: string
): Promise<EmailDraft> {
  if (!canUseExtensionApi()) {
    return draftOutreachEmail(profile, job, contactEmails);
  }

  try {
    return await post<EmailDraft>(settings, "/v1/email/draft", {
      ...(profileId ? { profileId } : { profile }),
      job,
      contactEmails
    });
  } catch {
    return draftOutreachEmail(profile, job, contactEmails);
  }
}

export async function deleteRemoteProfile(settings: ApiSettings, profileId: string): Promise<void> {
  await fetchWithTimeout(`${settings.apiBaseUrl}/v1/profile/${profileId}`, { method: "DELETE" });
}

export function buildProfileFromForm(input: {
  resumeText: string;
  answers: PersonalityAnswer[];
  workValues: Partial<Record<WorkValue, number>>;
  targetRoles: string;
  targetLocations: string;
  remote: UserProfile["preferences"]["remote"];
  minimumCompensation?: number | undefined;
  needsVisaSponsorship: boolean;
  dealbreakers: string;
}): UserProfile {
  return {
    consentAcceptedAt: new Date().toISOString(),
    resumeText: input.resumeText,
    parsedResume: parseResume(input.resumeText),
    personality: scorePersonality(input.answers, input.workValues),
    preferences: {
      targetRoles: splitList(input.targetRoles),
      targetLocations: splitList(input.targetLocations),
      remote: input.remote,
      ...(input.minimumCompensation ? { minimumCompensation: input.minimumCompensation } : {}),
      needsVisaSponsorship: input.needsVisaSponsorship,
      dealbreakers: splitList(input.dealbreakers)
    }
  };
}

function splitList(value: string): string[] {
  return value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);
}

async function post<T>(settings: ApiSettings, path: string, body: unknown): Promise<T> {
  const response = await fetchWithTimeout(`${settings.apiBaseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`API ${path} failed: ${response.status}`);
  return response.json() as Promise<T>;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 2500): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function canUseExtensionApi(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);
}
