import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

/** Repo-root .env, resolved from this file so it works regardless of cwd. */
export const ROOT_ENV_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../.env");

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  PAYOUT_MODE: z.enum(["mock", "live"]).default("mock"),
  WEBHOOK_SECRET: z.string().default("whsec_phundz_demo_secret_2026"),
});

export interface Config {
  databaseUrl: string;
  port: number;
  webOrigin: string;
  payoutMode: "mock" | "live";
  webhookSecret: string;
}

/** Loads and validates env; throws with the offending variable names so startup fails fast. */
export function loadConfig(environment: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(environment);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid environment configuration (${problems})`);
  }
  return {
    databaseUrl: result.data.DATABASE_URL,
    port: result.data.API_PORT,
    webOrigin: result.data.WEB_ORIGIN,
    payoutMode: result.data.PAYOUT_MODE,
    webhookSecret: result.data.WEBHOOK_SECRET,
  };
}

export function loadDotenv() {
  dotenv.config({ path: ROOT_ENV_PATH });
}
