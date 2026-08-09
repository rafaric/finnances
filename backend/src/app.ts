import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { PrismaClient, OrigenTransaccion, EstadoTransaccion, type Cuenta, type Transaccion } from "@prisma/client";
import { z, ZodError } from "zod";
import { toCuentaResumenDTO, toCuentaDTO } from "./dto/cuenta";
import { toResumenDTO } from "./dto/resumen";
import { toResumenMensualDTO } from "./dto/resumenMensual";
import { toTransferenciaDTO } from "./dto/transferencia";
import { toTransaccionDTO } from "./dto/transaccion";
import { toCategoriaDTO, toSubcategoriaDTO } from "./dto/categoria";
import { toCompraDTO, toCuotaDTO } from "./dto/compra";
import { unauthorized, fromZodError, fromDomainError, internalError } from "./dto/error";
import { toPaginatedDTO } from "./dto/paginated";
import {
  crearTransaccion,
  crearTransaccionOCR,
  corregirTransaccionOCR,
  resolverCategoriaPendienteTransaccion,
  crearResumenOCR,
  crearTransferenciaInterna,
} from "./services/transaccion";
import { calcularSaldo } from "./services/saldo";
import { calcularResumenMensual } from "./services/resumenMensual";
import { crearIngreso } from "./services/ingreso";
import { toIngresoDTO } from "./dto/ingreso";
import {
  confirmarInstanciaRecurrente,
  actualizarRecurrente,
  crearRecurrente,
  generarInstanciaRecurrente,
  listarInstanciasRecurrentes,
  listarInstanciasProximas,
  listarRecurrentes,
  omitirInstanciaRecurrente,
  proyectarInstanciasDelPeriodo,
} from "./services/recurrente";
import { crearCompra, eliminarCompra, listarCompras, listarCuotas } from "./services/compra";
import { renderProtectedPdf } from "./services/procesarResumenPdf";
import { analizarResumenConGemini } from "./services/geminiResumen";
import { crearResumenDesdeGemini, listarResumens, reconciliarResumen } from "./services/resumen";
import { listarCargosResumen, resolverCargoResumen } from "./services/cargoResumen";
import { registrarPagoResumen } from "./services/pagoResumen";
import { registrarDebitosAutomaticos } from "./services/pagoResumen";
import { toCargoResumenDTO } from "./dto/cargoResumen";
import { toPagoResumenDTO } from "./dto/pagoResumen";

