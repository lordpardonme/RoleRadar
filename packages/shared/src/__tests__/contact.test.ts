import { describe, expect, it } from "vitest";
import { draftOutreachEmail, extractContactEmails } from "../contact.js";
import { parseResume } from "../resume.js";
import type { JobPosting, UserProfile } from "../types.js";

describe("contact helpers", () => {
  it("extracts verified public emails and refuses guessed-only drafts", () => {
    const contacts = extractContactEmails("Contact careers@example.com", ["mailto:talent@example.com"]);
    expect(contacts.map((contact) => contact.email)).toEqual(expect.arrayContaining(["careers@example.com", "talent@example.com"]));

    const profile: UserProfile = {
      consentAcceptedAt: new Date().toISOString(),
      resumeText: "Sam Lee sam@example.com React TypeScript",
      parsedResume: parseResume("Sam Lee sam@example.com React TypeScript"),
      personality: {
        modelVersion: "big-five-work-values-v1",
        completedAt: new Date().toISOString(),
        traits: { openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, emotionalStability: 50 },
        workValues: { autonomy: 50, collaboration: 50, structure: 50, pace: 50, purpose: 50, learning: 50, stability: 50, compensation: 50, remote: 50 }
      },
      preferences: { targetRoles: [], targetLocations: [], remote: "any", dealbreakers: [] }
    };
    const job: JobPosting = {
      id: "job",
      title: "Frontend Engineer",
      company: "Example",
      sourceUrl: "https://example.com",
      description: "React role",
      cultureUrls: [],
      extractedAt: new Date().toISOString()
    };
    expect(draftOutreachEmail(profile, job, []).warnings[0]).toContain("No verified");
  });
});
