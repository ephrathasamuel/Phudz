import { Pool } from "pg";
import { z } from "zod";
import { loadDotenv } from "./config/env";
import { runMigrations } from "./db/migrator";

// Usage: npm run migrate            -> DATABASE_URL
//        npm run migrate -- --test  -> TEST_DATABASE_URL
async function main() {
  loadDotenv();
  const variable = process.argv.includes("--test") ? "TEST_DATABASE_URL" : "DATABASE_URL";
  const databaseUrl = z.string().url().safeParse(process.env[variable]);
  if (!databaseUrl.success) throw new Error(`${variable} must be set to a valid URL`);

  const pool = new Pool({ connectionString: databaseUrl.data });
  try {
    const applied = await runMigrations(pool);
    console.info(applied.length ? `Applied: ${applied.join(", ")}` : "Database is up to date.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
