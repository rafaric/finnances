import {
  PrismaClient,
  Transaccion,
  Categoria,
  OrigenTransaccion,
  EstadoTransaccion,
} from "@prisma/client";
import { z } from "zod";

const TransaccionSchema = z.object({
  monto: z.string().or(z.number()),
  cuentaId: z.string(),
  categoria: z.nativeEnum(Categoria),
  origen: z.nativeEnum(OrigenTransaccion),
  idempotencyKey: z.string(),
  fecha: z.string().optional(),
  comercio: z.string().optional(),
  cuotaId: z.string().optional(),
  transferenciaInternaId: z.string().optional(),
  estado: z.nativeEnum(EstadoTransaccion).optional(),
  textoCrudoOCR: z.string().optional(),
});

export type CrearTransaccionInput = z.infer<typeof TransaccionSchema>;

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

export type CrearTransaccionOCRInput = z.infer<typeof GastoOCRSchema>;

type OCRFallbackData = z.infer<typeof GastoOCRSchema>["data"];

function normalizeAmount(
  value: string | number | undefined,
): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "number") return value.toFixed(2);

  const cleaned = value
    .trim()
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=.*\.)/g, "")
    .replace(/,/g, ".");
  const match = cleaned.match(/-?\d+(?:\.\d{1,2})?/);
  return match ? Number(match[0]).toFixed(2) : undefined;
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

function inferCategoria(text: string): Categoria | undefined {
  const mappings: Array<{ re: RegExp; category: Categoria }> = [
    {
      re: /\b(almuerzo|restaurante|comida|pizzeria|cafe|bar|caf[eé])\b/i,
      category: Categoria.COMIDA,
    },
    {
      re: /\b(uber|taxi|boleto|transporte|tren|colectivo|bus|metro|subte|viaje)\b/i,
      category: Categoria.TRANSPORTE,
    },
    {
      re: /\b(alquiler|hipoteca|departamento|casa|vivienda|renta)\b/i,
      category: Categoria.VIVIENDA,
    },
    {
      re: /\b(luz|agua|gas|internet|celular|telefon[oó]|servicios?)\b/i,
      category: Categoria.SERVICIOS,
    },
    {
      re: /\b(cine|teatro|hotel|ocio|entretenimiento|musica|spotify|netflix)\b/i,
      category: Categoria.OCIO,
    },
    {
      re: /\b(pago|cuota|prestamo|deuda|tarjeta|saldo)\b/i,
      category: Categoria.DEUDAS,
    },
  ];

  for (const mapping of mappings) {
    if (mapping.re.test(text)) return mapping.category;
  }
  return undefined;
}

function parseDateValue(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const candidate = new Date(text);
  if (!Number.isNaN(candidate.getTime())) return candidate.toISOString();

  const match = text.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    const parsed = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  return undefined;
}

