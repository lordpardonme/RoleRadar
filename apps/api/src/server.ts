import { loadConfig } from "./config.js";
import { buildApp } from "./routes.js";

const config = loadConfig();
const app = await buildApp();

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
