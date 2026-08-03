import type { FastifyReply } from "fastify";
import type { ZodError } from "zod";

export interface ErrorResponseDTO {
  code: string;
  message: string;
  details?: unknown;
}

export function badRequest(reply: FastifyReply, message: string, details?: unknown) {
  return reply.code(400).send({ code: "BAD_REQUEST", message, details } satisfies ErrorResponseDTO);
}

export function unauthorized(reply: FastifyReply) {
  return reply.code(401).send({ code: "UNAUTHORIZED", message: "Invalid or missing Bearer token" } satisfies ErrorResponseDTO);
}

export function notFound(reply: FastifyReply, message: string) {
  return reply.code(404).send({ code: "NOT_FOUND", message } satisfies ErrorResponseDTO);
}

export function internalError(reply: FastifyReply) {
  return reply.code(500).send({ code: "INTERNAL_ERROR", message: "An unexpected error occurred" } satisfies ErrorResponseDTO);
}

export function fromZodError(reply: FastifyReply, error: ZodError) {
  return badRequest(reply, "Validation failed", error.errors);
}

const DOMAIN_400 = new Set([
  "Cuenta origen o destino no encontrada",
  "Cuenta origen y destino deben ser diferentes",
  "Fecha inválida",
  "Monto inválido",
]);

const DOMAIN_404 = new Set([
  "Transaccion no encontrada",
  "Cuenta no encontrada",
]);

const DOMAIN_422 = new Set([
  "Solo se pueden corregir transacciones OCR pendientes",
  "Solo se pueden resolver transacciones con categoria pendiente",
]);

export function fromDomainError(reply: FastifyReply, error: Error) {
  if (DOMAIN_404.has(error.message))
    return reply.code(404).send({ code: "NOT_FOUND", message: error.message } satisfies ErrorResponseDTO);
  if (DOMAIN_400.has(error.message))
    return badRequest(reply, error.message);
  if (DOMAIN_422.has(error.message))
    return reply.code(422).send({ code: "UNPROCESSABLE", message: error.message } satisfies ErrorResponseDTO);
  return internalError(reply);
}
