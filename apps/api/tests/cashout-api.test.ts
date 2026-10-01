import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { Pool } from "pg";
import type { CashoutRequestRecord } from "@phundz/shared";
import { createApp } from "../src/app";
import type { QueryExecutor } from "../src/db/query-executor";
import { runMigrations } from "../src/db/migrator";

const WEB_ORIGIN = "http://localhost:3000";
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  console.warn("TEST_DATABASE_URL is not set: skipping PostgreSQL integration tests.");
}

function databaseName(url: string): string {
  return new URL(url).pathname.replace(/^\//, "");
}

describe.skipIf(!testDatabaseUrl)("cash-out API with PostgreSQL", () => {
  let pool: Pool;
  let app: FastifyInstance;

  const post = (payload: unknown) => app.inject({ method: "POST", url: "/api/cashout-requests", payload: payload as object });
  const countRows = async () => Number((await pool.query("SELECT count(*) FROM cashout_requests")).rows[0].count);

  beforeAll(async () => {
    const url = testDatabaseUrl!;
    const appUrl = process.env.DATABASE_URL;
    if (appUrl && databaseName(appUrl) === databaseName(url)) {
      throw new Error("TEST_DATABASE_URL must point at a different database than DATABASE_URL");
    }
    pool = new Pool({ connectionString: url });
    await runMigrations(pool);
    app = await createApp({ db: pool, webOrigin: WEB_ORIGIN });
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE cashout_requests");
  });

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  it("POST saves a pending request with a normalized phone and returns 201", async () => {
    const response = await post({ amount: "12.50", phone: "+254 712-345-678" });

    expect(response.statusCode).toBe(201);
    const body = response.json<CashoutRequestRecord>();
    expect(body).toMatchObject({ amountUsdc: "12.500000", phoneNumber: "+254712345678", status: "pending" });
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(body.createdAt).toISOString()).toBe(body.createdAt);

    const rows = await pool.query("SELECT amount_usdc::text AS amount, phone_number, status FROM cashout_requests WHERE id = $1", [body.id]);
    expect(rows.rows).toEqual([{ amount: "12.500000", phone_number: "+254712345678", status: "pending" }]);
  });

  it("stores boundary amounts exactly", async () => {
    expect((await post({ amount: "1.00", phone: "0712345678" })).json().amountUsdc).toBe("1.000000");
    expect((await post({ amount: "1000.00", phone: "0112345678" })).json().amountUsdc).toBe("1000.000000");
  });

  it.each([
    ["below minimum", "0.50"],
    ["zero", "0"],
    ["negative", "-5"],
    ["non-numeric", "ten"],
    ["too many decimals", "10.001"],
    ["above maximum", "1000.01"],
  ])("POST with %s amount returns 400 with fields.amount and inserts nothing", async (_label, amount) => {
    const response = await post({ amount, phone: "0712345678" });

    expect(response.statusCode).toBe(400);
    const { error } = response.json();
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(typeof error.fields.amount).toBe("string");
    expect(error.fields.phone).toBeUndefined();
    expect(await countRows()).toBe(0);
  });

  it("POST with an invalid phone returns 400 with fields.phone", async () => {
    const response = await post({ amount: "10.00", phone: "0212345678" });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.fields).toEqual({ phone: "Enter a valid Kenyan M-Pesa number" });
    expect(await countRows()).toBe(0);
  });

  it("POST rejects unknown fields and numeric amounts", async () => {
    const unknown = await post({ amount: "10.00", phone: "0712345678", status: "completed" });
    expect(unknown.statusCode).toBe(400);
    expect(unknown.json().error.fields).toEqual({ status: "Unknown field" });

    const numeric = await post({ amount: 10, phone: "0712345678" });
    expect(numeric.statusCode).toBe(400);
    expect(numeric.json().error.fields.amount).toBe("Amount must be sent as a string");
    expect(await countRows()).toBe(0);
  });

  it("POST with malformed JSON returns 400 in the standard shape", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/cashout-requests",
      headers: { "content-type": "application/json" },
      payload: "{not json",
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: { code: "BAD_REQUEST", message: "The request could not be processed" } });
  });

  it("GET returns requests newest first", async () => {
    await pool.query(
      `INSERT INTO cashout_requests (amount_usdc, phone_number, created_at) VALUES
         ('10.00', '+254712345678', now() - interval '2 minutes'),
         ('30.00', '+254712345678', now()),
         ('20.00', '+254712345678', now() - interval '1 minute')`,
    );

    const response = await app.inject({ method: "GET", url: "/api/cashout-requests" });

    expect(response.statusCode).toBe(200);
    const amounts = response.json<CashoutRequestRecord[]>().map((item) => item.amountUsdc);
    expect(amounts).toEqual(["30.000000", "20.000000", "10.000000"]);
  });

  it("GET applies limit and validates it", async () => {
    await post({ amount: "10.00", phone: "0712345678" });
    await post({ amount: "20.00", phone: "0712345678" });

    const limited = await app.inject({ method: "GET", url: "/api/cashout-requests?limit=1" });
    expect(limited.json()).toHaveLength(1);

    for (const limit of ["0", "101", "abc"]) {
      const invalid = await app.inject({ method: "GET", url: `/api/cashout-requests?limit=${limit}` });
      expect(invalid.statusCode).toBe(400);
      expect(invalid.json().error.fields.limit).toBeTruthy();
    }
  });

  it("returns 500 with the generic shape when the database fails, leaking nothing", async () => {
    const secret = 'relation "cashout_requests" does not exist at INSERT INTO cashout_requests';
    const failingDb: QueryExecutor = {
      query: async () => {
        throw Object.assign(new Error(secret), { code: "42P01", position: "13" });
      },
    } as unknown as QueryExecutor;
    const failingApp = await createApp({ db: failingDb, webOrigin: WEB_ORIGIN });

    try {
      for (const request of [
        { method: "POST" as const, url: "/api/cashout-requests", payload: { amount: "10.00", phone: "0712345678" } },
        { method: "GET" as const, url: "/api/cashout-requests" },
      ]) {
        const response = await failingApp.inject(request);
        expect(response.statusCode).toBe(500);
        expect(response.json()).toEqual({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } });
        expect(response.body).not.toMatch(/relation|INSERT|42P01|stack|at /);
      }
    } finally {
      await failingApp.close();
    }
  });
});

describe("cash-out API (no database needed)", () => {
  const unusedDb = {
    query: async () => {
      throw new Error("database should not be called");
    },
  } as unknown as QueryExecutor;

  it("reports health", async () => {
    const app = await createApp({ db: unusedDb, webOrigin: WEB_ORIGIN });
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
    await app.close();
  });

  it("returns 404 in the standard error shape", async () => {
    const app = await createApp({ db: unusedDb, webOrigin: WEB_ORIGIN });
    const response = await app.inject({ method: "GET", url: "/nope" });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: { code: "NOT_FOUND", message: "Resource not found" } });
    await app.close();
  });

  it("allows CORS only for the configured web origin", async () => {
    const app = await createApp({ db: unusedDb, webOrigin: WEB_ORIGIN });
    const allowed = await app.inject({ method: "GET", url: "/health", headers: { origin: WEB_ORIGIN } });
    expect(allowed.headers["access-control-allow-origin"]).toBe(WEB_ORIGIN);

    const blocked = await app.inject({ method: "GET", url: "/health", headers: { origin: "https://evil.example" } });
    expect(blocked.headers["access-control-allow-origin"]).toBeUndefined();
    await app.close();
  });
});
