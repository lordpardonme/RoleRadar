import "dotenv/config";

export interface AppConfig {
  host: string;
  port: number;
  nodeEnv: string;
  databaseUrl?: string;
  encryptionKey?: string;
}

export function loadConfig(): AppConfig {
  const databaseUrl = process.env.DATABASE_URL;
  const encryptionKey = process.env.PROFILE_ENCRYPTION_KEY;

  return {
    host: process.env.HOST ?? "127.0.0.1",
    port: Number(process.env.PORT ?? 8787),
    nodeEnv: process.env.NODE_ENV ?? "development",
    ...(databaseUrl ? { databaseUrl } : {}),
    ...(encryptionKey ? { encryptionKey } : {})
  };
}
