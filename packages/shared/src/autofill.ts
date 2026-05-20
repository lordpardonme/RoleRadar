import { draftOutreachEmail } from "./contact.js";
import type { AutofillPlan, AutofillPlanField, FormFieldDescriptor, JobPosting, UserProfile } from "./types.js";

export function buildAutofillPlan(profile: UserProfile, job: JobPosting, fields: FormFieldDescriptor[]): AutofillPlan {
  const warnings: string[] = [];
  const mapped = fields
    .map((field) => mapField(profile, job, field, warnings))
    .filter((field): field is AutofillPlanField => Boolean(field));

  if (!mapped.length) warnings.push("No confident autofill matches found on this form.");
  warnings.push("Review every field before applying. Extension never submits forms.");

  return { fields: mapped, warnings };
}

function mapField(
  profile: UserProfile,
  job: JobPosting,
  field: FormFieldDescriptor,
  warnings: string[]
): AutofillPlanField | undefined {
  const haystack = `${field.label} ${field.name ?? ""} ${field.type}`.toLowerCase();
  const resume = profile.parsedResume;
  const value = valueForField(haystack, profile, job);

  if (field.type === "file") {
    warnings.push(`File upload requires manual selection: ${field.label || field.name || field.selector}.`);
    return {
      selector: field.selector,
      label: field.label,
      value: "",
      confidence: 100,
      reason: "Browser security blocks programmatic file upload.",
      requiresUserAction: true
    };
  }

  if (!value) return undefined;

  return {
    selector: field.selector,
    label: field.label,
    value,
    confidence: field.required ? 88 : 74,
    reason: `Mapped from profile${resume.email && value === resume.email ? " email" : ""}.`
  };
}

function valueForField(haystack: string, profile: UserProfile, job: JobPosting): string | undefined {
  const resume = profile.parsedResume;
  if (matches(haystack, ["first name", "firstname", "given name"])) return resume.firstName;
  if (matches(haystack, ["last name", "lastname", "family name", "surname"])) return resume.lastName;
  if (matches(haystack, ["full name", "name"])) return resume.name;
  if (matches(haystack, ["email", "e-mail"])) return resume.email;
  if (matches(haystack, ["phone", "mobile", "tel"])) return resume.phone;
  if (matches(haystack, ["linkedin"])) return resume.links.find((link) => link.toLowerCase().includes("linkedin"));
  if (matches(haystack, ["github"])) return resume.links.find((link) => link.toLowerCase().includes("github"));
  if (matches(haystack, ["portfolio", "website", "url"])) return resume.links[0];
  if (matches(haystack, ["location", "city"])) return profile.preferences.targetLocations[0];
  if (matches(haystack, ["salary", "compensation"])) return profile.preferences.minimumCompensation?.toString();
  if (matches(haystack, ["visa", "sponsorship", "work authorization"])) {
    return profile.preferences.needsVisaSponsorship ? "Yes, I require sponsorship." : "I am authorized to work without sponsorship.";
  }
  if (matches(haystack, ["cover letter", "why are you interested", "message"])) {
    return draftOutreachEmail(profile, job).body;
  }
  if (matches(haystack, ["summary", "about you", "profile"])) return resume.summary;
  return undefined;
}

function matches(value: string, tokens: string[]): boolean {
  return tokens.some((token) => value.includes(token));
}
