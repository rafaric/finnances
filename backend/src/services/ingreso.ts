import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { invalidarAnalisisInsight } from "./analisisInsight";
import { TipoCategoria } from "@prisma/client";
import type { EditarIngresoInput } from "../dto/ingreso";

const IngresoSchema = z.object({
  monto: z.string().or(z.number()),
  fechaCobro: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodoDisponible: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  iniciaCicloFinanciero: z.boolean().optional(),
  cuentaId: z.string().min(1),
  categoriaId: z.string().min(1),
  subcategoriaId: z.string().optional(),
  idempotencyKey: z.string().min(1),
  confirmarDebitosAutomaticos: z.boolean().optional(),
});

export type CrearIngresoInput = z.infer<typeof IngresoSchema>;

function normalizeAmount(value: string | number): string {
  const parsed = typeof value === "number" ? value : Number(value.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("Monto inválido");
  return parsed.toFixed(2);
}

const EditarIngresoSchema = IngresoSchema.omit({ idempotencyKey: true, confirmarDebitosAutomaticos: true }).partial().superRefine((value, ctx) => {
  if (value.monto !== undefined) {
    const amount = typeof value.monto === "number" ? value.monto : Number(value.monto.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["monto"], message: "Monto inválido" });
  }
});

export async function editarIngreso(prisma: PrismaClient, ingresoId: string, input: EditarIngresoInput) {
  const data = EditarIngresoSchema.parse(input);
  const ingreso = await prisma.ingreso.findUnique({ where: { id: ingresoId } });
  if (!ingreso) throw new Error("Ingreso no encontrado");
  const categoriaId = data.categoriaId ?? ingreso.categoriaId;
  const categoria = await prisma.categoria.findUnique({ where: { id: categoriaId } });
  if (!categoria || categoria.tipo !== TipoCategoria.INGRESO) throw new Error("La categoría debe ser de ingreso");
  const subcategoriaId = data.subcategoriaId === undefined ? ingreso.subcategoriaId : data.subcategoriaId;
  if (subcategoriaId) {
    const subcategoria = await prisma.subcategoria.findUnique({ where: { id: subcategoriaId } });
    if (!subcategoria || subcategoria.categoriaId !== categoriaId) throw new Error("La subcategoría no pertenece a la categoría seleccionada");
  }
  const cuentaId = data.cuentaId ?? ingreso.cuentaId;
  if (!(await prisma.cuenta.findUnique({ where: { id: cuentaId } }))) throw new Error("Cuenta no encontrada");
  const fechaCobro = data.fechaCobro ? new Date(`${data.fechaCobro}T00:00:00.000Z`) : ingreso.fechaCobro;
  if (Number.isNaN(fechaCobro.getTime())) throw new Error("Fecha inválida");
  const periodoDisponible = data.periodoDisponible ?? ingreso.periodoDisponible;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodoDisponible)) throw new Error("Período disponible inválido");
  const updated = await prisma.ingreso.update({ where: { id: ingresoId }, data: {
    monto: data.monto === undefined ? ingreso.monto : normalizeAmount(data.monto), fechaCobro, periodoDisponible,
    iniciaCicloFinanciero: data.iniciaCicloFinanciero ?? ingreso.iniciaCicloFinanciero, cuentaId, categoriaId, subcategoriaId,
  }});
  await Promise.all([...new Set([ingreso.periodoDisponible, updated.periodoDisponible])].map((periodo) => invalidarAnalisisInsight(prisma, periodo)));
  return updated;
}

export async function crearIngreso(prisma: PrismaClient, input: CrearIngresoInput) {
  const data = IngresoSchema.parse(input);
  const existing = await prisma.ingreso.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
  if (existing) return existing;

  const categoria = await prisma.categoria.findUnique({ where: { id: data.categoriaId } });
  if (!categoria) throw new Error("Categoría no encontrada");

  const subcategoria = data.subcategoriaId
    ? await prisma.subcategoria.findUnique({ where: { id: data.subcategoriaId } })
    : null;
  if (data.subcategoriaId && !subcategoria) throw new Error("Subcategoría no encontrada");

  const fecha = new Date(`${data.fechaCobro}T00:00:00.000Z`);
  if (Number.isNaN(fecha.getTime())) throw new Error("Fecha inválida");

  const ingreso = await prisma.ingreso.create({
    data: {
      monto: normalizeAmount(data.monto),
      fechaCobro: fecha,
      periodoDisponible: data.periodoDisponible,
      iniciaCicloFinanciero: data.iniciaCicloFinanciero ?? false,
      cuentaId: data.cuentaId,
      categoriaId: data.categoriaId,
      subcategoriaId: subcategoria?.id,
      idempotencyKey: data.idempotencyKey,
    },
  });
  await invalidarAnalisisInsight(prisma, ingreso.periodoDisponible);
  return ingreso;
}
