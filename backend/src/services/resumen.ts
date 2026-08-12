import { PrismaClient, TipoCuenta, EstadoConciliacion } from "@prisma/client";
import type { GeminiResumen } from "./geminiResumen";

type ConsumoConciliado = GeminiResumen["consumos"][number] & { estado: "COINCIDE" | "SIN_REGISTRAR"; cuotaId?: string; compraId?: string };

function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

async function conciliarConsumos(prisma: PrismaClient, cuentaId: string, periodo: string, consumos: GeminiResumen["consumos"]): Promise<ConsumoConciliado[]> {
  const { start, end } = monthBounds(periodo);
  const cuotas = await prisma.cuota.findMany({
    where: { compra: { cuentaId }, estado: { not: "OMITIDO" } },
    include: { compra: { select: { id: true, comercio: true, cantidadCuotas: true, moneda: true } } },
  });
  const cuotasDelPeriodo = new Set(cuotas.filter((cuota) => cuota.fechaImputacion >= start && cuota.fechaImputacion < end).map((cuota) => cuota.id));
  const used = new Set<string>();
  return consumos.map((consumo) => {
    const candidates = cuotas.filter((cuota) => {
      if (used.has(cuota.id) || cuota.moneda !== consumo.moneda || Math.abs(Number(cuota.monto) - consumo.monto) >= 0.01) return false;
      if (consumo.cuotasTotales && cuota.compra.cantidadCuotas !== consumo.cuotasTotales) return false;
      const merchant = normalizeText(consumo.comercio ?? "");
      const purchaseMerchant = normalizeText(cuota.compra.comercio);
      return Boolean(merchant && purchaseMerchant && (merchant.includes(purchaseMerchant) || purchaseMerchant.includes(merchant)));
    });
    const match = candidates.find((cuota) => cuotasDelPeriodo.has(cuota.id) && (!consumo.cuotaActual || cuota.numeroCuota === consumo.cuotaActual))
      ?? candidates.find((cuota) => cuotasDelPeriodo.has(cuota.id))
      ?? candidates.find((cuota) => !consumo.cuotaActual || cuota.numeroCuota === consumo.cuotaActual);
    if (!match) return { ...consumo, estado: "SIN_REGISTRAR" as const };
    used.add(match.id);
    return { ...consumo, estado: "COINCIDE" as const, cuotaId: match.id, compraId: match.compra.id };
  });
}

