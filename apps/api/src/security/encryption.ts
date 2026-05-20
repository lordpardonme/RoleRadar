import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { loadConfig } from "../config.js";

export interface EncryptedPayload {
  algorithm: "aes-256-gcm";
  keyVersion: "v1";
  iv: string;
  tag: string;
  ciphertext: string;
}

export function encryptJson(value: unknown): EncryptedPayload {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", resolveKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    algorithm: "aes-256-gcm",
    keyVersion: "v1",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64")
  };
}

export function decryptJson<T>(payload: EncryptedPayload): T {
  const decipher = createDecipheriv("aes-256-gcm", resolveKey(), Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final()
  ]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}

function resolveKey(): Buffer {
  const config = loadConfig();
  if (!config.encryptionKey && config.nodeEnv === "production") {
    throw new Error("PROFILE_ENCRYPTION_KEY is required in production.");
  }
  const source = config.encryptionKey ?? "dev-only-job-fit-hunter-local-key";
  return createHash("sha256").update(source).digest();
}
