import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { createApp } from "../src/app";
import type { QueryExecutor } from "../src/db/query-executor";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integration = describe.skipIf(!testDatabaseUrl);

integration("cash-out API with PostgreSQL", () => {
  const pool = new Pool({ connectionString: testDatabaseUrl });
  let app: Awaited<ReturnType<typeof createApp>>;

  beforeAll(async () => {
    const appDatabaseUrl = process.env.DATABASE_URL;
    if (appDatabaseUrl && new URL(appDatabaseUrl).pathname === new URL(testDatabaseUrl!).pathname) {
      throw new Error("TEST_DATABASE_URL must use a separate database from DATABASE_URL");
    }
    await pool.query(`CREATE TABLE IF NOT EXISTS cashout_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      amount_usdc NUMERIC(18,6) NOT NULL CHECK (amount_usdc > 0),
      phone_number TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    app = await createApp({ db: pool, webOrigin: "http://localhost:3000" });
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE cashout_requests");
  });

  afterAll(async () => {
    await app?.close();
    await pool.end();
  });

  it("saves a normalized pending request", async () => {
    const response = await app.inject({ method: "POST", url: "/api/cashout-requests", payload: { amount: "12.50", phone: "0712345678" } });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ amount_usdc: "12.500000", phone_number: "+254712345678", status: "pending" });
    const saved = await pool.query("SELECT id FROM cashout_requests");
    expect(saved.rowCount).toBe(1);
  });

  it("rejects invalid amounts without inserting", async () => {
    const response = await app.inject({ method: "POST", url: "/api/cashout-requests", payload: { amount: "0.50", phone: "0712345678" } });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.fields.amount).toBeTruthy();
    expect((await pool.query("SELECT id FROM cashout_requests")).rowCount).toBe(0);
  });

  it("rejects invalid phone numbers", async () => {
    const response = await app.inject({ method: "POST", url: "/api/cashout-requests", payload: { amount: "10.00", phone: "123" } });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.fields.phone).toBeTruthy();
  });

  it("returns requests newest first", async () => {
    await app.inject({ method: "POST", url: "/api/cashout-requests", payload: { amount: "10.00", phone: "0712345678" } });
    await app.inject({ method: "POST", url: "/api/cashout-requests", payload: { amount: "20.00", phone: "0712345679" } });
    await pool.query("UPDATE cashout_requests SET created_at = now() - interval '1 minute' WHERE amount_usdc = 10");
    const response = await app.inject({ method: "GET", url: "/api/cashout-requests" });
    expect(response.json().map((item: { amount_usdc: string }) => item.amount_usdc)).toEqual(["20.000000", "10.000000"]);
  });

  it("returns a generic error when the database fails", async () => {
    const failingDb = { query: async () => { throw new Error("secret SQL details"); } } as unknown as QueryExecutor;
    const failingApp = await createApp({ db: failingDb, webOrigin: "http://localhost:3000" });
    const response = await failingApp.inject({ method: "POST", url: "/api/cashout-requests", payload: { amount: "10.00", phone: "0712345678" } });
    await failingApp.close();
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } });
    expect(response.body).not.toContain("secret SQL details");
  });
});

describe("cash-out API without database setup", () => {
  it("reports health and not-found consistently", async () => {
    const db = { query: async () => ({ rows: [] }) } as unknown as QueryExecutor;
    const app = await createApp({ db, webOrigin: "http://localhost:3000" });
    expect((await app.inject({ method: "GET", url: "/health" })).json()).toEqual({ status: "ok" });
    const missing = await app.inject({ method: "GET", url: "/missing" });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe("NOT_FOUND");
    await app.close();
  });
});