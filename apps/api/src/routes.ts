import cors from "@fastify/cors";
import {
  buildAutofillPlan,
  draftOutreachEmail,
  extractCultureProfile,
  parseResume,
  scoreJob,
  scorePersonality,
  type ContactEmail,
  type FormFieldDescriptor,
  type JobPosting,
  type PersonalityAnswer,
  type UserProfile,
  type WorkValue
} from "@job-fit-hunter/shared";
import Fastify from "fastify";
import { z } from "zod";
import { createProfileRepository, type ProfileRepository } from "./repositories/profileRepository.js";
import { registerHttpsOnly } from "./security/httpsOnly.js";

const unknownRecord = z.record(z.string(), z.unknown());

export async function buildApp(repository?: ProfileRepository) {
  const repo = repository ?? await createProfileRepository();
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      redact: ["req.headers.authorization", "req.body", "res.body"]
    }
  });

  registerHttpsOnly(app);
  await app.register(cors, { origin: true });

  app.get("/health", async () => ({ ok: true }));

  app.post("/v1/profile", async (request) => {
    const profile = unknownRecord.parse(request.body) as unknown as UserProfile;
    if (!profile.consentAcceptedAt) {
      return { error: "Consent required before profile storage." };
    }
    const normalized: UserProfile = {
      ...profile,
      parsedResume: parseResume(profile.resumeText)
    };
    const saved = await repo.upsert(normalized);
    return { profileId: saved.id, parsedResume: saved.parsedResume };
  });

  app.get("/v1/profile/:id/export", async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const profile = await repo.get(params.id);
    if (!profile) return reply.code(404).send({ error: "Profile not found." });
    return profile;
  });

  app.delete("/v1/profile/:id", async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const deleted = await repo.delete(params.id);
    return { deleted };
  });

  app.post("/v1/personality/score", async (request) => {
    const body = z.object({
      answers: z.array(z.object({ id: z.string(), value: z.number() })),
      workValues: z.record(z.string(), z.number()).optional()
    }).parse(request.body);
    return scorePersonality(body.answers as PersonalityAnswer[], body.workValues as Partial<Record<WorkValue, number>> | undefined);
  });

  app.post("/v1/company/culture", async (request) => {
    const body = z.object({
      pageText: z.string().min(1),
      sourceUrl: z.string().url().optional(),
      company: z.string().optional()
    }).parse(request.body);
    return extractCultureProfile(body.pageText, body.sourceUrl, body.company);
  });

  app.post("/v1/jobs/score", async (request, reply) => {
    const body = z.object({
      profile: unknownRecord.optional(),
      profileId: z.string().optional(),
      job: unknownRecord,
      culture: unknownRecord.optional()
    }).parse(request.body);
    const profile = body.profile
      ? body.profile as unknown as UserProfile
      : body.profileId
        ? await repo.get(body.profileId)
        : undefined;
    if (!profile) return reply.code(400).send({ error: "profile or profileId required." });
    return scoreJob(profile, body.job as unknown as JobPosting, body.culture as Parameters<typeof scoreJob>[2]);
  });

  app.post("/v1/forms/map", async (request, reply) => {
    const body = z.object({
      profile: unknownRecord.optional(),
      profileId: z.string().optional(),
      job: unknownRecord,
      fields: z.array(unknownRecord)
    }).parse(request.body);
    const profile = body.profile
      ? body.profile as unknown as UserProfile
      : body.profileId
        ? await repo.get(body.profileId)
        : undefined;
    if (!profile) return reply.code(400).send({ error: "profile or profileId required." });
    return buildAutofillPlan(profile, body.job as unknown as JobPosting, body.fields as unknown as FormFieldDescriptor[]);
  });

  app.post("/v1/email/draft", async (request, reply) => {
    const body = z.object({
      profile: unknownRecord.optional(),
      profileId: z.string().optional(),
      job: unknownRecord,
      contactEmails: z.array(unknownRecord).default([])
    }).parse(request.body);
    const profile = body.profile
      ? body.profile as unknown as UserProfile
      : body.profileId
        ? await repo.get(body.profileId)
        : undefined;
    if (!profile) return reply.code(400).send({ error: "profile or profileId required." });
    return draftOutreachEmail(profile, body.job as unknown as JobPosting, body.contactEmails as unknown as ContactEmail[]);
  });

  return app;
}
