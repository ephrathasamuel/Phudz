import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { cashoutRequestSchema } from "@phundz/shared";
import { AppError } from "../errors/app-error";
import type { CashoutService } from "../services/cashout-service";

function fieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    if (issue.code === "unrecognized_keys") {
      for (const key of issue.keys) fields[key] ??= issue.message;
      continue;
    }
    const key = String(issue.path[0] ?? "request");
    fields[key] ??= issue.message;
  }
  return fields;
}

export function createCashoutController(service: CashoutService) {
  return {
    create: async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = cashoutRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError(400, "VALIDATION_ERROR", "Request validation failed", fieldErrors(parsed.error));
      }
      const saved = await service.create(parsed.data);
      return reply.code(201).send(saved);
    },
    list: async (request: FastifyRequest<{ Querystring: { limit?: string } }>, reply: FastifyReply) => {
      const rawLimit = request.query.limit;
      if (rawLimit !== undefined && !/^\d+$/.test(rawLimit)) {
        throw new AppError(400, "VALIDATION_ERROR", "Request validation failed", { limit: "Limit must be an integer from 1 to 100" });
      }
      const limit = rawLimit === undefined ? 50 : Number(rawLimit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        throw new AppError(400, "VALIDATION_ERROR", "Request validation failed", { limit: "Limit must be an integer from 1 to 100" });
      }
      return reply.send(await service.list(limit));
    },
  };
}