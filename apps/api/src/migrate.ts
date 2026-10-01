import dotenv from "dotenv";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { z } from "zod";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
const databaseUrl = z.string().url().parse(process.env.DATABASE_URL);
const pool = new Pool({ connectionString: databaseUrl });

async function migrate() {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);

  const directory = path.resolve(process.cwd(), "apps/api/migrations");
  const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
  for (const name of files) {
    const exists = await pool.query("SELECT 1 FROM schema_migrations WHERE name = $1", [name]);
    if (exists.rowCount) continue;

    const sql = await readFile(path.join(directory, name), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
      await client.query("COMMIT");
      console.info(`Applied ${name}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

migrate()
  .catch((error: unknown) => {
    console.error("Migration failed.", error instanceof Error ? error.message : "Unknown error");
    process.exitCode = 1;
  })
  .finally(() => pool.end());