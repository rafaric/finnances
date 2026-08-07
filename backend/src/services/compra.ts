import { PrismaClient, TipoCuenta } from "@prisma/client";
import { z } from "zod";

const CrearCompraSchema = z.object({
  montoTotal: z.string().or(z.number()),
  comercio: z.string().trim().min(1),
  fechaCompra: z.string(),
  cantidadCuotas: z.number().int().min(1).max(120).default(1),
  cuentaId: z.string(),
  categoriaId: z.string().optional(),
});

export type CrearCompraInput = z.infer<typeof CrearCompraSchema>;

function parseAmount(value: string | number): number {
  const amount = typeof value === "number" ? value : Number(value.replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Monto inválido");
  return amount;
}

function parseDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Fecha inválida");
  return date;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

function firstInstallmentDate(fechaCompra: Date, diaCierre?: number | null, diaPago?: number | null): Date {
  // A purchase before the close appears on the next due date; after close, it rolls to the following cycle.
  const monthOffset = diaCierre && fechaCompra.getUTCDate() > diaCierre ? 2 : 1;
  const result = addMonths(fechaCompra, monthOffset);
  if (!diaPago) return result;
  result.setUTCDate(1);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(diaPago, lastDay));
  return result;
}

export async function crearCompra(prisma: PrismaClient, input: CrearCompraInput) {
  const data = CrearCompraSchema.parse(input);
  const montoTotal = parseAmount(data.montoTotal);
  const fechaCompra = parseDate(data.fechaCompra);
  const cuenta = await prisma.cuenta.findUnique({ where: { id: data.cuentaId } });

  if (!cuenta) throw new Error("Cuenta no encontrada");
  if (cuenta.tipo !== TipoCuenta.TARJETA_CREDITO) throw new Error("La cuenta debe ser una tarjeta de crédito");
  if (data.categoriaId) {
    const categoria = await prisma.categoria.findUnique({ where: { id: data.categoriaId } });
    if (!categoria || categoria.tipo !== "GASTO") throw new Error("Categoría no encontrada");
  }

  const cuotas = Array.from({ length: data.cantidadCuotas }, (_, index) => ({
    numeroCuota: index + 1,
    monto: (montoTotal / data.cantidadCuotas).toFixed(2),
    fechaImputacion: addMonths(firstInstallmentDate(fechaCompra, cuenta.diaCierre, cuenta.diaPago), index),
  }));

  return prisma.compra.create({
    data: {
      montoTotal: montoTotal.toFixed(2),
      comercio: data.comercio,
      fechaCompra,
      cantidadCuotas: data.cantidadCuotas,
      cuentaId: data.cuentaId,
      categoriaId: data.categoriaId,
      cuotas: { create: cuotas },
    },
    include: { cuotas: { orderBy: { numeroCuota: "asc" } } },
  });
}

export async function listarCompras(prisma: PrismaClient, params: { cuentaId?: string; periodo?: string }) {
  return prisma.compra.findMany({
    where: {
      cuentaId: params.cuentaId,
      cuotas: params.periodo ? { some: { fechaImputacion: { gte: new Date(`${params.periodo}-01`), lt: addMonths(new Date(`${params.periodo}-01`), 1) } } } : undefined,
    },
    include: { cuotas: { orderBy: { numeroCuota: "asc" } } },
    orderBy: { fechaCompra: "desc" },
  });
}

export async function listarCuotas(prisma: PrismaClient, params: { cuentaId?: string; periodo?: string }) {
  return prisma.cuota.findMany({
    where: {
      compra: { cuentaId: params.cuentaId },
      fechaImputacion: params.periodo ? { gte: new Date(`${params.periodo}-01`), lt: addMonths(new Date(`${params.periodo}-01`), 1) } : undefined,
    },
    include: { compra: true },
    orderBy: [{ fechaImputacion: "asc" }, { numeroCuota: "asc" }],
  });
}

export async function eliminarCompra(prisma: PrismaClient, compraId: string) {
  const compra = await prisma.compra.findUnique({ where: { id: compraId }, include: { cuotas: true } });
  if (!compra) throw new Error("Compra no encontrada");
  if (compra.cuotas.some((cuota) => cuota.transaccionId)) throw new Error("No se puede eliminar una compra con cuotas confirmadas");
  await prisma.$transaction([
    prisma.cuota.deleteMany({ where: { compraId } }),
    prisma.compra.delete({ where: { id: compraId } }),
  ]);
}