function interpretarOCR(textoCrudo: string, fallback?: OCRFallbackData) {
  const texto = textoCrudo.trim();
  let monto = fallback?.monto ? normalizeAmount(fallback.monto) : undefined;
  let categoria: Categoria | undefined = undefined;
  let comercio = fallback?.comercio;
  let fecha = fallback?.fecha ? parseDateValue(fallback.fecha) : undefined;

  if (fallback?.categoria) {
    const categoriaUpper = fallback.categoria.toUpperCase();
    if (Object.values(Categoria).includes(categoriaUpper as Categoria)) {
      categoria = categoriaUpper as Categoria;
    }
  }

  try {
    const candidate = JSON.parse(texto);
    if (typeof candidate === "object" && candidate !== null) {
      if (!monto && candidate.monto != null)
        monto = normalizeAmount(candidate.monto);
      if (!categoria && typeof candidate.categoria === "string") {
        const categoriaUpper = candidate.categoria.toUpperCase();
        if (Object.values(Categoria).includes(categoriaUpper as Categoria)) {
          categoria = categoriaUpper as Categoria;
        }
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
    const dateMatch = texto.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) fecha = parseDateValue(dateMatch[1]);
  }

  const exito = Boolean(monto && categoria);
  return { monto, categoria, comercio, fecha, exito };
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

  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.transaccion.create({
      data: {
        monto: typeof data.monto === "string" ? data.monto : String(data.monto),
        moneda: "ARS",
        origen: data.origen,
        cuentaId: data.cuentaId,
        categoria: data.categoria,
        idempotencyKey: data.idempotencyKey,
        comercio: data.comercio,
        fecha: data.fecha ? new Date(data.fecha) : new Date(),
        transferenciaFondeoId: data.transferenciaInternaId,
        estado: data.estado ?? EstadoTransaccion.CONFIRMADA,
        textoCrudoOCR: data.textoCrudoOCR,
      },
    });

    const shouldApplyBalance = created.estado === EstadoTransaccion.CONFIRMADA;

    if (shouldApplyBalance && data.transferenciaInternaId) {
      const transferencia = await tx.transferenciaInterna.findUnique({
        where: { id: data.transferenciaInternaId },
      });
      if (transferencia) {
        const origenCuenta = await tx.cuenta.findUnique({
          where: { id: transferencia.cuentaOrigenId },
        });
        const destinoCuenta = await tx.cuenta.findUnique({
          where: { id: transferencia.cuentaDestinoId },
        });
        if (origenCuenta && destinoCuenta) {
          await tx.cuenta.update({
            where: { id: transferencia.cuentaOrigenId },
            data: {
              saldoInicial: origenCuenta.saldoInicial.minus(
                Number(data.monto),
              ) as any,
            },
          });
          await tx.cuenta.update({
            where: { id: transferencia.cuentaDestinoId },
            data: {
              saldoInicial: destinoCuenta.saldoInicial.plus(
                Number(data.monto),
              ) as any,
            },
          });
        }
      }
    } else if (shouldApplyBalance) {
      const cuenta = await tx.cuenta.findUnique({
        where: { id: data.cuentaId },
      });
      if (cuenta) {
        await tx.cuenta.update({
          where: { id: data.cuentaId },
          data: {
            saldoInicial: cuenta.saldoInicial.plus(Number(data.monto)) as any,
            saldoActualizadoEn: new Date(),
          },
        });
      }
    }

    if (shouldApplyBalance && data.cuotaId) {
      await tx.cuota.update({
        where: { id: data.cuotaId },
        data: { transaccionId: created.id, estado: "CONFIRMADO" },
      });
    }

    return created as Transaccion;
  });

  return result;
}

const CorregirOCRSchema = z.object({
  monto: z.string().or(z.number()).optional(),
  categoria: z.nativeEnum(Categoria).optional(),
  comercio: z.string().optional(),
  fecha: z.string().optional(),
});

export type CorregirTransaccionOCRInput = z.infer<typeof CorregirOCRSchema>;

const TransferenciaInternaSchema = z.object({
  cuentaOrigenId: z.string(),
  cuentaDestinoId: z.string(),
  monto: z.string().or(z.number()),
  nota: z.string().optional(),
  fecha: z.string().optional(),
  idempotencyKey: z.string(),
});

export type CrearTransferenciaInternaInput = z.infer<
  typeof TransferenciaInternaSchema
>;

