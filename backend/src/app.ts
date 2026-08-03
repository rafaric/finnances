import Fastify from "fastify";
import cors from "@fastify/cors";
import { PrismaClient, Categoria, OrigenTransaccion, EstadoTransaccion, type Cuenta, type Transaccion } from "@prisma/client";
import { z, ZodError } from "zod";
import { toCuentaResumenDTO, toCuentaDTO } from "./dto/cuenta";
import { toResumenDTO } from "./dto/resumen";
import { toTransferenciaDTO } from "./dto/transferencia";
import { toTransaccionDTO } from "./dto/transaccion";
import { unauthorized, fromZodError, fromDomainError, internalError } from "./dto/error";
import { toPaginatedDTO } from "./dto/paginated";import {
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

  async function toCuentaResponse(cuenta: Cuenta) {
    const saldoActual = await calcularSaldo(prisma, cuenta.id);
    return toCuentaDTO(cuenta, saldoActual);
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
    if (auth !== `Bearer ${API_TOKEN}`) return unauthorized(reply);
  });

  app.setErrorHandler((_error, _request, reply) => internalError(reply));

  app.get("/health", async () => ({ status: "ok" }));

  const CuentaSchema = z.object({
    nombre: z.string().min(1),
    tipo: z.enum(["EFECTIVO", "BILLETERA_VIRTUAL", "CUENTA_BANCARIA", "TARJETA_CREDITO"]),
    saldoInicial: z.string().or(z.number()).optional(),
    banco: z.string().optional(),
    ultimosDigitos: z.string().max(4).optional(),
    colorIdentificador: z.string().optional(),
    diaCierre: z.number().int().min(1).max(31).optional(),
    diaPago: z.number().int().min(1).max(31).optional(),
  });

  app.post("/api/v1/cuentas", async (request, reply) => {
    try {
      const data = CuentaSchema.parse(request.body);
      const cuenta = await prisma.cuenta.create({
        data: {
          nombre: data.nombre,
          tipo: data.tipo as any,
          saldoInicial: data.saldoInicial != null ? String(data.saldoInicial) : "0",
          banco: data.banco,
          ultimosDigitos: data.ultimosDigitos,
          colorIdentificador: data.colorIdentificador,
          diaCierre: data.diaCierre,
          diaPago: data.diaPago,
        },
      });
      return reply.code(201).send(await toCuentaResponse(cuenta));
    } catch (error) {
      if (error instanceof ZodError) return fromZodError(reply, error);
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
    }
  });

  app.get("/api/v1/cuentas", async (_request, reply) => {
    try {
      const cuentas = await prisma.cuenta.findMany({ orderBy: { nombre: "asc" } });
      const dtos = await Promise.all(cuentas.map(toCuentaResponse));
      return reply.send(dtos);
    } catch (error) {
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
    }
  });

  const TransaccionesQuerySchema = z.object({
    cuentaId: z.string().optional(),
    periodo: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    categoria: z.nativeEnum(Categoria).optional(),
    estado: z.nativeEnum(EstadoTransaccion).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  });

  app.get("/api/v1/transacciones", async (request, reply) => {
    try {
      const query = TransaccionesQuerySchema.parse(request.query);
      const { cuentaId, periodo, categoria, estado, page, limit } = query;

      const where: any = {};
      if (cuentaId) where.cuentaId = cuentaId;
      if (categoria) where.categoria = categoria;
      if (estado) where.estado = estado;
      if (periodo) {
        const start = new Date(`${periodo}-01T00:00:00.000Z`);
        const end = new Date(start);
        end.setUTCMonth(end.getUTCMonth() + 1);
        where.fecha = { gte: start, lt: end };
      }

      const [transacciones, total] = await Promise.all([
        prisma.transaccion.findMany({
          where,
          orderBy: { fecha: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.transaccion.count({ where }),
      ]);

      const items = await Promise.all(transacciones.map(toTransaccionResponse));
      return reply.send(toPaginatedDTO(items, page, limit, total));
    } catch (error) {
      if (error instanceof ZodError) return fromZodError(reply, error);
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
    }
  });

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
      if (error instanceof ZodError) return fromZodError(reply, error);
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
    }
  });

  app.post("/api/v1/gastos", async (request, reply) => {
    try {
      const data = GastoSchema.parse(request.body);
      const resultado = await crearTransaccion(prisma, data);
      return reply.code(201).send(await toTransaccionResponse(resultado));
    } catch (error) {
      if (error instanceof ZodError) return fromZodError(reply, error);
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
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
      if (error instanceof ZodError) return fromZodError(reply, error);
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
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
      if (error instanceof ZodError) return fromZodError(reply, error);
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
    }
  });

  app.post("/api/v1/resumenes/ocr", async (request, reply) => {
    try {
      const data = ResumenOCRSchema.parse(request.body);
      const resultado = await crearResumenOCR(prisma, data);
      return reply.code(201).send(toResumenDTO(resultado));
    } catch (error) {
      if (error instanceof ZodError) return fromZodError(reply, error);
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
    }
  });

  app.patch("/api/v1/gastos/ocr/:id/corregir", async (request, reply) => {
    try {
      const params = z.object({ id: z.string() }).parse(request.params);
      const data = CorregirOCRSchema.parse(request.body);
      const resultado = await corregirTransaccionOCR(prisma, params.id, data);
      return reply.code(200).send(await toTransaccionResponse(resultado));
    } catch (error) {
      if (error instanceof ZodError) return fromZodError(reply, error);
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
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
      if (error instanceof ZodError) return fromZodError(reply, error);
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
    }
  });

  return app;
}
