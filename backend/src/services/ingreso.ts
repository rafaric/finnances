import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { invalidarAnalisisInsight } from "./analisisInsight";

const IngresoSchema = z.object({
  monto: z.string().or(z.number()),
  fechaCobro: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodoDisponible: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
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
      cuentaId: data.cuentaId,
      categoriaId: data.categoriaId,
      subcategoriaId: subcategoria?.id,
      idempotencyKey: data.idempotencyKey,
    },
  });
  await invalidarAnalisisInsight(prisma, ingreso.periodoDisponible);
  return ingreso;
}
