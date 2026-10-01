import type { FastifyReply, FastifyRequest } from "fastify";
import type { ZodType, ZodTypeDef } from "zod";
import { cashoutRequestSchema, listCashoutRequestsQuerySchema, toFieldErrors } from "@phundz/shared";
import { ValidationError } from "../errors/app-error";
import type { CashoutService } from "../services/cashout-service";

function parseOrThrow<T>(schema: ZodType<T, ZodTypeDef, unknown>, input: unknown): T {
  const result = schema.safeParse(input ?? {});
  if (!result.success) throw new ValidationError(toFieldErrors(result.error));
  return result.data;
}

export function createCashoutController(service: CashoutService) {
  return {
    async create(request: FastifyRequest, reply: FastifyReply) {
      const input = parseOrThrow(cashoutRequestSchema, request.body);
      const saved = await service.createRequest(input);
      return reply.code(201).send(saved);
    },

    async list(request: FastifyRequest, reply: FastifyReply) {
      const { limit } = parseOrThrow(listCashoutRequestsQuerySchema, request.query);
      return reply.send(await service.listRequests(limit));
    },
  };
}
