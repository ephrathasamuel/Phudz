import type { CashoutRequestRecord } from "@phundz/shared";
import type { QueryExecutor } from "../db/query-executor";

export class CashoutRepository {
  constructor(private readonly db: QueryExecutor) {}

  async create(amount: string, phone: string): Promise<CashoutRequestRecord> {
    const result = await this.db.query(
      `INSERT INTO cashout_requests (amount_usdc, phone_number)
       VALUES ($1, $2)
       RETURNING id, amount_usdc::text, phone_number, status, created_at, updated_at`,
      [amount, phone],
    );
    return result.rows[0] as CashoutRequestRecord;
  }

  async list(limit: number): Promise<CashoutRequestRecord[]> {
    const result = await this.db.query(
      `SELECT id, amount_usdc::text, phone_number, status, created_at, updated_at
       FROM cashout_requests
       ORDER BY created_at DESC, id DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows as CashoutRequestRecord[];
  }
}