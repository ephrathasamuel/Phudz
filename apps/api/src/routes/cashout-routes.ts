import type { FastifyInstance } from "fastify";
import { createCashoutController } from "../controllers/cashout-controller";
import type { CashoutService } from "../services/cashout-service";

export function registerCashoutRoutes(app: FastifyInstance, service: CashoutService) {
  const controller = createCashoutController(service);
  app.post("/api/cashout-requests", controller.create);
  app.get("/api/cashout-requests", controller.list);
}
