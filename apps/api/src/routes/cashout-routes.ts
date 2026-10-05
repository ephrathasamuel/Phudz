import type { FastifyInstance } from "fastify";
import { createCashoutController } from "../controllers/cashout-controller";
import type { CashoutService } from "../services/cashout-service";

export function registerCashoutRoutes(app: FastifyInstance, service: CashoutService) {
  const controller = createCashoutController(service);
  app.get("/api/wallet", controller.getWallet);
  app.get("/api/wallet/deposits", controller.getDeposits);
  app.post("/api/quotes", controller.createQuote);
  app.post("/api/cashout-requests", controller.create);
  app.get("/api/cashout-requests", controller.list);
  app.post("/api/webhooks/payout", controller.webhook);
}
