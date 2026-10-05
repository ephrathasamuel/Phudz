import type { FastifyReply, FastifyRequest } from "fastify";
import type { ZodType, ZodTypeDef } from "zod";
import {
  cashoutRequestSchema,
  listCashoutRequestsQuerySchema,
  quoteRequestSchema,
  toFieldErrors,
  webhookPayoutPayloadSchema,
} from "@phundz/shared";
import { ValidationError } from "../errors/app-error";
import type { CashoutService } from "../services/cashout-service";

function parseOrThrow<T>(schema: ZodType<T, ZodTypeDef, unknown>, input: unknown): T {
  const result = schema.safeParse(input ?? {});
  if (!result.success) throw new ValidationError(toFieldErrors(result.error));
  return result.data;
}

export function createCashoutController(service: CashoutService) {
  return {
    async getWallet(_request: FastifyRequest, reply: FastifyReply) {
      const balance = await service.getWallet("demo_user");
      return reply.send(balance);
    },

    async getDeposits(_request: FastifyRequest, reply: FastifyReply) {
      const deposits = await service.getDeposits("demo_user");
      return reply.send(deposits);
    },

    async createQuote(request: FastifyRequest, reply: FastifyReply) {
      const input = parseOrThrow(quoteRequestSchema, request.body);
      const quote = await service.createQuote(input, "demo_user");
      return reply.code(201).send(quote);
    },

    async create(request: FastifyRequest, reply: FastifyReply) {
      const input = parseOrThrow(cashoutRequestSchema, request.body);
      const saved = await service.createRequest(input, "demo_user");
      return reply.code(201).send(saved);
    },

    async list(request: FastifyRequest, reply: FastifyReply) {
      const { limit } = parseOrThrow(listCashoutRequestsQuerySchema, request.query);
      return reply.send(await service.listRequests(limit, "demo_user"));
    },

    async webhook(request: FastifyRequest, reply: FastifyReply) {
      const payload = parseOrThrow(webhookPayoutPayloadSchema, request.body);
      const updated = await service.handlePayoutWebhook(payload);
      return reply.code(200).send({ received: true, request: updated });
    },
  };
}
