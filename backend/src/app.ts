import Fastify from "fastify";
import cors from "@fastify/cors";
import { PrismaClient, Categoria, OrigenTransaccion, type Cuenta, type Transaccion } from "@prisma/client";
import { z, ZodError } from "zod";
import { toCuentaResumenDTO } from "./dto/cuenta";
import { toResumenDTO } from "./dto/resumen";
import { toTransferenciaDTO } from "./dto/transferencia";
import { toTransaccionDTO } from "./dto/transaccion";
import {
  crearTransaccion,
  crearTransaccionOCR,
  corregirTransaccionOCR,
  resolverCategoriaPendienteTransaccion,
  crearResumenOCR,
  crearTransferenciaInterna,
} from "./services/transaccion";
import { calcularSaldo } from "./services/saldo";

export function buildApp(prisma: PrismaClient) {
  const app = Fastify({ logger: false });

  async function getCuentaOrThrow(cuentaId: string): Promise<Cuenta> {
    const cuenta = await prisma.cuenta.findUnique({ where: { id: cuentaId } });
    if (!cuenta) throw new Error("Cuenta no encontrada");
    return cuenta;
  }

  async function toCuentaResumen(cuentaId: string) {
    const cuenta = await getCuentaOrThrow(cuentaId);
    const saldoActual = await calcularSaldo(prisma, cuentaId);
    return toCuentaResumenDTO(cuenta, saldoActual);
  }

  async function toTransaccionResponse(transaccion: Transaccion) {
    const cuenta = await toCuentaResumen(transaccion.cuentaId);
    return toTransaccionDTO({ transaccion, cuenta });
  }

  app.register(cors, {
    origin: process.env.ALLOWED_ORIGIN ?? false,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
  });

  const API_TOKEN = process.env.API_TOKEN;
  if (!API_TOKEN) throw new Error("API_TOKEN env var is required");

  app.addHook("onRequest", async (request, reply) => {
    if (request.url === "/health") return;
    const auth = request.headers["authorization"];
    if (auth !== `Bearer ${API_TOKEN}`) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
  });

  app.get("/health", async () => ({ status: "ok" }));

  const GastoSchema = z.object({
    monto: z.string().or(z.number()),
    cuentaId: z.string(),
    categoria: z.nativeEnum(Categoria),
    origen: z.nativeEnum(OrigenTransaccion),
    idempotencyKey: z.string(),
    fecha: z.string().optional(),
    comercio: z.string().optional(),
    cuotaId: z.string().optional(),
  });

  app.post("/transacciones", async (request, reply) => {
    try {
      const body = GastoSchema.parse(request.body);
      const resultado = await crearTransaccion(prisma, body);
      return reply.code(201).send(await toTransaccionResponse(resultado));
    } catch (error) {
      if (error instanceof ZodError) return reply.code(400).send({ error: error.errors });
      return reply.code(400).send({ error: "Invalid payload or business error" });
    }
  });

  app.post("/api/v1/gastos", async (request, reply) => {
    try {
      const data = GastoSchema.parse(request.body);
      const resultado = await crearTransaccion(prisma, data);
      return reply.code(201).send(await toTransaccionResponse(resultado));
    } catch (error) {
      if (error instanceof ZodError) return reply.code(400).send({ error: error.errors });
      return reply.code(500).send({ error: "Internal error" });
    }
  });

  const GastoOCRSchema = z.object({
    textoCrudo: z.string(),
    cuentaId: z.string(),
    idempotencyKey: z.string(),
    data: z.object({
      monto: z.string().or(z.number()).optional(),
      categoria: z.string().optional(),
      comercio: z.string().optional(),
      fecha: z.string().optional(),
    }).optional(),
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

  const ResumenOCRSchema = z.object({
    textoCrudo: z.string(),
    cuentaId: z.string(),
    idempotencyKey: z.string().optional(),
  });

  app.post("/api/v1/gastos/ocr", async (request, reply) => {
    try {
      const data = GastoOCRSchema.parse(request.body);
      const resultado = await crearTransaccionOCR(prisma, data);
      const statusCode =
        resultado.estado === "PENDIENTE_REVISION" || resultado.estado === "PENDIENTE_CATEGORIA"
          ? 202 : 201;
      return reply.code(statusCode).send(await toTransaccionResponse(resultado));
    } catch (error) {
      if (error instanceof ZodError) return reply.code(400).send({ error: error.errors });
      return reply.code(500).send({ error: "Internal error" });
    }
  });

  app.post("/api/v1/transferencias", async (request, reply) => {
    try {
      const data = TransferenciaSchema.parse(request.body);
      const resultado = await crearTransferenciaInterna(prisma, data);
      const [cuentaOrigen, cuentaDestino] = await Promise.all([
        toCuentaResumen(resultado.cuentaOrigenId),
        toCuentaResumen(resultado.cuentaDestinoId),
      ]);
      return reply.code(201).send(toTransferenciaDTO({ transferencia: resultado, cuentaOrigen, cuentaDestino }));
    } catch (error) {
      if (error instanceof ZodError) return reply.code(400).send({ error: error.errors });
      if (error instanceof Error && ["Cuenta origen o destino no encontrada", "Cuenta origen y destino deben ser diferentes", "Fecha inválida"].includes(error.message))
        return reply.code(400).send({ error: error.message });
      return reply.code(500).send({ error: "Internal error" });
    }
  });

  app.post("/api/v1/resumenes/ocr", async (request, reply) => {
    try {
      const data = ResumenOCRSchema.parse(request.body);
      const resultado = await crearResumenOCR(prisma, data);
      return reply.code(201).send(toResumenDTO(resultado));
    } catch (error) {
      if (error instanceof ZodError) return reply.code(400).send({ error: error.errors });
      return reply.code(500).send({ error: "Internal error" });
    }
  });

  app.patch("/api/v1/gastos/ocr/:id/corregir", async (request, reply) => {
    try {
      const params = z.object({ id: z.string() }).parse(request.params);
      const data = CorregirOCRSchema.parse(request.body);
      const resultado = await corregirTransaccionOCR(prisma, params.id, data);
      return reply.code(200).send(await toTransaccionResponse(resultado));
    } catch (error) {
      if (error instanceof ZodError) return reply.code(400).send({ error: error.errors });
      if (error instanceof Error && ["Transaccion no encontrada", "Solo se pueden corregir transacciones OCR pendientes", "Monto inválido", "Fecha inválida"].includes(error.message))
        return reply.code(400).send({ error: error.message });
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
      const resultado = await resolverCategoriaPendienteTransaccion(prisma, params.id, data);
      return reply.code(200).send(await toTransaccionResponse(resultado));
    } catch (error) {
      if (error instanceof ZodError) return reply.code(400).send({ error: error.errors });
      if (error instanceof Error && ["Transaccion no encontrada", "Solo se pueden resolver transacciones con categoria pendiente", "Fecha inválida"].includes(error.message))
        return reply.code(400).send({ error: error.message });
      return reply.code(500).send({ error: "Internal error" });
    }
  });

  return app;
}
