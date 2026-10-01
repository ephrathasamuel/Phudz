import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import type { ApiErrorBody } from "@phundz/shared";
import { AppError } from "./app-error";

function body(code: string, message: string, fields?: Record<string, string>): ApiErrorBody {
  return { error: { code, message, ...(fields ? { fields } : {}) } };
}

/**
 * Single place that turns any thrown error into the public error shape.
 * Only AppError messages are exposed; everything else is logged and genericized
 * so stack traces and SQL/driver details never reach the client.
 */
export function errorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof AppError) {
    return reply.code(error.statusCode).send(body(error.code, error.message, error.fields));
  }

  // Framework-level client errors (malformed JSON, unsupported content type, body too large).
  const statusCode = "statusCode" in error ? error.statusCode : undefined;
  if (statusCode !== undefined && statusCode >= 400 && statusCode < 500) {
    return reply.code(statusCode).send(body("BAD_REQUEST", "The request could not be processed"));
  }

  request.log.error({ err: error }, "Unhandled error");
  return reply.code(500).send(body("INTERNAL_ERROR", "An unexpected error occurred"));
}

export function notFoundHandler(_request: FastifyRequest, reply: FastifyReply) {
  return reply.code(404).send(body("NOT_FOUND", "Resource not found"));
}
