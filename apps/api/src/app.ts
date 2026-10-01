import cors from "@fastify/cors";
import Fastify from "fastify";
import type { QueryExecutor } from "./db/query-executor";
import { AppError } from "./errors/app-error";
import { CashoutRepository } from "./repositories/cashout-repository";
import { registerCashoutRoutes } from "./routes/cashout-routes";
import { CashoutService } from "./services/cashout-service";

export interface AppOptions {
  db: QueryExecutor;
  webOrigin: string;
}

export async function createApp(options: AppOptions) {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: options.webOrigin, methods: ["GET", "POST"] });
  const service = new CashoutService(new CashoutRepository(options.db));

  app.get("/health", async () => ({ status: "ok" }));
  await registerCashoutRoutes(app, service);

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ error: { code: "NOT_FOUND", message: "Resource not found" } });
  });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.fields ? { fields: error.fields } : {}),
        },
      });
      return;
    }
    if (error.validation) {
      reply.code(400).send({
        error: { code: "VALIDATION_ERROR", message: "Request validation failed", fields: { request: "Invalid request" } },
      });
      return;
    }
    app.log.error(error);
    reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } });
  });

  return app;
}