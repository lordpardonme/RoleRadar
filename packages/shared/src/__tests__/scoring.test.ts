import { describe, expect, it } from "vitest";
import { parseResume } from "../resume.js";
import { scoreJob } from "../scoring.js";
import type { JobPosting, UserProfile } from "../types.js";

const profile: UserProfile = {
  consentAcceptedAt: new Date().toISOString(),
  resumeText: "Alex Doe alex@example.com 5 years React TypeScript Node.js Postgres AWS Software Engineer",
  parsedResume: parseResume("Alex Doe alex@example.com 5 years React TypeScript Node.js Postgres AWS Software Engineer"),
  personality: {
    modelVersion: "big-five-work-values-v1",
    completedAt: new Date().toISOString(),
    traits: {
      openness: 80,
      conscientiousness: 75,
      extraversion: 60,
      agreeableness: 70,
      emotionalStability: 80
    },
    workValues: {
      autonomy: 85,
      collaboration: 75,
      structure: 55,
      pace: 60,
      purpose: 65,
      learning: 80,
      stability: 40,
      compensation: 50,
      remote: 90
    }
  },
  preferences: {
    targetRoles: ["Software Engineer"],
    targetLocations: ["Remote"],
    remote: "remote",
    needsVisaSponsorship: false,
    dealbreakers: ["night shift"]
  }
};

describe("scoreJob", () => {
  it("uses declared score weights and returns advisory action", () => {
    const job: JobPosting = {
      id: "job_1",
      title: "Remote Software Engineer",
      company: "Acme",
      location: "Remote",
      sourceUrl: "https://example.com/jobs/1",
      description: "Build React, TypeScript, Node.js and Postgres products. 4 years experience. Remote culture with autonomy, collaboration, learning and mission impact.",
      cultureUrls: [],
      extractedAt: new Date().toISOString()
    };

    const match = scoreJob(profile, job);

    expect(match.score).toBeGreaterThan(75);
    expect(match.breakdown.skills.weight).toBe(0.35);
    expect(match.evidence.join(" ")).toContain("Matched skills");
    expect(match.nextAction).toContain("fit");
  });
});
