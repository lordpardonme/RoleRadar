export const SCORING_WEIGHTS = {
  skills: 0.35,
  experience: 0.2,
  preferences: 0.15,
  culture: 0.2,
  logistics: 0.1
} as const;

export type ScoringCategory = keyof typeof SCORING_WEIGHTS;

export type PersonalityTrait =
  | "openness"
  | "conscientiousness"
  | "extraversion"
  | "agreeableness"
  | "emotionalStability";

export type WorkValue =
  | "autonomy"
  | "collaboration"
  | "structure"
  | "pace"
  | "purpose"
  | "learning"
  | "stability"
  | "compensation"
  | "remote";

export type RemotePreference = "remote" | "hybrid" | "onsite" | "any";

export interface PersonalityQuestion {
  id: string;
  trait: PersonalityTrait;
  prompt: string;
  reverse?: boolean;
}

export interface PersonalityAnswer {
  id: string;
  value: number;
}

export interface PersonalityProfile {
  modelVersion: "big-five-work-values-v1";
  traits: Record<PersonalityTrait, number>;
  workValues: Record<WorkValue, number>;
  completedAt: string;
}

export interface ResumeProfile {
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  links: string[];
  skills: string[];
  titles: string[];
  yearsExperience?: number;
  education: string[];
  summary: string;
}

export interface UserPreferences {
  targetRoles: string[];
  targetLocations: string[];
  remote: RemotePreference;
  minimumCompensation?: number;
  needsVisaSponsorship?: boolean;
  dealbreakers: string[];
}

export interface UserProfile {
  id?: string;
  consentAcceptedAt: string;
  resumeText: string;
  parsedResume: ResumeProfile;
  personality: PersonalityProfile;
  preferences: UserPreferences;
}

export interface JobPosting {
  id: string;
  sourceUrl: string;
  title: string;
  company?: string;
  location?: string;
  description: string;
  employmentType?: string;
  salaryText?: string;
  applyUrl?: string;
  cultureUrls: string[];
  extractedAt: string;
}

export interface CultureSignal {
  value: WorkValue;
  label: string;
  evidence: string[];
  strength: number;
}

export interface CompanyCultureProfile {
  company?: string;
  sourceUrl?: string;
  values: string[];
  signals: CultureSignal[];
  rawTextSnippet: string;
}

export interface ScoreComponent {
  score: number;
  weight: number;
  weighted: number;
  evidence: string[];
  gaps: string[];
}

export type ScoreBreakdown = Record<ScoringCategory, ScoreComponent>;

export interface JobMatch {
  jobId: string;
  score: number;
  breakdown: ScoreBreakdown;
  evidence: string[];
  gaps: string[];
  confidence: number;
  nextAction: string;
}

export interface FormFieldDescriptor {
  selector: string;
  label: string;
  name?: string;
  type: string;
  required: boolean;
  options?: string[];
}

export interface AutofillPlanField {
  selector: string;
  label: string;
  value: string;
  confidence: number;
  reason: string;
  requiresUserAction?: boolean;
}

export interface AutofillPlan {
  fields: AutofillPlanField[];
  warnings: string[];
}

export interface ContactEmail {
  email: string;
  source: "mailto" | "page-text" | "structured-data";
  verified: boolean;
}

export interface EmailDraft {
  to: ContactEmail[];
  subject: string;
  body: string;
  contactConfidence: number;
  warnings: string[];
}
