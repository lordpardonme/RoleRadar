import type { ContactEmail, EmailDraft, JobPosting, UserProfile } from "./types.js";
import { normalizeWhitespace, uniq } from "./utils.js";

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export function extractContactEmails(text: string, hrefs: string[] = []): ContactEmail[] {
  const mailtoEmails = hrefs
    .filter((href) => href.toLowerCase().startsWith("mailto:"))
    .flatMap((href) => href.replace(/^mailto:/i, "").split(/[?,;]/))
    .map((email) => email.trim())
    .filter((email) => EMAIL_RE.test(email));

  const pageEmails = text.match(EMAIL_RE) ?? [];
  const contacts = [
    ...mailtoEmails.map((email) => ({ email: email.toLowerCase(), source: "mailto" as const, verified: true })),
    ...pageEmails.map((email) => ({ email: email.toLowerCase(), source: "page-text" as const, verified: true }))
  ];

  return uniq(contacts.map((contact) => contact.email)).map((email) => contacts.find((contact) => contact.email === email)!);
}

export function draftOutreachEmail(profile: UserProfile, job: JobPosting, contacts: ContactEmail[] = []): EmailDraft {
  const verifiedContacts = contacts.filter((contact) => contact.verified);
  const recipient = verifiedContacts[0]?.email ? "Hiring team" : "Team";
  const name = profile.parsedResume.name ?? "Candidate";
  const topSkills = profile.parsedResume.skills.slice(0, 4);
  const company = job.company ?? "your team";
  const role = job.title;

  const body = normalizeWhitespace(`
    Hi ${recipient},

    I found the ${role} role at ${company} and wanted to reach out directly. My background includes ${topSkills.length ? topSkills.join(", ") : "relevant experience for this role"}, and the role looks aligned with the kind of work I am targeting.

    I would value the chance to be considered. I can share my resume, portfolio, and any context that helps evaluate fit.

    Best,
    ${name}
  `).replace(/\. /g, ".\n\n");

  return {
    to: verifiedContacts,
    subject: `Interest in ${role}${job.company ? ` at ${job.company}` : ""}`,
    body,
    contactConfidence: verifiedContacts.length ? 90 : 0,
    warnings: verifiedContacts.length ? [] : ["No verified public contact email found. Do not send to guessed addresses."]
  };
}
