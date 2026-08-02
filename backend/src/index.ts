import Fastify from "fastify";
import cors from "@fastify/cors";
import { PrismaClient, Categoria } from "@prisma/client";
import { z, ZodError } from "zod";
import {
  crearTransaccion,
  crearTransaccionOCR,
  corregirTransaccionOCR,
  resolverCategoriaPendienteTransaccion,
  crearTransferenciaInterna,
} from "./services/transaccion";

const app = Fastify({ logger: true });
const prisma = new PrismaClient();

app.register(cors, { origin: true });

app.get("/health", async () => ({ status: "ok" }));

app.post("/transacciones", async (request, reply) => {
  try {
    const body = request.body as any;
    const resultado = await crearTransaccion(prisma, body);
    return reply.code(201).send(resultado);
  } catch (error) {
    request.log.error(error);
    return reply.code(400).send({ error: "Invalid payload or business error" });
  }
});

const GastoSchema = z.object({
  monto: z.string().or(z.number()),
  cuentaId: z.string(),
  categoria: z.string(),
  origen: z.string(),
  idempotencyKey: z.string(),
  fecha: z.string().optional(),
  comercio: z.string().optional(),
  cuotaId: z.string().optional(),
  transferenciaInternaId: z.string().optional(),
});

app.post("/api/v1/gastos", async (request, reply) => {
  try {
    const data = GastoSchema.parse(request.body);
    const resultado = await crearTransaccion(prisma, data as any);
    return reply.code(201).send(resultado);
  } catch (error) {
    request.log.error(error);
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: error.errors });
    }
    return reply.code(500).send({ error: "Internal error" });
  }
});

const GastoOCRSchema = z.object({
  textoCrudo: z.string(),
  cuentaId: z.string(),
  idempotencyKey: z.string(),
  data: z
    .object({
      monto: z.string().or(z.number()).optional(),
      categoria: z.string().optional(),
      comercio: z.string().optional(),
      fecha: z.string().optional(),
    })
    .optional(),
});

const CorregirOCRSchema = z.object({
  monto: z.string().or(z.number()).optional(),
  categoria: z.nativeEnum(Categoria).optional(),
  comercio: z.string().optional(),
  fecha: z.string().optional(),
});

const TransferenciaSchema = z.object({
  cuentaOrigenId: z.string(),
  cuentaDestinoId: z.string(),
  monto: z.string().or(z.number()),
  nota: z.string().optional(),
  fecha: z.string().optional(),
  idempotencyKey: z.string(),
});

app.post("/api/v1/gastos/ocr", async (request, reply) => {
  try {
    const data = GastoOCRSchema.parse(request.body);
    const resultado = await crearTransaccionOCR(prisma, data);
    const statusCode =
      resultado.estado === "PENDIENTE_REVISION" ||
      resultado.estado === "PENDIENTE_CATEGORIA"
        ? 202
        : 201;
    return reply.code(statusCode).send(resultado);
  } catch (error) {
    request.log.error(error);
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: error.errors });
    }
    return reply.code(500).send({ error: "Internal error" });
  }
});

app.post("/api/v1/transferencias", async (request, reply) => {
  try {
    const data = TransferenciaSchema.parse(request.body);
    const resultado = await crearTransferenciaInterna(prisma, data);
    return reply.code(201).send(resultado);
  } catch (error) {
    request.log.error(error);
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: error.errors });
    }
    if (
      error instanceof Error &&
      [
        "Cuenta origen o destino no encontrada",
        "Cuenta origen y destino deben ser diferentes",
        "Fecha inválida",
      ].includes(error.message)
    ) {
      return reply.code(400).send({ error: error.message });
    }
    return reply.code(500).send({ error: "Internal error" });
  }
});

app.patch("/api/v1/gastos/ocr/:id/corregir", async (request, reply) => {
  try {
    const params = z.object({ id: z.string() }).parse(request.params);
    const data = CorregirOCRSchema.parse(request.body);
    const resultado = await corregirTransaccionOCR(prisma, params.id, data);
    return reply.code(200).send(resultado);
  } catch (error) {
    request.log.error(error);
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: error.errors });
    }
    if (
      error instanceof Error &&
      [
        "Transaccion no encontrada",
        "Solo se pueden corregir transacciones OCR pendientes",
        "Monto inválido",
        "Fecha inválida",
      ].includes(error.message)
    ) {
      return reply.code(400).send({ error: error.message });
    }
    return reply.code(500).send({ error: "Internal error" });
  }
});

const ResolverCategoriaSchema = z.object({
  categoria: z.nativeEnum(Categoria),
  comercio: z.string().optional(),
  fecha: z.string().optional(),
});

app.patch("/api/v1/transacciones/:id/categoria", async (request, reply) => {
  try {
    const params = z.object({ id: z.string() }).parse(request.params);
    const data = ResolverCategoriaSchema.parse(request.body);
    const resultado = await resolverCategoriaPendienteTransaccion(
      prisma,
      params.id,
      data,
    );
    return reply.code(200).send(resultado);
  } catch (error) {
    request.log.error(error);
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: error.errors });
    }
    if (
      error instanceof Error &&
      [
        "Transaccion no encontrada",
        "Solo se pueden resolver transacciones con categoria pendiente",
        "Fecha inválida",
      ].includes(error.message)
    ) {
      return reply.code(400).send({ error: error.message });
    }
    return reply.code(500).send({ error: "Internal error" });
  }
});

const start = async () => {
  try {
    await app.listen({ port: 4000, host: "0.0.0.0" });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
