import type { Pool } from "pg";

export type QueryExecutor = Pick<Pool, "query">;