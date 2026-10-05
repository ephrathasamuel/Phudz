import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts", "apps/**/*.test.{ts,tsx}"],
    restoreMocks: true,
    hookTimeout: 30_000,
  },
});