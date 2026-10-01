import { Pool } from "pg";
import { createApp } from "./app";
import { loadConfig } from "./config/env";

async function main() {
  const config = loadConfig();
  const pool = new Pool({ connectionString: config.databaseUrl });
  const app = await createApp({ db: pool, webOrigin: config.webOrigin });
  try {
    await app.listen({ port: config.port, host: "0.0.0.0" });
  } catch (error) {
    app.log.error(error);
    await pool.end();
    process.exitCode = 1;
  }
}

void main();