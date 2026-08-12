import { EstadoCargoResumen, PrismaClient, TipoCargoResumen } from "@prisma/client";
import { z } from "zod";

const ChargeStatusSchema = z.object({ estado: z.enum(["CONFIRMADO", "OMITIDO"]) });
export type ChargeStatusInput = z.infer<typeof ChargeStatusSchema>;

export async function listarCargosResumen(prisma: PrismaClient, resumenId: string) {
  return prisma.cargoResumen.findMany({ where: { resumenId }, orderBy: { tipo: "asc" } });
}

export async function crearCargosResumen(prisma: PrismaClient, resumenId: string, values: Partial<Record<TipoCargoResumen, number | null>>) {
  const cargos = Object.entries(values).filter((entry): entry is [TipoCargoResumen, number] => typeof entry[1] === "number" && entry[1] > 0);
  if (!cargos.length) return;
  await prisma.cargoResumen.createMany({ data: cargos.map(([tipo, monto]) => ({ resumenId, tipo, monto })) });
}

export async function resolverCargoResumen(prisma: PrismaClient, cargoId: string, input: ChargeStatusInput) {
  const data = ChargeStatusSchema.parse(input);
  const cargo = await prisma.cargoResumen.findUnique({ where: { id: cargoId }, include: { resumen: true } });
  if (!cargo) throw new Error("Cargo de resumen no encontrado");
  if (cargo.estado !== EstadoCargoResumen.PENDIENTE) throw new Error("El cargo de resumen ya fue resuelto");
  if (data.estado === "OMITIDO") return prisma.cargoResumen.update({ where: { id: cargoId }, data: { estado: "OMITIDO" } });

  return prisma.cargoResumen.update({ where: { id: cargoId }, data: { estado: "CONFIRMADO" } });
}
