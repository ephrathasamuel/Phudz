import type { CashoutRequestRecord, CashoutStatus } from "@phundz/shared";
import type { QueryExecutor } from "../db/query-executor";

interface CashoutRequestRow {
  id: string;
  // Selected as ::text so NUMERIC never passes through a JS number.
  amount_usdc: string;
  phone_number: string;
  status: CashoutStatus;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS = "id, amount_usdc::text AS amount_usdc, phone_number, status, created_at, updated_at";

function toRecord(row: CashoutRequestRow): CashoutRequestRecord {
  return {
    id: row.id,
    amountUsdc: row.amount_usdc,
    phoneNumber: row.phone_number,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export class CashoutRepository {
  constructor(private readonly db: QueryExecutor) {}

  async create(amountUsdc: string, phoneNumber: string): Promise<CashoutRequestRecord> {
    const result = await this.db.query<CashoutRequestRow>(
      `INSERT INTO cashout_requests (amount_usdc, phone_number)
       VALUES ($1::numeric, $2)
       RETURNING ${COLUMNS}`,
      [amountUsdc, phoneNumber],
    );
    const row = result.rows[0];
    if (!row) throw new Error("Insert returned no row");
    return toRecord(row);
  }

  async listNewestFirst(limit: number): Promise<CashoutRequestRecord[]> {
    const result = await this.db.query<CashoutRequestRow>(
      `SELECT ${COLUMNS}
       FROM cashout_requests
       ORDER BY created_at DESC, id DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows.map(toRecord);
  }
}
