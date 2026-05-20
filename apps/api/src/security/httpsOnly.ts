import type { FastifyInstance } from "fastify";
import { loadConfig } from "../config.js";

export function registerHttpsOnly(app: FastifyInstance): void {
  const config = loadConfig();
  app.addHook("onRequest", async (request, reply) => {
    if (config.nodeEnv !== "production") return;

    const host = request.hostname;
    const proto = request.headers["x-forwarded-proto"] ?? request.protocol;
    const local = host.startsWith("localhost") || host.startsWith("127.0.0.1");
    if (!local && proto !== "https") {
      await reply.code(403).send({ error: "HTTPS required." });
    }
  });
}
