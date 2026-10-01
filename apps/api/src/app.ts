import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import type { QueryExecutor } from "./db/query-executor";
import { errorHandler, notFoundHandler } from "./errors/error-handler";
import { CashoutRepository } from "./repositories/cashout-repository";
import { registerCashoutRoutes } from "./routes/cashout-routes";
import { CashoutService } from "./services/cashout-service";

export interface AppOptions {
  db: QueryExecutor;
  webOrigin: string;
  logger?: boolean;
}

/** Builds the app without listening, so tests can drive it with `inject()`. */
export async function createApp({ db, webOrigin, logger = false }: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger });

  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);
  // An array makes the plugin echo the origin only on an exact match.
  await app.register(cors, { origin: [webOrigin], methods: ["GET", "POST"] });

  app.get("/health", async () => ({ status: "ok" }));

  const service = new CashoutService(new CashoutRepository(db));
  registerCashoutRoutes(app, service);

  return app;
}
