import type { CashoutRequest, CashoutRequestRecord } from "@phundz/shared";
import type { CashoutRepository } from "../repositories/cashout-repository";

/**
 * Cash-out use cases. Simulation only: requests are recorded as "pending" and
 * nothing here (or anywhere in this app) processes or pays them out.
 */
export class CashoutService {
  constructor(private readonly repository: CashoutRepository) {}

  createRequest(input: CashoutRequest): Promise<CashoutRequestRecord> {
    return this.repository.create(input.amount, input.phone);
  }

  listRequests(limit: number): Promise<CashoutRequestRecord[]> {
    return this.repository.listNewestFirst(limit);
  }
}