function monthBounds(periodo: string): { start: Date; end: Date } {
  const start = new Date(`${periodo}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end };
}

export async function crearResumenDesdeGemini(
  prisma: PrismaClient,
  cuentaId: string,
  extracted: GeminiResumen,
) {
  if (!extracted.periodo || extracted.montoTotal == null || extracted.montoMinimo == null) {
    throw new Error("El resumen no contiene período, monto total o monto mínimo legible");
  }

  const cuenta = await prisma.cuenta.findUnique({ where: { id: cuentaId } });
  if (!cuenta) throw new Error("Cuenta no encontrada");
  if (cuenta.tipo !== TipoCuenta.TARJETA_CREDITO) throw new Error("La cuenta debe ser una tarjeta de crédito");
  if (cuenta.ultimosDigitos && extracted.ultimosDigitos && cuenta.ultimosDigitos !== extracted.ultimosDigitos) {
    throw new Error("Los últimos dígitos no coinciden con la tarjeta seleccionada");
  }
  const periodo = extracted.fechaVencimiento?.slice(0, 7) ?? extracted.periodo;
  const existing = await prisma.resumen.findFirst({ where: { cuentaId, periodo: { in: [periodo, extracted.periodo] } }, orderBy: { id: "asc" } });

  const { start, end } = monthBounds(periodo);
  const consumos = await conciliarConsumos(prisma, cuentaId, periodo, extracted.consumos);
  const cuotas = await prisma.cuota.findMany({
    where: { compra: { cuentaId }, fechaImputacion: { gte: start, lt: end }, estado: { not: "OMITIDO" } },
    select: { monto: true, moneda: true },
  });
  const cuotasTotal = cuotas.reduce((total, cuota) => total + (cuota.moneda === "ARS" ? Number(cuota.monto) : 0), 0);
  const diferencia = extracted.totalConsumos == null ? null : Number((extracted.totalConsumos - cuotasTotal).toFixed(2));
  const estadoConciliacion = diferencia == null
    ? EstadoConciliacion.PENDIENTE
    : Math.abs(diferencia) < 0.01 ? EstadoConciliacion.COINCIDE : EstadoConciliacion.CON_DIFERENCIA;

  const summaryData = {
      cuentaId,
      periodo,
      fechaCierre: extracted.fechaCierre ? new Date(`${extracted.fechaCierre}T00:00:00.000Z`) : null,
      fechaVencimiento: extracted.fechaVencimiento ? new Date(`${extracted.fechaVencimiento}T00:00:00.000Z`) : null,
      montoTotalInformado: extracted.montoTotal,
      montoMinimoInformado: extracted.montoMinimo,
      totalConsumosInformado: extracted.totalConsumos,
      totalConsumosUSDInformado: extracted.totalConsumosUSD,
      saldoUSDInformado: extracted.saldoUSD,
      saldoFinanciado: extracted.saldoFinanciado ?? 0,
      entidadInformada: extracted.entidad,
      ultimosDigitosInformados: extracted.ultimosDigitos,
      interesesInformados: extracted.intereses,
      impuestosInformados: extracted.impuestos,
      comisionesInformadas: extracted.comisiones,
      segurosInformados: extracted.seguros,
      confianzaOCR: extracted.confianza,
      diferenciaConciliacion: diferencia,
      estadoConciliacion,
      estado: "PENDIENTE",
      consumosExtraidos: consumos,
    } as const;
  const resumen = existing
    ? await prisma.resumen.update({ where: { id: existing.id }, data: summaryData })
    : await prisma.resumen.create({ data: summaryData });
  if (existing) await prisma.cargoResumen.deleteMany({ where: { resumenId: resumen.id, estado: "PENDIENTE" } });
  const cargos = [
    ["INTERESES", extracted.intereses],
    ["IMPUESTOS", extracted.impuestos],
    ["COMISIONES", extracted.comisiones],
    ["SEGUROS", extracted.seguros],
    ["IVA_INTERESES", extracted.ivaIntereses],
    ["IVA_COMISIONES", extracted.ivaComisiones],
    ["IVA_IMPUESTOS", extracted.ivaImpuestos],
    ["IMPUESTO_SELLO", extracted.impuestoSello],
  ] as const;
  const validCargos = cargos.filter(([, monto]) => monto != null && monto > 0);
  if (validCargos.length) {
    await prisma.cargoResumen.createMany({ data: validCargos.map(([tipo, monto]) => ({ resumenId: resumen.id, tipo, monto: monto! })), skipDuplicates: true });
  }
  return resumen;
}

export async function reconciliarResumen(prisma: PrismaClient, resumenId: string) {
  const resumen = await prisma.resumen.findUnique({ where: { id: resumenId } });
  if (!resumen) throw new Error("Resumen no encontrado");
  const { start, end } = monthBounds(resumen.periodo);
  const cuotas = await prisma.cuota.findMany({
    where: { compra: { cuentaId: resumen.cuentaId }, fechaImputacion: { gte: start, lt: end }, estado: { not: "OMITIDO" } },
    select: { monto: true, moneda: true },
  });
  const total = cuotas.reduce((sum, cuota) => sum + (cuota.moneda === "ARS" ? Number(cuota.monto) : 0), 0);
  const extractedRows = Array.isArray(resumen.consumosExtraidos) ? resumen.consumosExtraidos : [];
  const consumosExtraidos = extractedRows.length
    ? await conciliarConsumos(prisma, resumen.cuentaId, resumen.periodo, extractedRows as GeminiResumen["consumos"])
    : undefined;
  const diferencia = resumen.totalConsumosInformado == null ? null : Number((Number(resumen.totalConsumosInformado) - total).toFixed(2));
  return prisma.resumen.update({
    where: { id: resumenId },
    data: {
      diferenciaConciliacion: diferencia,
      estadoConciliacion: diferencia == null ? "PENDIENTE" : Math.abs(diferencia) < 0.01 ? "COINCIDE" : "CON_DIFERENCIA",
      consumosExtraidos,
    },
  });
}

export async function listarResumens(prisma: PrismaClient, cuentaId?: string) {
  return prisma.resumen.findMany({
    where: { cuentaId },
    orderBy: [{ periodo: "desc" }, { id: "desc" }],
  });
}