function normalizeEntity(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

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
    const [cuenta, categoria, subcategoria] = await Promise.all([
      transaccion.cuentaId ? await toCuentaResumen(transaccion.cuentaId) : undefined,
      transaccion.categoriaId ? await prisma.categoria.findUnique({ where: { id: transaccion.categoriaId } }) : null,
      transaccion.subcategoriaId ? await prisma.subcategoria.findUnique({ where: { id: transaccion.subcategoriaId } }) : null,
    ]);
    return toTransaccionDTO({ transaccion, cuenta, categoria: categoria!, subcategoria });
  }

  app.register(cors, {
    origin: process.env.ALLOWED_ORIGIN ?? false,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
  });

  app.register(multipart, {
    limits: { files: 1, fileSize: 15 * 1024 * 1024 },
    throwFileSizeLimit: true,
  });

  const API_TOKEN = process.env.API_TOKEN;
  if (!API_TOKEN) throw new Error("API_TOKEN env var is required");

  app.addHook("onRequest", async (request, reply) => {
    if (request.url === "/health") return;
    const auth = request.headers["authorization"];
    if (auth !== `Bearer ${API_TOKEN}`) return unauthorized(reply);
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error, route: request.url }, "Unhandled request error");
    return internalError(reply);
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.post("/api/v1/resumenes/pdf/render", async (request, reply) => {
    try {
      const file = await request.file();
      if (!file) return reply.code(400).send({ code: "BAD_REQUEST", message: "Se requiere un archivo PDF" });
      if (file.mimetype !== "application/pdf") {
        return reply.code(400).send({ code: "BAD_REQUEST", message: "El archivo debe ser un PDF" });
      }

      const rendered = await renderProtectedPdf(await file.toBuffer());
      return reply.send({
        pageCount: rendered.pages.length,
        pages: rendered.pages.map((page) => ({ pageNumber: page.pageNumber, mimeType: page.mimeType })),
      });
    } catch (error) {
      if (error instanceof Error) console.error("Resumen PDF render failed:", error.message);
      if (error instanceof Error && error.message.includes("FST_REQ_FILE_TOO_LARGE")) {
        return reply.code(400).send({ code: "BAD_REQUEST", message: "El archivo PDF supera el límite de 15 MB" });
      }
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
    }
  });

  app.post("/api/v1/resumenes/pdf/analizar", async (request, reply) => {
    try {
      let cuentaId = "";
      let pdfBuffer: Buffer | undefined;
      let mimeType = "";
      for await (const part of request.parts()) {
        if (part.type === "field" && part.fieldname === "cuentaId") cuentaId = String(part.value);
        if (part.type === "file" && part.fieldname === "file") {
          mimeType = part.mimetype;
          pdfBuffer = await part.toBuffer();
        }
      }
      if (!pdfBuffer) return reply.code(400).send({ code: "BAD_REQUEST", message: "Se requiere un archivo PDF" });
      if (mimeType !== "application/pdf") return reply.code(400).send({ code: "BAD_REQUEST", message: "El archivo debe ser un PDF" });
      if (!cuentaId) return reply.code(400).send({ code: "BAD_REQUEST", message: "Se requiere cuentaId" });
      const rendered = await renderProtectedPdf(pdfBuffer);
      const extracted = await analizarResumenConGemini(rendered);
      const resumen = await crearResumenDesdeGemini(prisma, cuentaId, extracted);
      return reply.code(201).send({ resumen: toResumenDTO(resumen), requiereRevision: true });
    } catch (error) {
      if (error instanceof Error) console.error("Resumen PDF analysis failed:", error.message);
      if (error instanceof Error && error.message.includes("FST_REQ_FILE_TOO_LARGE")) {
        return reply.code(400).send({ code: "BAD_REQUEST", message: "El archivo PDF supera el límite de 15 MB" });
      }
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
    }
  });

  app.get("/api/v1/resumenes/:resumenId/cargos", async (request, reply) => {
    try {
      const params = z.object({ resumenId: z.string() }).parse(request.params);
      return reply.send((await listarCargosResumen(prisma, params.resumenId)).map(toCargoResumenDTO));
    } catch (error) {
      if (error instanceof ZodError) return fromZodError(reply, error);
      return internalError(reply);
    }
  });

  app.post("/api/v1/resumenes/:resumenId/reconciliar", async (request, reply) => {
    try {
      const params = z.object({ resumenId: z.string() }).parse(request.params);
      return reply.send(toResumenDTO(await reconciliarResumen(prisma, params.resumenId)));
    } catch (error) {
      if (error instanceof ZodError) return fromZodError(reply, error);
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
    }
  });

  app.get("/api/v1/resumenes", async (request, reply) => {
    try {
      const query = z.object({ cuentaId: z.string().optional() }).parse(request.query);
      return reply.send((await listarResumens(prisma, query.cuentaId)).map(toResumenDTO));
    } catch (error) {
      if (error instanceof ZodError) return fromZodError(reply, error);
      return internalError(reply);
    }
  });

  app.patch("/api/v1/cargos-resumen/:cargoId", async (request, reply) => {
    try {
      const params = z.object({ cargoId: z.string() }).parse(request.params);
      const cargo = await resolverCargoResumen(prisma, params.cargoId, request.body as never);
      return reply.send(toCargoResumenDTO(cargo));
    } catch (error) {
      if (error instanceof ZodError) return fromZodError(reply, error);
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
    }
  });

  app.post("/api/v1/resumenes/:resumenId/pagos", async (request, reply) => {
    try {
      const params = z.object({ resumenId: z.string() }).parse(request.params);
      const pago = await registrarPagoResumen(prisma, params.resumenId, request.body as never);
      return reply.code(201).send(pago);
    } catch (error) {
      if (error instanceof ZodError) return fromZodError(reply, error);
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
    }
  });

  app.get("/api/v1/resumenes/:resumenId/pagos", async (request, reply) => {
    try {
      const params = z.object({ resumenId: z.string() }).parse(request.params);
      const pagos = await prisma.pagoResumen.findMany({
        where: { resumenId: params.resumenId },
        include: { cuentaOrigen: { select: { nombre: true } } },
        orderBy: [{ fecha: "desc" }, { id: "desc" }],
      });
      return reply.send(pagos.map(toPagoResumenDTO));
    } catch (error) {
      if (error instanceof ZodError) return fromZodError(reply, error);
      return internalError(reply);
    }
  });

  app.post("/api/v1/ingresos", async (request, reply) => {
    try {
      const input = request.body as { confirmarDebitosAutomaticos?: boolean; cuentaId?: string; fechaCobro?: string; idempotencyKey?: string };
      const ingreso = await crearIngreso(prisma, request.body as never);
      if (input.confirmarDebitosAutomaticos && input.cuentaId && input.fechaCobro && input.idempotencyKey) {
        await registrarDebitosAutomaticos(prisma, input.cuentaId, input.fechaCobro, input.idempotencyKey);
      }
      const [cuenta, categoria] = await Promise.all([
        toCuentaResumen(ingreso.cuentaId),
        prisma.categoria.findUnique({ where: { id: ingreso.categoriaId } }),
      ]);
      const subcategoria = ingreso.subcategoriaId
        ? await prisma.subcategoria.findUnique({ where: { id: ingreso.subcategoriaId } })
        : null;
      return reply.code(201).send(toIngresoDTO({ ...ingreso, categoria: categoria!, subcategoria }, cuenta));
    } catch (error) {
      if (error instanceof ZodError) return fromZodError(reply, error);
      if (error instanceof Error && error.message.includes("Unique constraint")) return fromDomainError(reply, new Error("La operación ya fue registrada"));
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
    }
  });

  const CuentaSchema = z.object({
    nombre: z.string().min(1),
    tipo: z.enum(["EFECTIVO", "BILLETERA_VIRTUAL", "CUENTA_BANCARIA", "TARJETA_CREDITO"]),
    saldoInicial: z.string().or(z.number()).optional(),
    banco: z.string().optional(),
    nombreEntidad: z.string().min(1).optional(),
    ultimosDigitos: z.string().max(4).optional(),
    colorIdentificador: z.string().optional(),
    diaCierre: z.number().int().min(1).max(31).optional(),
    diaPago: z.number().int().min(1).max(31).optional(),
    cuentaDebitoMinimoId: z.string().nullable().optional(),
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
          nombreEntidad: data.nombreEntidad ? normalizeEntity(data.nombreEntidad) : undefined,
          ultimosDigitos: data.ultimosDigitos,
          colorIdentificador: data.colorIdentificador,
          diaCierre: data.diaCierre,
          diaPago: data.diaPago,
          cuentaDebitoMinimoId: data.cuentaDebitoMinimoId,
        },
      });
      return reply.code(201).send(await toCuentaResponse(cuenta));
    } catch (error) {
      if (error instanceof ZodError) return fromZodError(reply, error);
      if (error instanceof Error && error.message.includes("Unique constraint")) return fromDomainError(reply, new Error("Entidad OCR ya asociada a otra cuenta"));
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
    }
  });

  const ActualizarCuentaSchema = CuentaSchema.partial().refine((data) => Object.keys(data).length > 0, {
    message: "Debe indicar al menos un campo para actualizar",
  });

  app.patch("/api/v1/cuentas/:id", async (request, reply) => {
    try {
      const params = z.object({ id: z.string() }).parse(request.params);
      const data = ActualizarCuentaSchema.parse(request.body);
      const cuenta = await prisma.cuenta.findUnique({ where: { id: params.id } });
      if (!cuenta) throw new Error("Cuenta no encontrada");
      const updated = await prisma.cuenta.update({
        where: { id: params.id },
        data: {
          nombre: data.nombre,
          nombreEntidad: data.nombreEntidad ? normalizeEntity(data.nombreEntidad) : undefined,
          banco: data.banco,
          ultimosDigitos: data.ultimosDigitos,
          colorIdentificador: data.colorIdentificador,
          diaCierre: data.diaCierre,
          diaPago: data.diaPago,
          cuentaDebitoMinimoId: data.cuentaDebitoMinimoId,
        },
      });
      return reply.send(await toCuentaResponse(updated));
    } catch (error) {
      if (error instanceof ZodError) return fromZodError(reply, error);
      if (error instanceof Error && error.message.includes("Unique constraint")) return fromDomainError(reply, new Error("Entidad OCR ya asociada a otra cuenta"));
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
    periodo: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
    categoriaId: z.string().optional(),
    estado: z.nativeEnum(EstadoTransaccion).optional(),
    tipo: z.enum(["GASTO", "INGRESO"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  });

  app.get("/api/v1/transacciones", async (request, reply) => {
    try {
      const query = TransaccionesQuerySchema.parse(request.query);
      const { cuentaId, periodo, categoriaId, estado, tipo, page, limit } = query;

      const where: any = {};
      if (cuentaId) where.cuentaId = cuentaId;
      if (categoriaId) where.categoriaId = categoriaId;
      if (estado) where.estado = estado;
      if (tipo === "GASTO") where.monto = { lt: 0 };
      if (tipo === "INGRESO") where.monto = { gt: 0 };
      if (periodo) {
        const start = new Date(`${periodo}-01T00:00:00.000Z`);
        const end = new Date(start);
        end.setUTCMonth(end.getUTCMonth() + 1);
        where.fecha = { gte: start, lt: end };
      }

      const ingresoWhere: any = {
        ...(cuentaId ? { cuentaId } : {}),
        ...(periodo ? { periodoDisponible: periodo } : {}),
        ...(categoriaId ? { categoriaId } : {}),
      };
      const includeIngresos = !estado && tipo !== "GASTO";
      const includeTransacciones = tipo !== "INGRESO";
      const [transacciones, ingresos] = await Promise.all([
        includeTransacciones ? prisma.transaccion.findMany({ where }) : [],
        includeIngresos ? prisma.ingreso.findMany({ where: ingresoWhere, include: { categoria: true, subcategoria: true } }) : [],
      ]);

      const transactionItems = await Promise.all(transacciones.map(toTransaccionResponse));
      const incomeItems = await Promise.all(ingresos.map(async (income) => ({
        id: income.id,
        monto: Number(income.monto),
        moneda: "ARS",
        origen: "MANUAL" as const,
        categoria: {
          id: income.categoria.id,
          nombre: income.categoria.nombre,
          icono: income.categoria.icono,
          color: income.categoria.color,
          tipo: income.categoria.tipo,
          activa: income.categoria.activa,
        },
        subcategoria: income.subcategoria ?? undefined,
        fecha: income.fechaCobro.toISOString(),
        estado: "CONFIRMADA" as const,
        esTransferenciaAPersona: false,
        cuenta: await toCuentaResumen(income.cuentaId),
      })));
      const allItems = [...transactionItems, ...incomeItems].sort((a, b) => b.fecha.localeCompare(a.fecha));
      const total = allItems.length;
      const items = allItems.slice((page - 1) * limit, page * limit);
      return reply.send(toPaginatedDTO(items, page, limit, total));
    } catch (error) {
      if (error instanceof ZodError) return fromZodError(reply, error);
      if (error instanceof Error && error.message.includes("Unique constraint")) return fromDomainError(reply, new Error("Entidad OCR ya asociada a otra cuenta"));
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
    }
  });

  app.get("/api/v1/pendientes", async (_request, reply) => {
    try {
      const pendientes = await prisma.transaccion.findMany({
        where: {
          origen: OrigenTransaccion.OCR_IA,
          estado: { in: [EstadoTransaccion.PENDIENTE_REVISION, EstadoTransaccion.PENDIENTE_CATEGORIA] },
        },
        orderBy: { createdAt: "desc" },
      });
      return reply.send(await Promise.all(pendientes.map(toTransaccionResponse)));
    } catch (error) {
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
    }
  });

  const ResumenMensualQuerySchema = z.object({
    periodo: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  });

  app.get("/api/v1/resumen-mensual", async (request, reply) => {
    try {
      const { periodo } = ResumenMensualQuerySchema.parse(request.query);
      const resumen = await calcularResumenMensual(prisma, periodo);
      return reply.send(toResumenMensualDTO(resumen));
    } catch (error) {
      if (error instanceof ZodError) return fromZodError(reply, error);
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
    }
  });

  const GastoSchema = z.object({
    monto: z.string().or(z.number()),
    cuentaId: z.string(),
    categoriaId: z.string(),
    subcategoriaId: z.string().optional(),
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
    cuentaId: z.string().optional(),
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
    categoriaId: z.string().optional(),
    comercio: z.string().optional(),
    fecha: z.string().optional(),
    cuentaId: z.string().optional(),
    subcategoriaId: z.string().optional(),
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

  const CompraSchema = z.object({
    montoTotal: z.string().or(z.number()),
    comercio: z.string(),
    fechaCompra: z.string(),
    cantidadCuotas: z.number().int().min(1).max(120).optional(),
    cuentaId: z.string(),
  });

  const CompraQuerySchema = z.object({
    cuentaId: z.string().optional(),
    periodo: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  });

  app.post("/api/v1/compras", async (request, reply) => {
    try {
      const data = CompraSchema.parse(request.body);
      const resultado = await crearCompra(prisma, { ...data, cantidadCuotas: data.cantidadCuotas ?? 1 });
      return reply.code(201).send(toCompraDTO(resultado));
    } catch (error) {
      if (error instanceof ZodError) return fromZodError(reply, error);
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
    }
  });

  app.get("/api/v1/compras", async (request, reply) => {
    try {
      const query = CompraQuerySchema.parse(request.query);
      const compras = await listarCompras(prisma, query);
      return reply.send(compras.map(toCompraDTO));
    } catch (error) {
      if (error instanceof ZodError) return fromZodError(reply, error);
      return internalError(reply);
    }
  });

  app.get("/api/v1/cuotas", async (request, reply) => {
    try {
      const query = CompraQuerySchema.parse(request.query);
      const cuotas = await listarCuotas(prisma, query);
      return reply.send(cuotas.map(toCuotaDTO));
    } catch (error) {
      if (error instanceof ZodError) return fromZodError(reply, error);
      return internalError(reply);
    }
  });

  app.delete("/api/v1/compras/:compraId", async (request, reply) => {
    try {
      const params = z.object({ compraId: z.string() }).parse(request.params);
      await eliminarCompra(prisma, params.compraId);
      return reply.code(204).send();
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
    categoriaId: z.string(),
    comercio: z.string().optional(),
    fecha: z.string().optional(),
    subcategoriaId: z.string().optional(),
    cuentaId: z.string().optional(),
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

  const CategoriaSchema = z.object({
    nombre: z.string().min(1).max(30),
    icono: z.enum(["UTENSILIOS_COCINA", "CARRO", "CASA", "LLAVE", "TELEFONO", "CORAZON", "OCULOS", "SUPER", "GIMNASIO", "LIBROS", "AVION", "OTRO"]),
    color: z.enum(["ROJO", "NARANJA", "AMARILLO", "VERDE", "AZUL", "INDIGO", "VIOLETA", "ROSA", "PEZ", "TURQUESA", "BLANCO", "NEGRO"]),
    tipo: z.enum(["GASTO", "INGRESO"]),
    activa: z.boolean().optional(),
  });

  const CategoriaUpdateSchema = CategoriaSchema.partial();

  app.get("/api/v1/categorias", async (request, reply) => {
    try {
      const query = z.object({
        tipo: z.enum(["GASTO", "INGRESO"]).optional(),
        activa: z.coerce.boolean().optional(),
      }).parse(request.query);

      const where: any = {};
      if (query.tipo) where.tipo = query.tipo;
      if (query.activa !== undefined) where.activa = query.activa;

      const categorias = await prisma.categoria.findMany({ where, orderBy: { nombre: "asc" }, include: { _count: { select: { transacciones: true, ingresos: true, compras: true, recurrentes: true } } } });
      return reply.send(categorias.map((categoria) => toCategoriaDTO(categoria, categoria._count.transacciones + categoria._count.ingresos + categoria._count.compras + categoria._count.recurrentes)));
    } catch (error) {
      if (error instanceof ZodError) return fromZodError(reply, error);
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
    }
  });

  app.post("/api/v1/categorias", async (request, reply) => {
    try {
      const data = CategoriaSchema.parse(request.body);
      const categoria = await prisma.categoria.create({
        data: {
          nombre: data.nombre,
          icono: data.icono as any,
          color: data.color as any,
          tipo: data.tipo as any,
          activa: data.activa ?? true,
        },
      });
      return reply.code(201).send(toCategoriaDTO(categoria));
    } catch (error) {
      if (error instanceof ZodError) return fromZodError(reply, error);
      if (error instanceof Error && error.message.includes("Unique constraint")) return fromDomainError(reply, new Error("Categoría ya existe"));
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
    }
  });

  app.patch("/api/v1/categorias/:id", async (request, reply) => {
    try {
      const params = z.object({ id: z.string() }).parse(request.params);
      const data = CategoriaUpdateSchema.parse(request.body);
      if (Object.keys(data).length === 0) {
        throw new Error("Debe indicar al menos un campo para actualizar");
      }

       const categoria = await prisma.categoria.findUnique({ where: { id: params.id } });
       if (!categoria) throw new Error("Categoría no encontrada");

      const updated = await prisma.categoria.update({
        where: { id: params.id },
        data: {
          nombre: data.nombre,
          icono: data.icono as any,
          color: data.color as any,
          tipo: data.tipo as any,
          activa: data.activa,
        },
      });
      return reply.send(toCategoriaDTO(updated));
    } catch (error) {
      if (error instanceof ZodError) return fromZodError(reply, error);
      if (error instanceof Error && error.message.includes("Unique constraint")) return fromDomainError(reply, new Error("Categoría ya existe"));
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
    }
  });

  app.get("/api/v1/subcategorias", async (request, reply) => {
    try {
      const query = z.object({
        categoriaId: z.string().optional(),
        activa: z.coerce.boolean().optional(),
      }).parse(request.query);

      const where: any = {};
      if (query.categoriaId) where.categoriaId = query.categoriaId;

      if (query.activa !== undefined) where.activa = query.activa;
      const subcategorias = await prisma.subcategoria.findMany({
        where,
        include: { categoria: true, _count: { select: { transacciones: true, ingresos: true, recurrentes: true } } },
        orderBy: { nombre: "asc" },
      });
      return reply.send(subcategorias.map((subcategoria) => toSubcategoriaDTO(subcategoria, subcategoria._count.transacciones + subcategoria._count.ingresos + subcategoria._count.recurrentes)));
    } catch (error) {
      if (error instanceof ZodError) return fromZodError(reply, error);
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
    }
  });

  const SubcategoriaSchema = z.object({
    nombre: z.string().min(1).max(30),
    categoriaId: z.string(),
    activa: z.boolean().optional(),
  });

  const SubcategoriaUpdateSchema = z.object({
    nombre: z.string().min(1).max(30).optional(),
    categoriaId: z.string().optional(),
    activa: z.boolean().optional(),
  });

  app.post("/api/v1/subcategorias", async (request, reply) => {
    try {
      const data = SubcategoriaSchema.parse(request.body);
      const categoria = await prisma.categoria.findUnique({ where: { id: data.categoriaId } });
       if (!categoria || !categoria.activa) throw new Error("La categoría no existe o está archivada");

      const subcategoria = await prisma.subcategoria.create({
        data: {
          nombre: data.nombre,
          categoriaId: data.categoriaId,
          activa: data.activa ?? true,
        },
        include: { categoria: true },
      });
      return reply.code(201).send(toSubcategoriaDTO(subcategoria));
    } catch (error) {
      if (error instanceof ZodError) return fromZodError(reply, error);
      if (error instanceof Error && error.message.includes("Unique constraint")) return fromDomainError(reply, new Error("Subcategoría ya existe"));
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
    }
  });

  app.patch("/api/v1/subcategorias/:id", async (request, reply) => {
    try {
      const params = z.object({ id: z.string() }).parse(request.params);
      const data = SubcategoriaUpdateSchema.parse(request.body);
      if (Object.keys(data).length === 0) {
        throw new Error("Debe indicar al menos un campo para actualizar");
      }

      const subcategoria = await prisma.subcategoria.findUnique({
        where: { id: params.id },
        include: { categoria: true },
      });
      if (!subcategoria) throw new Error("Subcategoría no encontrada");
      if (data.categoriaId && data.categoriaId !== subcategoria.categoriaId) throw new Error("No se puede mover una subcategoría existente; archivala y creá una nueva");

      const updated = await prisma.subcategoria.update({
        where: { id: params.id },
        data: {
          nombre: data.nombre,
          categoriaId: data.categoriaId,
          activa: data.activa,
        },
        include: { categoria: true },
      });
      return reply.send(toSubcategoriaDTO(updated));
    } catch (error) {
      if (error instanceof ZodError) return fromZodError(reply, error);
      if (error instanceof Error && error.message.includes("Unique constraint")) return fromDomainError(reply, new Error("Subcategoría ya existe"));
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
    }
  });

  app.delete("/api/v1/subcategorias/:id", async (request, reply) => {
    try {
      const params = z.object({ id: z.string() }).parse(request.params);
      const subcategoria = await prisma.subcategoria.findUnique({ where: { id: params.id } });
      if (!subcategoria) throw new Error("Subcategoría no encontrada");

      const transaccionesCount = await prisma.transaccion.count({ where: { subcategoriaId: params.id } });
      if (transaccionesCount > 0) {
        throw new Error("No se puede archivar una subcategoría con transacciones asociadas");
      }

      await prisma.subcategoria.delete({ where: { id: params.id } });
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof ZodError) return fromZodError(reply, error);
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
    }
  });

  const RecurrenteSchema = z.object({
    nombre: z.string().min(1).max(80),
    tipoMonto: z.enum(["FIJO", "VARIABLE"]).default("FIJO"),
    montoFijo: z.string().or(z.number()).optional(),
    cuentaId: z.string(),
    categoriaId: z.string(),
    subcategoriaId: z.string().optional(),
    diaDelMes: z.number().int().min(1).max(31),
    notas: z.string().max(60).optional(),
    activo: z.boolean().optional(),
  });

  app.post("/api/v1/recurrentes", async (request, reply) => {
    try {
      return reply.code(201).send(await crearRecurrente(prisma, RecurrenteSchema.parse(request.body)));
    } catch (error) {
      if (error instanceof ZodError) return fromZodError(reply, error);
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
    }
  });

  app.get("/api/v1/recurrentes", async (request, reply) => {
    const { incluirInactivos } = z.object({ incluirInactivos: z.coerce.boolean().default(false) }).parse(request.query);
    return reply.send(await listarRecurrentes(prisma, incluirInactivos ? undefined : true));
  });

  app.patch("/api/v1/recurrentes/:id", async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      return reply.send(await actualizarRecurrente(prisma, id, RecurrenteSchema.partial().parse(request.body)));
    } catch (error) {
      if (error instanceof ZodError) return fromZodError(reply, error);
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
    }
  });

  app.get("/api/v1/recurrentes/instancias", async (request, reply) => {
    const query = z.object({ periodo: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(), estado: z.enum(["PROYECTADO", "CONFIRMADO", "OMITIDO"]).optional() }).parse(request.query);
    return reply.send(await listarInstanciasRecurrentes(prisma, query));
  });

  app.post("/api/v1/recurrentes/proyectar", async (request, reply) => {
    try {
      const { periodo } = z.object({ periodo: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }).parse(request.body);
      return reply.send(await proyectarInstanciasDelPeriodo(prisma, periodo));
    } catch (error) {
      if (error instanceof ZodError) return fromZodError(reply, error);
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
    }
  });

  app.get("/api/v1/recurrentes/proximas", async (request, reply) => {
    try {
      const { dias } = z.object({ dias: z.coerce.number().int().min(0).max(31).default(4) }).parse(request.query);
      return reply.send(await listarInstanciasProximas(prisma, dias));
    } catch (error) {
      if (error instanceof ZodError) return fromZodError(reply, error);
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
    }
  });

  app.post("/api/v1/recurrentes/:id/instancia", async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      return reply.code(201).send(await generarInstanciaRecurrente(prisma, id));
    } catch (error) {
      if (error instanceof ZodError) return fromZodError(reply, error);
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
    }
  });

  app.post("/api/v1/recurrentes/instancias/:id/confirmar", async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = z.object({ cuentaRealId: z.string().optional(), monto: z.string().or(z.number()).optional(), fecha: z.string().optional() }).parse(request.body ?? {});
      return reply.send(await confirmarInstanciaRecurrente(prisma, id, body));
    } catch (error) {
      if (error instanceof ZodError) return fromZodError(reply, error);
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
    }
  });

  app.post("/api/v1/recurrentes/instancias/:id/omitir", async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      return reply.send(await omitirInstanciaRecurrente(prisma, id));
    } catch (error) {
      if (error instanceof ZodError) return fromZodError(reply, error);
      if (error instanceof Error) return fromDomainError(reply, error);
      return internalError(reply);
    }
  });

  return app;
}
