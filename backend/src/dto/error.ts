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
  "Saldo insuficiente para la transferencia",
  "No se puede confirmar una transaccion sin cuenta",
  "Entidad OCR ya asociada a otra cuenta",
  "La cuenta debe ser una tarjeta de crédito",
  "Categoría no encontrada",
  "No se puede eliminar una compra con cuotas confirmadas",
  "Monto inválido",
  "BANK_STATEMENT_PDF_PASSWORD no está configurada",
  "El archivo PDF está vacío",
  "No se pudo desbloquear el PDF. Verificá la contraseña o el archivo.",
  "No se pudo convertir el PDF a imágenes.",
  "El PDF no contiene páginas renderizables",
  "GEMINI_API_KEY no está configurada",
  "No se pudo analizar el resumen con Gemini",
  "Gemini devolvió una respuesta incompleta; intentá analizar el resumen nuevamente",
  "El resumen no contiene período, monto total o monto mínimo legible",
  "Los últimos dígitos no coinciden con la tarjeta seleccionada",
  "Ya existe un resumen para esa tarjeta y período",
  "Resumen no encontrado",
  "El cargo de resumen ya fue resuelto",
]);
const DOMAIN_404_EXTRA = new Set(["Cargo de resumen no encontrado"]);

const DOMAIN_404 = new Set([
  "Transaccion no encontrada",
  "Cuenta no encontrada",
  "Compra no encontrada",
  "El resumen ya está pagado",
  "El pago supera el saldo pendiente del resumen",
  "La cuenta de pago debe ser una cuenta de fondos",
  "Hay cuotas sin categoría que deben corregirse antes de pagar el resumen",
]);

const DOMAIN_422 = new Set([
  "Solo se pueden corregir transacciones OCR pendientes",
  "Solo se pueden resolver transacciones con categoria pendiente",
]);

export function fromDomainError(reply: FastifyReply, error: Error) {
  if (DOMAIN_404.has(error.message) || DOMAIN_404_EXTRA.has(error.message))
    return reply.code(404).send({ code: "NOT_FOUND", message: error.message } satisfies ErrorResponseDTO);
  if (DOMAIN_400.has(error.message))
    return badRequest(reply, error.message);
  if (DOMAIN_422.has(error.message))
    return reply.code(422).send({ code: "UNPROCESSABLE", message: error.message } satisfies ErrorResponseDTO);
  return internalError(reply);
}