export async function crearTransferenciaInterna(
  prisma: PrismaClient,
  input: CrearTransferenciaInternaInput,
): Promise<Transaccion> {
  const data = TransferenciaInternaSchema.parse(input);
  const existing = await prisma.transaccion.findUnique({
    where: { idempotencyKey: data.idempotencyKey },
  });
  if (existing) return existing as Transaccion;

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

    const transferencia = await tx.transferenciaInterna.create({
      data: {
        cuentaOrigenId: data.cuentaOrigenId,
        cuentaDestinoId: data.cuentaDestinoId,
        monto: typeof data.monto === "string" ? data.monto : String(data.monto),
        nota: data.nota,
        fecha: parsedFecha ? new Date(parsedFecha) : undefined,
      },
    });

    const transaccion = await tx.transaccion.create({
      data: {
        monto: typeof data.monto === "string" ? data.monto : String(data.monto),
        moneda: "ARS",
        origen: OrigenTransaccion.MANUAL,
        cuentaId: data.cuentaOrigenId,
        categoria: Categoria.OTROS,
        idempotencyKey: data.idempotencyKey,
        comercio: "Transferencia interna",
        fecha: parsedFecha ? new Date(parsedFecha) : new Date(),
        transferenciaFondeoId: transferencia.id,
        estado: EstadoTransaccion.CONFIRMADA,
      },
    });

    await tx.cuenta.update({
      where: { id: data.cuentaOrigenId },
      data: {
        saldoInicial: origenCuenta.saldoInicial.minus(
          Number(data.monto),
        ) as any,
      },
    });

    await tx.cuenta.update({
      where: { id: data.cuentaDestinoId },
      data: {
        saldoInicial: destinoCuenta.saldoInicial.plus(
          Number(data.monto),
        ) as any,
      },
    });

    return transaccion;
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
      ? normalizeAmount(data.monto)
      : transaccion.monto.toString();
  if (data.monto !== undefined && normalizedMonto == null) {
    throw new Error("Monto inválido");
  }

  let fecha = transaccion.fecha;
  if (data.fecha) {
    const parsed = parseDateValue(data.fecha);
    if (!parsed) throw new Error("Fecha inválida");
    fecha = new Date(parsed);
  }

  const updatedCategoria = data.categoria ?? transaccion.categoria;
  const shouldConfirm = Boolean(normalizedMonto && updatedCategoria);

  const updated = await prisma.$transaction(async (tx) => {
    const updatedTransaccion = await tx.transaccion.update({
      where: { id: transaccion.id },
      data: {
        monto: normalizedMonto ?? transaccion.monto.toString(),
        categoria: updatedCategoria,
        comercio: data.comercio ?? transaccion.comercio,
        fecha,
        estado: shouldConfirm
          ? EstadoTransaccion.CONFIRMADA
          : EstadoTransaccion.PENDIENTE_REVISION,
      },
    });

    if (shouldConfirm) {
      const cuenta = await tx.cuenta.findUnique({
        where: { id: updatedTransaccion.cuentaId },
      });
      if (cuenta) {
        await tx.cuenta.update({
          where: { id: cuenta.id },
          data: {
            saldoInicial: cuenta.saldoInicial.plus(
              Number(updatedTransaccion.monto),
            ) as any,
            saldoActualizadoEn: new Date(),
          },
        });
      }
    }

    return updatedTransaccion;
  });

  return updated;
}

const ResolverCategoriaSchema = z.object({
  categoria: z.nativeEnum(Categoria),
  comercio: z.string().optional(),
  fecha: z.string().optional(),
});

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

  let fecha = transaccion.fecha;
  if (data.fecha) {
    const parsed = parseDateValue(data.fecha);
    if (!parsed) throw new Error("Fecha inválida");
    fecha = new Date(parsed);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedTransaccion = await tx.transaccion.update({
      where: { id: transaccion.id },
      data: {
        categoria: data.categoria,
        comercio: data.comercio ?? transaccion.comercio,
        fecha,
        estado: EstadoTransaccion.CONFIRMADA,
      },
    });

    const cuenta = await tx.cuenta.findUnique({
      where: { id: updatedTransaccion.cuentaId },
    });
    if (cuenta) {
      await tx.cuenta.update({
        where: { id: cuenta.id },
        data: {
          saldoInicial: cuenta.saldoInicial.plus(
            Number(updatedTransaccion.monto),
          ) as any,
          saldoActualizadoEn: new Date(),
        },
      });
    }

    return updatedTransaccion;
  });

  return updated;
}

export async function crearTransaccionOCR(
  prisma: PrismaClient,
  input: CrearTransaccionOCRInput,
): Promise<Transaccion> {
  const data = GastoOCRSchema.parse(input);
  const interpreted = interpretarOCR(data.textoCrudo, data.data);

  const estado = interpreted.exito
    ? EstadoTransaccion.CONFIRMADA
    : interpreted.monto && !interpreted.categoria
      ? EstadoTransaccion.PENDIENTE_CATEGORIA
      : EstadoTransaccion.PENDIENTE_REVISION;

  return crearTransaccion(prisma, {
    monto: interpreted.monto ?? "0",
    cuentaId: data.cuentaId,
    categoria: interpreted.categoria ?? Categoria.OTROS,
    origen: OrigenTransaccion.OCR_IA,
    idempotencyKey: data.idempotencyKey,
    comercio: interpreted.comercio,
    fecha: interpreted.fecha,
    estado,
    textoCrudoOCR: data.textoCrudo,
  } as CrearTransaccionInput);
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
): Promise<any> {
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
