import { describe, expect, it } from "vitest";
import { buildAutofillPlan } from "../autofill.js";
import { parseResume } from "../resume.js";
import type { JobPosting, UserProfile } from "../types.js";

describe("buildAutofillPlan", () => {
  it("maps common fields and flags file upload", () => {
    const profile: UserProfile = {
      consentAcceptedAt: new Date().toISOString(),
      resumeText: "Nia Khan nia@example.com +1 555 0100 https://linkedin.com/in/nia",
      parsedResume: parseResume("Nia Khan\nnia@example.com\n+1 555 0100\nhttps://linkedin.com/in/nia"),
      personality: {
        modelVersion: "big-five-work-values-v1",
        completedAt: new Date().toISOString(),
        traits: { openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, emotionalStability: 50 },
        workValues: { autonomy: 50, collaboration: 50, structure: 50, pace: 50, purpose: 50, learning: 50, stability: 50, compensation: 50, remote: 50 }
      },
      preferences: { targetRoles: [], targetLocations: ["Austin"], remote: "hybrid", dealbreakers: [] }
    };
    const job: JobPosting = {
      id: "job",
      title: "Product Manager",
      sourceUrl: "https://example.com",
      description: "PM role",
      cultureUrls: [],
      extractedAt: new Date().toISOString()
    };
    const plan = buildAutofillPlan(profile, job, [
      { selector: "#email", label: "Email", type: "email", required: true },
      { selector: "#resume", label: "Resume", type: "file", required: true }
    ]);

    expect(plan.fields.find((field) => field.selector === "#email")?.value).toBe("nia@example.com");
    expect(plan.fields.find((field) => field.selector === "#resume")?.requiresUserAction).toBe(true);
  });
});
