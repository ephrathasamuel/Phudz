import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
});

export function loadConfig(environment: NodeJS.ProcessEnv = process.env) {
  const result = envSchema.safeParse(environment);
  if (!result.success) {
    throw new Error("Invalid environment configuration. Check DATABASE_URL, API_PORT, and WEB_ORIGIN.");
  }
  return {
    databaseUrl: result.data.DATABASE_URL,
    port: result.data.API_PORT,
    webOrigin: result.data.WEB_ORIGIN,
  };
}