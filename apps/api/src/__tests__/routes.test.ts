import { describe, expect, it } from "vitest";
import { parseResume } from "@job-fit-hunter/shared";
import { buildApp } from "../routes.js";
import { MemoryProfileRepository } from "../repositories/profileRepository.js";

describe("api routes", () => {
  it("stores profile and scores a job", async () => {
    const app = await buildApp(new MemoryProfileRepository());
    const profile = {
      consentAcceptedAt: new Date().toISOString(),
      resumeText: "Alex Doe alex@example.com 5 years React TypeScript Node.js",
      parsedResume: parseResume("Alex Doe alex@example.com 5 years React TypeScript Node.js"),
      personality: {
        modelVersion: "big-five-work-values-v1",
        completedAt: new Date().toISOString(),
        traits: { openness: 70, conscientiousness: 70, extraversion: 60, agreeableness: 60, emotionalStability: 70 },
        workValues: { autonomy: 80, collaboration: 60, structure: 50, pace: 50, purpose: 50, learning: 80, stability: 50, compensation: 50, remote: 80 }
      },
      preferences: { targetRoles: ["Engineer"], targetLocations: ["Remote"], remote: "remote", dealbreakers: [] }
    };

    const saved = await app.inject({ method: "POST", url: "/v1/profile", payload: profile });
    expect(saved.statusCode).toBe(200);
    const profileId = saved.json<{ profileId: string }>().profileId;

    const scored = await app.inject({
      method: "POST",
      url: "/v1/jobs/score",
      payload: {
        profileId,
        job: {
          id: "job",
          title: "Remote Software Engineer",
          sourceUrl: "https://example.com/job",
          description: "React TypeScript Node.js role with remote autonomy. 3 years experience.",
          cultureUrls: [],
          extractedAt: new Date().toISOString()
        }
      }
    });

    expect(scored.statusCode).toBe(200);
    expect(scored.json<{ score: number }>().score).toBeGreaterThan(60);
    await app.close();
  });
});
