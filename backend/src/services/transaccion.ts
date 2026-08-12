import {
  Prisma,
  PrismaClient,
  Transaccion,
  Resumen,
  OrigenTransaccion,
  EstadoTransaccion,
  TipoCategoria,
  TipoCuenta,
} from "@prisma/client";
import { z } from "zod";
import { interpretarConGemini } from "./geminiOCR";
import { invalidarAnalisisInsight } from "./analisisInsight";

const TransaccionSchema = z.object({
  monto: z.string().or(z.number()),
  cuentaId: z.string().optional(),
  categoriaId: z.string(),
  subcategoriaId: z.string().optional(),
  origen: z.nativeEnum(OrigenTransaccion),
  idempotencyKey: z.string(),
  fecha: z.string().optional(),
  comercio: z.string().optional(),
  nota: z.string().max(120).optional(),
  cuotaId: z.string().optional(),
  estado: z.nativeEnum(EstadoTransaccion).optional(),
  textoCrudoOCR: z.string().optional(),
  esTransferenciaAPersona: z.boolean().optional(),
});

export type CrearTransaccionInput = z.infer<typeof TransaccionSchema>;

function normalizeEntity(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

async function resolveCategoriaIdByName(prisma: PrismaClient, nombre: string): Promise<string | undefined> {
  const categoria = await prisma.categoria.findFirst({
    where: { nombre: { equals: nombre, mode: "insensitive" } },
  });
  return categoria?.id;
}

function categoriaNombreToId(nombre: string | undefined): string | undefined {
  if (!nombre) return undefined;
  const upper = nombre.toUpperCase();
  const map: Record<string, string> = {
    COMIDA: "cat-comida",
    TRANSPORTE: "cat-transporte",
    VIVIENDA: "cat-vivienda",
    SERVICIOS: "cat-servicios",
    OCIO: "cat-ocio",
    DEUDAS: "cat-deudas",
    OTROS: "cat-otros",
  };
  return map[upper];
}

async function resolverCuentaOCR(prisma: PrismaClient, textoCrudo: string): Promise<string | undefined> {
  const texto = normalizeEntity(textoCrudo);
  const cuentas = await prisma.cuenta.findMany({
    where: { OR: [{ nombreEntidad: { not: null } }, { ultimosDigitos: { not: null } }] },
    select: { id: true, nombreEntidad: true, ultimosDigitos: true },
  });
  const entityMatches = cuentas.filter((account) => account.nombreEntidad && texto.includes(normalizeEntity(account.nombreEntidad)));
  if (entityMatches.length === 1) return entityMatches[0].id;
  if (entityMatches.length > 1) return undefined;

  const digits = textoCrudo.match(/(?:terminad[oa]s?\s+en|[*xX#-])\s*(\d{4})/i)?.[1];
  if (!digits) return undefined;
  const digitMatches = cuentas.filter((account) => account.ultimosDigitos === digits);
  return digitMatches.length === 1 ? digitMatches[0].id : undefined;
}

async function resolverCuentaWallet(prisma: PrismaClient, tarjeta: string): Promise<string | undefined> {
  const digits = tarjeta.match(/(\d{4})\s*$/)?.[1];
  if (!digits) return undefined;
  const matches = await prisma.cuenta.findMany({ where: { ultimosDigitos: digits }, select: { id: true } });
  return matches.length === 1 ? matches[0].id : undefined;
}

const GastoOCRSchema = z.object({
  textoCrudo: z.string(),
  cuentaId: z.string().optional(),
  idempotencyKey: z.string(),
  data: z
    .object({
      monto: z.string().or(z.number()).optional(),
      categoria: z.string().optional(),
      comercio: z.string().optional(),
      fecha: z.string().optional(),
      esTransferenciaAPersona: z.boolean().optional(),
    })
    .optional(),
});

export type CrearTransaccionOCRInput = z.infer<typeof GastoOCRSchema>;

const WalletInputSchema = z.object({
  monto: z.string().or(z.number()),
  comercio: z.string().min(1),
  tarjeta: z.string().min(4),
  fecha: z.string().optional(),
  idempotencyKey: z.string().min(1),
});

export type CrearTransaccionWalletInput = z.infer<typeof WalletInputSchema>;

type OCRFallbackData = z.infer<typeof GastoOCRSchema>["data"];

function normalizeAmount(
  value: string | number | undefined,
): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "number") return value.toFixed(2);

  const cleaned = value.trim().replace(/[^\d,.-]/g, "");
  if (!cleaned || !/^-?[\d.,]+$/.test(cleaned)) return undefined;

  const sign = cleaned.startsWith("-") ? "-" : "";
  const unsigned = cleaned.replace(/^-/, "");
  const lastComma = unsigned.lastIndexOf(",");
  const lastDot = unsigned.lastIndexOf(".");
  const decimalSeparator =
    lastComma === -1
      ? lastDot
      : lastDot === -1
        ? lastComma
        : Math.max(lastComma, lastDot);
  const decimalDigits =
    decimalSeparator === -1 ? 0 : unsigned.length - decimalSeparator - 1;
  const hasDecimalPart = decimalSeparator !== -1 && decimalDigits <= 2;
  const integerPart = hasDecimalPart
    ? unsigned.slice(0, decimalSeparator)
    : unsigned;
  const fractionPart = hasDecimalPart
    ? unsigned.slice(decimalSeparator + 1)
    : "";
  const normalized = `${sign}${integerPart.replace(/[.,]/g, "")}.${fractionPart}`;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : undefined;
}

export function normalizarMontoGasto(value: string | number): string {
  const normalized = normalizeAmount(value);
  if (normalized == null || Number(normalized) === 0) {
    throw new Error("Monto inválido");
  }

  return (-Math.abs(Number(normalized))).toFixed(2);
}

async function assertSufficientFunds(
  tx: Prisma.TransactionClient,
  cuentaId: string,
  gasto: string,
  fecha: Date,
) {
  const cuenta = await tx.cuenta.findUnique({ where: { id: cuentaId }, select: { tipo: true, saldoInicial: true } });
  if (!cuenta) throw new Error("Cuenta no encontrada");
  if (cuenta.tipo === TipoCuenta.TARJETA_CREDITO) return;
  const [transacciones, ingresos, salientes, entrantes] = await Promise.all([
    tx.transaccion.findMany({ where: { cuentaId, estado: EstadoTransaccion.CONFIRMADA, fecha: { lte: fecha } }, select: { monto: true } }),
    tx.ingreso.findMany({ where: { cuentaId, fechaCobro: { lte: fecha } }, select: { monto: true } }),
    tx.transferenciaInterna.findMany({ where: { cuentaOrigenId: cuentaId, fecha: { lte: fecha } }, select: { monto: true } }),
    tx.transferenciaInterna.findMany({ where: { cuentaDestinoId: cuentaId, fecha: { lte: fecha } }, select: { monto: true } }),
  ]);
  const saldo = Number(cuenta.saldoInicial)
    + transacciones.reduce((sum, item) => sum + Number(item.monto), 0)
    + ingresos.reduce((sum, item) => sum + Number(item.monto), 0)
    - salientes.reduce((sum, item) => sum + Number(item.monto), 0)
    + entrantes.reduce((sum, item) => sum + Number(item.monto), 0);
  if (saldo + Number(gasto) < 0) throw new Error("Saldo insuficiente para registrar el gasto");
}

function extractCurrencyAmount(text: string): string | undefined {
  const candidates = [
    /(?:monto|amount)[:=]\s*(-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/i,
    /(?:ARS|AR\$|USD|US\$|\$)\s*(-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/i,
    /(-?\d+(?:[.,]\d{2}))(?:\s*(?:pesos|dolares|usd|ars))/i,
    /(?:pesos|dolares|usd|ars)\s*(-?\d+(?:[.,]\d{1,2})?)/i,
    /(?:^|\s)(-?\d{1,3}(?:[.,]\d{1,2})?)(?=\s*(?:$|,|;|tarjeta|en|supermercado|compra|monto|total))/i,
  ];

  for (const pattern of candidates) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return normalizeAmount(match[1]);
    }
  }

  return undefined;
}

function inferCategoria(text: string): string | undefined {
  const mappings: Array<{ re: RegExp; category: string }> = [
    {
      re: /\b(almuerzo|restaurante|comida|pizzeria|cafe|bar|caf[eé])\b/i,
      category: "COMIDA",
    },
    {
      re: /\b(uber|taxi|boleto|transporte|tren|colectivo|bus|metro|subte|viaje)\b/i,
      category: "TRANSPORTE",
    },
    {
      re: /\b(alquiler|hipoteca|departamento|casa|vivienda|renta)\b/i,
      category: "VIVIENDA",
    },
    {
      re: /\b(luz|agua|gas|internet|celular|telefon[oó]|servicios?)\b/i,
      category: "SERVICIOS",
    },
    {
      re: /\b(cine|teatro|hotel|ocio|entretenimiento|musica|spotify|netflix)\b/i,
      category: "OCIO",
    },
    {
      re: /\b(pago|cuota|prestamo|deuda|tarjeta|saldo)\b/i,
      category: "DEUDAS",
    },
  ];

  for (const mapping of mappings) {
    if (mapping.re.test(text)) return mapping.category;
  }
  return undefined;
}

function parseDateValue(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const match = text.match(/\b(\d{1,2})[\/](\d{1,2})[\/](\d{2}|\d{4})\b/i);
  if (match) {
    const [, day, month, year] = match;
    const fullYear = year.length === 2 ? `20${year}` : year;
    const parsed = new Date(`${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  const candidate = new Date(text);
  if (!Number.isNaN(candidate.getTime())) return candidate.toISOString();

  return undefined;
}

function interpretarOCR(textoCrudo: string, fallback?: OCRFallbackData) {
  const texto = textoCrudo.trim();
  let monto = fallback?.monto ? normalizeAmount(fallback.monto) : undefined;
  let categoria: string | undefined = undefined;
  let comercio = fallback?.comercio;
  let fecha = fallback?.fecha ? parseDateValue(fallback.fecha) : undefined;

  if (fallback?.categoria) {
    categoria = fallback.categoria.toUpperCase();
  }

  try {
    const candidate = JSON.parse(texto);
    if (typeof candidate === "object" && candidate !== null) {
      if (!monto && candidate.monto != null)
        monto = normalizeAmount(candidate.monto);
      if (!categoria && typeof candidate.categoria === "string") {
        categoria = candidate.categoria.toUpperCase();
      }
      if (!comercio && typeof candidate.comercio === "string")
        comercio = candidate.comercio;
      if (!fecha && typeof candidate.fecha === "string")
        fecha = parseDateValue(candidate.fecha);
    }
  } catch {
    // ignore JSON parse failures
  }

  if (!monto) {
    monto = extractCurrencyAmount(texto);
  }

  if (!categoria) {
    categoria = inferCategoria(texto);
  }

  if (!comercio) {
    const comercioMatch = texto.match(
      /\b(?:en|por|a)\s+([A-Za-zÁÉÍÓÚáéíóú0-9\s-]{3,40})/i,
    );
    if (comercioMatch) comercio = comercioMatch[1].trim();
  }

  if (!fecha) {
    const dateMatch = texto.match(/(\d{4}-\d{2}-\d{2}|\d{1,2}[\/]\d{1,2}[\/]\d{2,4})/);
    if (dateMatch) fecha = parseDateValue(dateMatch[1]);
  }

  const exito = Boolean(monto && categoria);
  return { monto, categoria, comercio, fecha, esTransferenciaAPersona: false, exito };
}

export async function crearTransaccion(
  prisma: PrismaClient,
  input: CrearTransaccionInput,
): Promise<Transaccion> {
  const data = TransaccionSchema.parse(input);

  const existing = await prisma.transaccion.findUnique({
    where: { idempotencyKey: data.idempotencyKey },
  });
  if (existing) return existing as Transaccion;

  const estado = data.estado ?? EstadoTransaccion.CONFIRMADA;
  if (estado === EstadoTransaccion.CONFIRMADA && !data.cuentaId) {
    throw new Error("No se puede confirmar una transaccion sin cuenta");
  }
  const categoria = await prisma.categoria.findUnique({ where: { id: data.categoriaId } });
  if (!categoria) throw new Error("Categoría no encontrada");

  const monto =
    estado === EstadoTransaccion.CONFIRMADA
      ? normalizarMontoGasto(data.monto)
      : Number(data.monto) === 0
        ? "0.00"
        : normalizarMontoGasto(data.monto);

  const result = await prisma.$transaction(async (tx) => {
    const fecha = data.fecha ? new Date(data.fecha) : new Date();
    if (estado === EstadoTransaccion.CONFIRMADA && data.cuentaId) await assertSufficientFunds(tx, data.cuentaId, monto, fecha);
    const created = await tx.transaccion.create({
      data: {
        monto,
        moneda: "ARS",
        origen: data.origen,
        cuentaId: data.cuentaId,
        categoriaId: data.categoriaId,
        subcategoriaId: data.subcategoriaId,
        idempotencyKey: data.idempotencyKey,
        comercio: data.comercio,
        nota: data.nota,
        fecha,
        estado,
        textoCrudoOCR: data.textoCrudoOCR,
        esTransferenciaAPersona: data.esTransferenciaAPersona ?? false,
      },
    });

    if (
      created.estado === EstadoTransaccion.CONFIRMADA &&
      data.cuotaId
    ) {
      await tx.cuota.update({
        where: { id: data.cuotaId },
        data: { transaccionId: created.id, estado: "CONFIRMADO" },
      });
    }

    return created as Transaccion;
  });

  if (result.estado === EstadoTransaccion.CONFIRMADA) {
    await invalidarAnalisisInsight(prisma, result.fecha.toISOString().slice(0, 7));
  }
  return result;
}

const CorregirOCRSchema = z.object({
  monto: z.string().or(z.number()).optional(),
  categoriaId: z.string().optional(),
  comercio: z.string().optional(),
  fecha: z.string().optional(),
  cuentaId: z.string().optional(),
  subcategoriaId: z.string().optional(),
});

export type CorregirTransaccionOCRInput = z.infer<typeof CorregirOCRSchema>;

const TransferenciaInternaSchema = z.object({
  cuentaOrigenId: z.string(),
  cuentaDestinoId: z.string(),
  monto: z.string().or(z.number()),
  nota: z.string().max(60).optional(),
  fecha: z.string().optional(),
  idempotencyKey: z.string(),
});

export type CrearTransferenciaInternaInput = z.infer<
  typeof TransferenciaInternaSchema
>;

export type TransferenciaInternaConCuentas =
  Prisma.TransferenciaInternaGetPayload<{
    include: { cuentaOrigen: true; cuentaDestino: true };
  }>;

export async function crearTransferenciaInterna(
  prisma: PrismaClient,
  input: CrearTransferenciaInternaInput,
): Promise<TransferenciaInternaConCuentas> {
  const data = TransferenciaInternaSchema.parse(input);
  const existing = await prisma.transferenciaInterna.findUnique({
    where: { idempotencyKey: data.idempotencyKey },
    include: { cuentaOrigen: true, cuentaDestino: true },
  });
  if (existing) return existing;

  const normalizedMonto = normalizeAmount(data.monto);
  if (normalizedMonto == null || Number(normalizedMonto) <= 0) {
    throw new Error("Monto inválido");
  }

  const parsedFecha = data.fecha ? parseDateValue(data.fecha) : undefined;
  if (data.fecha && !parsedFecha) {
    throw new Error("Fecha inválida");
  }

  if (data.cuentaOrigenId === data.cuentaDestinoId) {
    throw new Error("Cuenta origen y destino deben ser diferentes");
  }

  const result = await prisma.$transaction(async (tx) => {
    const origenCuenta = await tx.cuenta.findUnique({
      where: { id: data.cuentaOrigenId },
    });
    const destinoCuenta = await tx.cuenta.findUnique({
      where: { id: data.cuentaDestinoId },
    });

    if (!origenCuenta || !destinoCuenta) {
      throw new Error("Cuenta origen o destino no encontrada");
    }

    const [transacciones, salientes, entrantes, ingresos] = await Promise.all([
      tx.transaccion.findMany({
        where: { cuentaId: data.cuentaOrigenId, estado: EstadoTransaccion.CONFIRMADA, ...(parsedFecha ? { fecha: { lte: new Date(parsedFecha) } } : {}) },
        select: { monto: true },
      }),
      tx.transferenciaInterna.findMany({
        where: { cuentaOrigenId: data.cuentaOrigenId, ...(parsedFecha ? { fecha: { lte: new Date(parsedFecha) } } : {}) },
        select: { monto: true },
      }),
      tx.transferenciaInterna.findMany({
        where: { cuentaDestinoId: data.cuentaOrigenId, ...(parsedFecha ? { fecha: { lte: new Date(parsedFecha) } } : {}) },
        select: { monto: true },
      }),
      tx.ingreso.findMany({
        where: { cuentaId: data.cuentaOrigenId, ...(parsedFecha ? { fechaCobro: { lte: new Date(parsedFecha) } } : {}) },
        select: { monto: true },
      }),
    ]);
    const saldoDisponible = Number(origenCuenta.saldoInicial)
      + transacciones.reduce((sum, item) => sum + Number(item.monto), 0)
      - salientes.reduce((sum, item) => sum + Number(item.monto), 0)
      + entrantes.reduce((sum, item) => sum + Number(item.monto), 0)
      + ingresos.reduce((sum, item) => sum + Number(item.monto), 0);

    if (Number(normalizedMonto) > saldoDisponible) {
      throw new Error("Saldo insuficiente para la transferencia");
    }

    const transferencia = await tx.transferenciaInterna.create({
      data: {
        cuentaOrigenId: data.cuentaOrigenId,
        cuentaDestinoId: data.cuentaDestinoId,
        monto: normalizedMonto,
        idempotencyKey: data.idempotencyKey,
        nota: data.nota,
        fecha: parsedFecha ? new Date(parsedFecha) : undefined,
      },
      include: { cuentaOrigen: true, cuentaDestino: true },
    });

    return transferencia;
  });

  return result;
}

export async function corregirTransaccionOCR(
  prisma: PrismaClient,
  transaccionId: string,
  input: CorregirTransaccionOCRInput,
): Promise<Transaccion> {
  const data = CorregirOCRSchema.parse(input);
  const transaccion = await prisma.transaccion.findUnique({
    where: { id: transaccionId },
  });

  if (!transaccion) throw new Error("Transaccion no encontrada");
  if (
    transaccion.origen !== OrigenTransaccion.OCR_IA ||
    !(
      transaccion.estado === EstadoTransaccion.PENDIENTE_REVISION ||
      transaccion.estado === EstadoTransaccion.PENDIENTE_CATEGORIA
    )
  ) {
    throw new Error("Solo se pueden corregir transacciones OCR pendientes");
  }

  const normalizedMonto =
    data.monto !== undefined
      ? normalizarMontoGasto(data.monto)
      : Number(transaccion.monto) !== 0
        ? normalizarMontoGasto(transaccion.monto.toString())
        : "0.00";

  let fecha = transaccion.fecha;
  if (data.fecha) {
    const parsed = parseDateValue(data.fecha);
    if (!parsed) throw new Error("Fecha inválida");
    fecha = new Date(parsed);
  }

  const updatedCategoriaId = data.categoriaId ?? transaccion.categoriaId;
  const cuentaId = data.cuentaId ?? transaccion.cuentaId;
  const shouldConfirm = Number(normalizedMonto) !== 0 && Boolean(updatedCategoriaId);
  if (shouldConfirm && !cuentaId) throw new Error("No se puede confirmar una transaccion sin cuenta");

  const updated = await prisma.$transaction(async (tx) => {
    if (shouldConfirm && cuentaId) await assertSufficientFunds(tx, cuentaId, normalizedMonto, fecha);
    return tx.transaccion.update({
      where: { id: transaccion.id },
      data: {
        monto: normalizedMonto ?? transaccion.monto.toString(),
        categoriaId: updatedCategoriaId,
        subcategoriaId: data.subcategoriaId ?? transaccion.subcategoriaId,
        comercio: data.comercio ?? transaccion.comercio,
        fecha,
        estado: shouldConfirm
          ? EstadoTransaccion.CONFIRMADA
          : EstadoTransaccion.PENDIENTE_REVISION,
        cuentaId,
      },
    });
  });

  return updated;
}

const ResolverCategoriaSchema = z.object({
  categoriaId: z.string(),
  comercio: z.string().optional(),
  fecha: z.string().optional(),
  cuentaId: z.string().optional(),
  subcategoriaId: z.string().optional(),
});

const EditarGastoSchema = z.object({
  monto: z.string().or(z.number()).optional(),
  cuentaId: z.string().optional(),
  categoriaId: z.string().optional(),
  subcategoriaId: z.string().nullable().optional(),
  comercio: z.string().max(60).nullable().optional(),
  nota: z.string().max(120).nullable().optional(),
  fecha: z.string().optional(),
});

export type EditarGastoInput = z.infer<typeof EditarGastoSchema>;

const EDITABLE_EXPENSE_ORIGINS: Set<OrigenTransaccion> = new Set([OrigenTransaccion.MANUAL, OrigenTransaccion.OCR_IA]);

async function assertEditableExpense(prisma: PrismaClient, transaccionId: string) {
  const transaction = await prisma.transaccion.findUnique({
    where: { id: transaccionId },
    include: { cuota: true, cargoResumen: true, instanciaGastoRecurrente: true },
  });
  if (!transaction) throw new Error("Transaccion no encontrada");
  if (!EDITABLE_EXPENSE_ORIGINS.has(transaction.origen)) throw new Error("Este movimiento se gestiona desde su sección de origen");
  if (transaction.cuota || transaction.cargoResumen || transaction.instanciaGastoRecurrente) {
    throw new Error("Este movimiento se gestiona desde su sección de origen");
  }
  return transaction;
}

export async function editarGasto(prisma: PrismaClient, transaccionId: string, input: EditarGastoInput) {
  const data = EditarGastoSchema.parse(input);
  const transaction = await assertEditableExpense(prisma, transaccionId);
  const categoriaId = data.categoriaId ?? transaction.categoriaId;
  const categoria = await prisma.categoria.findUnique({ where: { id: categoriaId } });
  if (!categoria || categoria.tipo !== TipoCategoria.GASTO) throw new Error("La categoría debe ser de gasto");

  const subcategoriaId = data.subcategoriaId === undefined ? transaction.subcategoriaId : data.subcategoriaId;
  if (subcategoriaId) {
    const subcategoria = await prisma.subcategoria.findUnique({ where: { id: subcategoriaId } });
    if (!subcategoria || subcategoria.categoriaId !== categoriaId) throw new Error("La subcategoría no pertenece a la categoría seleccionada");
  }
  const cuentaId = data.cuentaId ?? transaction.cuentaId;
  if (!cuentaId) throw new Error("El gasto debe tener una cuenta");
  const cuenta = await prisma.cuenta.findUnique({ where: { id: cuentaId } });
  if (!cuenta) throw new Error("Cuenta no encontrada");
  const fecha = data.fecha ? parseDateValue(data.fecha) : undefined;
  if (data.fecha && !fecha) throw new Error("Fecha inválida");

  const updated = await prisma.transaccion.update({
    where: { id: transaccionId },
    data: {
      monto: data.monto === undefined ? transaction.monto : normalizarMontoGasto(data.monto),
      cuentaId,
      categoriaId,
      subcategoriaId,
      comercio: data.comercio === undefined ? transaction.comercio : data.comercio,
      nota: data.nota === undefined ? transaction.nota : data.nota,
      fecha: fecha ? new Date(fecha) : transaction.fecha,
    },
  });
  await invalidarAnalisisInsight(prisma, transaction.fecha.toISOString().slice(0, 7));
  if (fecha) await invalidarAnalisisInsight(prisma, new Date(fecha).toISOString().slice(0, 7));
  return updated;
}

export async function eliminarGasto(prisma: PrismaClient, transaccionId: string) {
  await assertEditableExpense(prisma, transaccionId);
  await prisma.transaccion.delete({ where: { id: transaccionId } });
}

export type ResolverCategoriaPendienteInput = z.infer<
  typeof ResolverCategoriaSchema
>;

export async function resolverCategoriaPendienteTransaccion(
  prisma: PrismaClient,
  transaccionId: string,
  input: ResolverCategoriaPendienteInput,
): Promise<Transaccion> {
  const data = ResolverCategoriaSchema.parse(input);
  const transaccion = await prisma.transaccion.findUnique({
    where: { id: transaccionId },
  });

  if (!transaccion) throw new Error("Transaccion no encontrada");
  if (transaccion.estado !== EstadoTransaccion.PENDIENTE_CATEGORIA) {
    throw new Error(
      "Solo se pueden resolver transacciones con categoria pendiente",
    );
  }

  if (Number(transaccion.monto) === 0) {
    throw new Error("Monto inválido");
  }

  const cuentaId = data.cuentaId ?? transaccion.cuentaId;
  if (!cuentaId) throw new Error("No se puede confirmar una transaccion sin cuenta");

  let fecha = transaccion.fecha;
  if (data.fecha) {
    const parsed = parseDateValue(data.fecha);
    if (!parsed) throw new Error("Fecha inválida");
    fecha = new Date(parsed);
  }

  const categoria = await prisma.categoria.findUnique({ where: { id: data.categoriaId } });
  if (!categoria) throw new Error("Categoría no encontrada");

  const updated = await prisma.$transaction(async (tx) => {
    await assertSufficientFunds(tx, cuentaId, transaccion.monto.toString(), fecha);
    return tx.transaccion.update({
      where: { id: transaccion.id },
      data: {
        categoriaId: data.categoriaId,
        subcategoriaId: data.subcategoriaId ?? transaccion.subcategoriaId,
        comercio: data.comercio ?? transaccion.comercio,
        fecha,
        estado: EstadoTransaccion.CONFIRMADA,
        cuentaId,
      },
    });
  });

  return updated;
}

export async function crearTransaccionOCR(
  prisma: PrismaClient,
  input: CrearTransaccionOCRInput,
): Promise<Transaccion> {
  const data = GastoOCRSchema.parse(input);
  const cuentaId = data.cuentaId ?? await resolverCuentaOCR(prisma, data.textoCrudo);
  const heuristic = interpretarOCR(data.textoCrudo, data.data);
  if (data.data?.esTransferenciaAPersona === true) {
    heuristic.esTransferenciaAPersona = true;
  }
  let interpreted = heuristic;
  let categoriaNombre: string | undefined = heuristic.categoria;

  if (process.env.GEMINI_API_KEY && process.env.NODE_ENV !== "test") {
    try {
      const ai = await interpretarConGemini(data.textoCrudo);
      if (ai) {
        interpreted = {
          monto: ai.monto == null ? undefined : String(ai.monto),
          categoria: ai.categoria ?? undefined,
          comercio: ai.comercio ?? undefined,
          fecha: ai.fecha ?? undefined,
          esTransferenciaAPersona: ai.esTransferenciaAPersona,
          exito: Boolean(ai.monto && ai.categoria),
        };
        categoriaNombre = ai.categoria ?? heuristic.categoria;
      }
    } catch {
      interpreted = { monto: undefined, categoria: undefined, comercio: undefined, fecha: undefined, esTransferenciaAPersona: false, exito: false };
      categoriaNombre = undefined;
    }
  }

  const categoriaId = categoriaNombre ? categoriaNombreToId(categoriaNombre) : undefined;

  const esTransferenciaAPersona = "esTransferenciaAPersona" in interpreted && interpreted.esTransferenciaAPersona === true;
  const estado = interpreted.exito && cuentaId && categoriaId && !esTransferenciaAPersona
    ? EstadoTransaccion.CONFIRMADA
      : cuentaId && interpreted.monto && (!categoriaId || esTransferenciaAPersona)
        ? EstadoTransaccion.PENDIENTE_CATEGORIA
        : EstadoTransaccion.PENDIENTE_REVISION;

  return crearTransaccion(prisma, {
    monto: interpreted.monto ?? "0",
    cuentaId,
    categoriaId: categoriaId ?? "cat-otros",
    origen: OrigenTransaccion.OCR_IA,
    idempotencyKey: data.idempotencyKey,
    comercio: interpreted.comercio,
    fecha: interpreted.fecha,
    estado,
    textoCrudoOCR: data.textoCrudo,
    esTransferenciaAPersona,
  } as CrearTransaccionInput);
}

export async function crearTransaccionWallet(
  prisma: PrismaClient,
  input: CrearTransaccionWalletInput,
): Promise<Transaccion> {
  const data = WalletInputSchema.parse(input);
  const cuentaId = await resolverCuentaWallet(prisma, data.tarjeta);
  const fallback = interpretarOCR(JSON.stringify({ monto: data.monto, comercio: data.comercio, fecha: data.fecha }));
  let interpreted = fallback;

  if (process.env.GEMINI_API_KEY && process.env.NODE_ENV !== "test") {
    try {
      const ai = await interpretarConGemini(`Pago Wallet: comercio ${data.comercio}; monto ${data.monto}; fecha ${data.fecha ?? "no informada"}`);
      if (ai) interpreted = { ...fallback, monto: ai.monto == null ? undefined : String(ai.monto), categoria: ai.categoria ?? undefined, comercio: ai.comercio ?? data.comercio, fecha: ai.fecha ?? data.fecha, exito: Boolean(ai.monto && ai.categoria) };
    } catch {
      interpreted = { ...fallback, categoria: undefined, exito: false };
    }
  }

  const categoriaId = interpreted.categoria ? categoriaNombreToId(interpreted.categoria) : undefined;
  const estado = cuentaId && interpreted.monto && categoriaId
    ? EstadoTransaccion.CONFIRMADA
    : cuentaId && interpreted.monto
      ? EstadoTransaccion.PENDIENTE_CATEGORIA
      : EstadoTransaccion.PENDIENTE_REVISION;

  return crearTransaccion(prisma, {
    monto: interpreted.monto ?? "0",
    cuentaId,
    categoriaId: categoriaId ?? "cat-otros",
    origen: OrigenTransaccion.APPLE_PAY,
    idempotencyKey: data.idempotencyKey,
    comercio: data.comercio,
    fecha: data.fecha,
    estado,
  });
}

const ResumenOCRInput = z.object({
  textoCrudo: z.string(),
  cuentaId: z.string(),
  idempotencyKey: z.string().optional(),
});

export type CrearResumenOCRInput = z.infer<typeof ResumenOCRInput>;

export async function crearResumenOCR(
  prisma: PrismaClient,
  input: CrearResumenOCRInput,
): Promise<Resumen> {
  const data = ResumenOCRInput.parse(input);

  // Intent: extraer periodo, monto total y monto minimo del texto
  const texto = data.textoCrudo;

  const periodoMatch =
    texto.match(/(\d{4}-\d{2})/) || texto.match(/(\d{2}\/\d{4})/);
  let periodo: string | undefined = undefined;
  if (periodoMatch) {
    const p = periodoMatch[1];
    if (/\d{4}-\d{2}/.test(p)) periodo = p;
    else if (/\d{2}\/\d{4}/.test(p)) {
      const [mm, yyyy] = p.split("/");
      periodo = `${yyyy}-${mm}`;
    }
  }

  const montoTotal = (() => {
    const totalMatch = texto.match(
      /monto\s*total\s*informado[:\s]*\$?\s*([\d.,-]+)/i,
    );
    if (totalMatch) return normalizeAmount(totalMatch[1]);
    return extractCurrencyAmount(texto);
  })();

  // buscar monto minimo
  const minimoMatch = texto.match(
    /monto\s*minim[oó]\s*informado[:\s]*\$?\s*([\d.,-]+)/i,
  );
  const montoMinimo = minimoMatch ? normalizeAmount(minimoMatch[1]) : undefined;

  // total consumos
  const totalConsumos = (() => {
    const m =
      texto.match(/total\s*consumos[:\s]*\$?\s*([\d.,-]+)/i) ||
      texto.match(/consumos(?:\s|:)\s*\$?\s*([\d.,-]+)/i);
    return m ? normalizeAmount(m[1]) : undefined;
  })();

  const parsedMontoTotal = montoTotal ? Number(montoTotal) : undefined;
  const parsedMontoMinimo = montoMinimo ? Number(montoMinimo) : undefined;
  const parsedTotalConsumos = totalConsumos ? Number(totalConsumos) : undefined;

  const created = await prisma.resumen.create({
    data: {
      cuentaId: data.cuentaId,
      periodo: periodo ?? "",
      montoTotalInformado: parsedMontoTotal ?? 0,
      montoMinimoInformado: parsedMontoMinimo ?? 0,
      totalConsumosInformado: parsedTotalConsumos ?? undefined,
      estado: "PENDIENTE",
    },
  });

  return created;
}
