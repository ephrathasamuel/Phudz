import type { FastifyInstance } from "fastify";
import type { CashoutService } from "../services/cashout-service";
import { createCashoutController } from "../controllers/cashout-controller";

export async function registerCashoutRoutes(app: FastifyInstance, service: CashoutService) {
  const controller = createCashoutController(service);
  app.post("/api/cashout-requests", controller.create);
  app.get<{ Querystring: { limit?: string } }>("/api/cashout-requests", controller.list);
}