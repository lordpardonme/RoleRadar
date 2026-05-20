import { randomUUID } from "node:crypto";
import type { UserProfile } from "@job-fit-hunter/shared";
import { decryptJson, encryptJson, type EncryptedPayload } from "../security/encryption.js";

interface StoredProfile {
  id: string;
  encryptedProfile: EncryptedPayload;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfileRepository {
  upsert(profile: UserProfile): Promise<UserProfile>;
  get(id: string): Promise<UserProfile | undefined>;
  delete(id: string): Promise<boolean>;
}

export class MemoryProfileRepository implements ProfileRepository {
  private readonly profiles = new Map<string, StoredProfile>();

  async upsert(profile: UserProfile): Promise<UserProfile> {
    const id = profile.id ?? randomUUID();
    const saved: UserProfile = { ...profile, id };
    const existing = this.profiles.get(id);
    this.profiles.set(id, {
      id,
      encryptedProfile: encryptJson(saved),
      createdAt: existing?.createdAt ?? new Date(),
      updatedAt: new Date()
    });
    return saved;
  }

  async get(id: string): Promise<UserProfile | undefined> {
    const found = this.profiles.get(id);
    return found ? decryptJson<UserProfile>(found.encryptedProfile) : undefined;
  }

  async delete(id: string): Promise<boolean> {
    return this.profiles.delete(id);
  }
}

export async function createProfileRepository(): Promise<ProfileRepository> {
  if (!process.env.DATABASE_URL || process.env.USE_MEMORY_REPOSITORY === "true") {
    return new MemoryProfileRepository();
  }

  try {
    return await createPrismaRepository();
  } catch (error) {
    console.warn("Prisma repository unavailable; using encrypted memory repository.");
    return new MemoryProfileRepository();
  }
}

async function createPrismaRepository(): Promise<ProfileRepository> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  await prisma.$connect();

  return {
    async upsert(profile: UserProfile): Promise<UserProfile> {
      const id = profile.id ?? randomUUID();
      const saved: UserProfile = { ...profile, id };
      await prisma.profile.upsert({
        where: { id },
        create: { id, encryptedProfile: encryptJson(saved) },
        update: { encryptedProfile: encryptJson(saved) }
      });
      return saved;
    },
    async get(id: string): Promise<UserProfile | undefined> {
      const record = await prisma.profile.findUnique({ where: { id } });
      return record ? decryptJson<UserProfile>(record.encryptedProfile as EncryptedPayload) : undefined;
    },
    async delete(id: string): Promise<boolean> {
      await prisma.profile.delete({ where: { id } });
      return true;
    }
  };
}
