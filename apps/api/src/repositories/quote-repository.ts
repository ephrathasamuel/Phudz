import type { QuoteRecord } from "@phundz/shared";
import type { QueryExecutor } from "../db/query-executor";

interface QuoteRow {
  id: string;
  user_id: string;
  amount_usdc: string;
  fee_usdc: string;
  rate_kes_per_usdc: string;
  net_kes: string;
  recipient_phone: string;
  recipient_name: string;
  expires_at: Date;
  created_at: Date;
}

const COLUMNS = `
  id,
  user_id,
  amount_usdc::text AS amount_usdc,
  fee_usdc::text AS fee_usdc,
  rate_kes_per_usdc::text AS rate_kes_per_usdc,
  net_kes::text AS net_kes,
  recipient_phone,
  recipient_name,
  expires_at,
  created_at
`;

function toRecord(row: QuoteRow): QuoteRecord {
  const ttlSeconds = Math.max(0, Math.floor((row.expires_at.getTime() - Date.now()) / 1000));
  const amountNum = parseFloat(row.amount_usdc);
  const rateNum = parseFloat(row.rate_kes_per_usdc);
  const grossKes = (amountNum * rateNum).toFixed(2);

  return {
    id: row.id,
    amountUsdc: row.amount_usdc,
    feeUsdc: row.fee_usdc,
    rateKes: row.rate_kes_per_usdc,
    grossKes,
    netKes: row.net_kes,
    recipientPhone: row.recipient_phone,
    recipientName: row.recipient_name,
    expiresAt: row.expires_at.toISOString(),
    ttlSeconds,
  };
}

export class QuoteRepository {
  constructor(private readonly db: QueryExecutor) {}

  async save(
    quote: Omit<QuoteRecord, "id" | "ttlSeconds"> & { userId?: string },
  ): Promise<QuoteRecord> {
    const result = await this.db.query<QuoteRow>(
      `INSERT INTO quotes (
         user_id, amount_usdc, fee_usdc, rate_kes_per_usdc,
         net_kes, recipient_phone, recipient_name, expires_at
       )
       VALUES (
         $1, $2::numeric, $3::numeric, $4::numeric,
         $5::numeric, $6, $7, $8
       )
       RETURNING ${COLUMNS}`,
      [
        quote.userId ?? "demo_user",
        quote.amountUsdc,
        quote.feeUsdc,
        quote.rateKes,
        quote.netKes,
        quote.recipientPhone,
        quote.recipientName,
        quote.expiresAt,
      ],
    );

    const row = result.rows[0];
    if (!row) throw new Error("Insert quote returned no row");
    return toRecord(row);
  }

  async getValidQuote(quoteId: string): Promise<QuoteRecord | null> {
    const result = await this.db.query<QuoteRow>(
      `SELECT ${COLUMNS}
       FROM quotes
       WHERE id = $1 AND expires_at > now()`,
      [quoteId],
    );

    const row = result.rows[0];
    return row ? toRecord(row) : null;
  }
}
