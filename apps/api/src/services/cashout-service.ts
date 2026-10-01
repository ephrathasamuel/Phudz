import type { CashoutRequest } from "@phundz/shared";
import { CashoutRepository } from "../repositories/cashout-repository";

export class CashoutService {
  constructor(private readonly repository: CashoutRepository) {}

  create(input: CashoutRequest) {
    return this.repository.create(input.amount, input.phone);
  }

  list(limit: number) {
    return this.repository.list(limit);
  }
}