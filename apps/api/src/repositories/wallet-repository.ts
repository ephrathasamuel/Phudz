import type { WalletBalance } from "@phundz/shared";
import type { QueryExecutor } from "../db/query-executor";
import { AppError } from "../errors/app-error";

interface WalletRow {
  user_id: string;
  balance_usdc: string;
  held_usdc: string;
  total_usdc: string;
}

export class WalletRepository {
  constructor(private readonly db: QueryExecutor) {}

  async getWallet(userId: string = "demo_user"): Promise<WalletBalance> {
    const result = await this.db.query<WalletRow>(
      `SELECT
         user_id,
         balance_usdc::text AS balance_usdc,
         held_usdc::text AS held_usdc,
         (balance_usdc + held_usdc)::text AS total_usdc
       FROM wallets
       WHERE user_id = $1`,
      [userId],
    );

    const row = result.rows[0];
    if (!row) {
      // Auto-provision demo wallet if missing
      const inserted = await this.db.query<WalletRow>(
        `INSERT INTO wallets (user_id, balance_usdc, held_usdc)
         VALUES ($1, 2500.000000, 0)
         ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
         RETURNING
           user_id,
           balance_usdc::text AS balance_usdc,
           held_usdc::text AS held_usdc,
           (balance_usdc + held_usdc)::text AS total_usdc`,
        [userId],
      );
      const newRow = inserted.rows[0]!;
      return {
        userId: newRow.user_id,
        availableUsdc: newRow.balance_usdc,
        heldUsdc: newRow.held_usdc,
        totalUsdc: newRow.total_usdc,
        currency: "USDC",
      };
    }

    return {
      userId: row.user_id,
      availableUsdc: row.balance_usdc,
      heldUsdc: row.held_usdc,
      totalUsdc: row.total_usdc,
      currency: "USDC",
    };
  }

  /**
   * Places a hold on the user's available USDC balance.
   * Throws 400 InsufficientFundsError if available balance is lower than the requested amount.
   */
  async placeHold(userId: string, amountUsdc: string): Promise<void> {
    const result = await this.db.query(
      `UPDATE wallets
       SET balance_usdc = balance_usdc - $2::numeric,
           held_usdc = held_usdc + $2::numeric,
           updated_at = now()
       WHERE user_id = $1 AND balance_usdc >= $2::numeric`,
      [userId, amountUsdc],
    );

    if (result.rowCount === 0) {
      throw new AppError(
        400,
        "INSUFFICIENT_FUNDS",
        "Insufficient available balance in your wallet to cover this cash-out request.",
        { amount: "Insufficient available balance" },
      );
    }
  }

  /**
   * Releases a hold back to available balance when a payout fails.
   */
  async releaseHold(userId: string, amountUsdc: string): Promise<void> {
    await this.db.query(
      `UPDATE wallets
       SET balance_usdc = balance_usdc + $2::numeric,
           held_usdc = GREATEST(0, held_usdc - $2::numeric),
           updated_at = now()
       WHERE user_id = $1`,
      [userId, amountUsdc],
    );
  }

  /**
   * Settles a hold permanently when a payout completes.
   */
  async settleDebit(userId: string, amountUsdc: string): Promise<void> {
    await this.db.query(
      `UPDATE wallets
       SET held_usdc = GREATEST(0, held_usdc - $2::numeric),
           updated_at = now()
       WHERE user_id = $1`,
      [userId, amountUsdc],
    );
  }
}
