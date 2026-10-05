import type { CashoutRequestRecord, CashoutStatus } from "@phundz/shared";
import type { QueryExecutor } from "../db/query-executor";

interface CashoutRequestRow {
  id: string;
  user_id: string;
  amount_usdc: string;
  fee_usdc: string;
  rate_kes: string;
  net_kes: string;
  phone_number: string;
  recipient_name: string | null;
  status: CashoutStatus;
  quote_id: string | null;
  idempotency_key: string | null;
  provider_reference: string | null;
  mpesa_receipt_number: string | null;
  failure_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS = `
  id,
  user_id,
  amount_usdc::text AS amount_usdc,
  fee_usdc::text AS fee_usdc,
  rate_kes::text AS rate_kes,
  net_kes::text AS net_kes,
  phone_number,
  recipient_name,
  status,
  quote_id,
  idempotency_key,
  provider_reference,
  mpesa_receipt_number,
  failure_reason,
  created_at,
  updated_at
`;

function toRecord(row: CashoutRequestRow): CashoutRequestRecord {
  return {
    id: row.id,
    userId: row.user_id,
    amountUsdc: row.amount_usdc,
    feeUsdc: row.fee_usdc,
    rateKes: row.rate_kes,
    netKes: row.net_kes,
    phoneNumber: row.phone_number,
    recipientName: row.recipient_name,
    status: row.status,
    quoteId: row.quote_id,
    idempotencyKey: row.idempotency_key,
    providerReference: row.provider_reference,
    mpesaReceiptNumber: row.mpesa_receipt_number,
    failureReason: row.failure_reason,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export interface CreateCashoutParams {
  amountUsdc: string;
  phoneNumber: string;
  userId?: string;
  quoteId?: string;
  feeUsdc?: string;
  rateKes?: string;
  netKes?: string;
  recipientName?: string;
  idempotencyKey?: string;
  providerReference?: string;
  status?: CashoutStatus;
}

export class CashoutRepository {
  constructor(private readonly db: QueryExecutor) {}

  async create(params: CreateCashoutParams | string, legacyPhone?: string): Promise<CashoutRequestRecord> {
    // Backwards compatibility with legacy create(amountUsdc, phoneNumber)
    const normalized: CreateCashoutParams =
      typeof params === "string"
        ? { amountUsdc: params, phoneNumber: legacyPhone! }
        : params;

    // Check for idempotency match if provided
    if (normalized.idempotencyKey) {
      const existing = await this.findByIdempotencyKey(normalized.idempotencyKey);
      if (existing) return existing;
    }

    const result = await this.db.query<CashoutRequestRow>(
      `INSERT INTO cashout_requests (
         user_id, amount_usdc, fee_usdc, rate_kes, net_kes,
         phone_number, recipient_name, status, quote_id,
         idempotency_key, provider_reference
       )
       VALUES (
         $1, $2::numeric, $3::numeric, $4::numeric, $5::numeric,
         $6, $7, $8, $9, $10, $11
       )
       RETURNING ${COLUMNS}`,
      [
        normalized.userId ?? "demo_user",
        normalized.amountUsdc,
        normalized.feeUsdc ?? "0",
        normalized.rateKes ?? "0",
        normalized.netKes ?? "0",
        normalized.phoneNumber,
        normalized.recipientName ?? null,
        normalized.status ?? "pending",
        normalized.quoteId ?? null,
        normalized.idempotencyKey ?? null,
        normalized.providerReference ?? null,
      ],
    );

    const row = result.rows[0];
    if (!row) throw new Error("Insert returned no row");
    return toRecord(row);
  }

  async findById(id: string): Promise<CashoutRequestRecord | null> {
    const result = await this.db.query<CashoutRequestRow>(
      `SELECT ${COLUMNS} FROM cashout_requests WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row ? toRecord(row) : null;
  }

  async findByIdempotencyKey(key: string): Promise<CashoutRequestRecord | null> {
    const result = await this.db.query<CashoutRequestRow>(
      `SELECT ${COLUMNS} FROM cashout_requests WHERE idempotency_key = $1`,
      [key],
    );
    const row = result.rows[0];
    return row ? toRecord(row) : null;
  }

  async updateStatus(
    id: string,
    status: CashoutStatus,
    updates?: {
      mpesaReceiptNumber?: string;
      failureReason?: string;
      providerReference?: string;
    },
  ): Promise<CashoutRequestRecord | null> {
    const result = await this.db.query<CashoutRequestRow>(
      `UPDATE cashout_requests
       SET status = $2,
           mpesa_receipt_number = COALESCE($3, mpesa_receipt_number),
           failure_reason = COALESCE($4, failure_reason),
           provider_reference = COALESCE($5, provider_reference),
           updated_at = now()
       WHERE id = $1
       RETURNING ${COLUMNS}`,
      [
        id,
        status,
        updates?.mpesaReceiptNumber ?? null,
        updates?.failureReason ?? null,
        updates?.providerReference ?? null,
      ],
    );

    const row = result.rows[0];
    return row ? toRecord(row) : null;
  }

  async listNewestFirst(limit: number, userId?: string): Promise<CashoutRequestRecord[]> {
    const query = userId
      ? `SELECT ${COLUMNS} FROM cashout_requests WHERE user_id = $2 ORDER BY created_at DESC, id DESC LIMIT $1`
      : `SELECT ${COLUMNS} FROM cashout_requests ORDER BY created_at DESC, id DESC LIMIT $1`;
    const params = userId ? [limit, userId] : [limit];

    const result = await this.db.query<CashoutRequestRow>(query, params);
    return result.rows.map(toRecord);
  }
}
