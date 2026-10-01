// Local PostgreSQL without Docker: `npm run db` (Ctrl+C to stop).
// Uses the user/password/port/database names from DATABASE_URL and
// TEST_DATABASE_URL in .env, and keeps data in ./.pgdata between runs.
import EmbeddedPostgres from "embedded-postgres";
import dotenv from "dotenv";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env first.");
  process.exit(1);
}

const app = new URL(process.env.DATABASE_URL);
const port = Number(app.port || 5432);
const databases = [process.env.DATABASE_URL, process.env.TEST_DATABASE_URL]
  .filter((url): url is string => Boolean(url))
  .map((url) => decodeURIComponent(new URL(url).pathname.slice(1)));

const dataDir = path.join(root, ".pgdata");
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: decodeURIComponent(app.username),
  password: decodeURIComponent(app.password),
  port,
  persistent: true,
  onLog: () => {},
});

/**
 * If a previous run was killed without shutting down (e.g. the terminal was
 * closed), its server may still own .pgdata and the port. Stop it cleanly.
 */
async function stopLeftoverServer() {
  if (!existsSync(path.join(dataDir, "postmaster.pid"))) return;
  const platform = process.platform === "win32" ? "windows" : process.platform;
  try {
    // Platform binary package that embedded-postgres itself installs.
    const { pg_ctl } = (await import(`@embedded-postgres/${platform}-${process.arch}`)) as { pg_ctl: string };
    execFileSync(pg_ctl,["stop", "-D", dataDir, "-m", "fast"], { stdio: "ignore" });
    console.log("Stopped a PostgreSQL server left running by a previous session.");
  } catch {
    // Not running (stale pid file); postgres cleans that up itself on start.
  }
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

try {
  if (!existsSync(path.join(dataDir, "PG_VERSION"))) {
    console.log("First run: initializing database cluster in .pgdata ...");
    await pg.initialise();
  } else {
    await stopLeftoverServer();
  }
  await pg.start();
} catch (error) {
  console.error(`Could not start PostgreSQL on port ${port}. Is another PostgreSQL already using that port?`);
  console.error(describe(error));
  process.exit(1);
}

for (const name of databases) {
  try {
    await pg.createDatabase(name);
    console.log(`Created database ${name}`);
  } catch {
    // Already exists.
  }
}

console.log(`PostgreSQL running on port ${port} (databases: ${databases.join(", ")}). Ctrl+C to stop.`);

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await pg.stop();
  process.exit(0);
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
setInterval(() => {}, 1 << 30);
