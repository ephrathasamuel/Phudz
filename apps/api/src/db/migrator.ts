import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";

export const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../migrations");

/**
 * Applies every not-yet-applied .sql file in `directory`, in filename order.
 * Each file runs in its own transaction together with its schema_migrations row.
 * Returns the names of the files applied in this run.
 */
export async function runMigrations(pool: Pool, directory = MIGRATIONS_DIR): Promise<string[]> {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);

  const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
  const applied = new Set(
    (await pool.query<{ name: string }>("SELECT name FROM schema_migrations")).rows.map((row) => row.name),
  );

  const appliedNow: string[] = [];
  for (const name of files) {
    if (applied.has(name)) continue;

    const sql = await readFile(path.join(directory, name), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
      await client.query("COMMIT");
      appliedNow.push(name);
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(`Migration ${name} failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      client.release();
    }
  }
  return appliedNow;
}
