import { Pool } from "pg";
import { createApp } from "./app";
import { loadConfig, loadDotenv } from "./config/env";

async function main() {
  loadDotenv();
  const config = loadConfig();
  const pool = new Pool({ connectionString: config.databaseUrl });
  const app = await createApp({
    db: pool,
    webOrigin: config.webOrigin,
    payoutMode: config.payoutMode,
    logger: true,
  });
  app.addHook("onClose", () => pool.end());

  await app.listen({ port: config.port, host: "0.0.0.0" });
}

main().catch((error: unknown) => {
  console.error("API failed to start:", error instanceof Error ? error.message : error);
  process.exit(1);
});
