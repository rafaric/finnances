import { PrismaClient, EstadoInstanciaRecurrente, Frecuencia, MetodoPagoRecurrente, TipoMonto } from "@prisma/client";
import { z } from "zod";
import { crearTransaccion } from "./transaccion";

const CrearRecurrenteSchema = z.object({
  nombre: z.string().trim().min(1).max(80),
  montoFijo: z.union([z.string(), z.number()]),
  cuentaId: z.string().min(1),
  categoriaId: z.string().min(1),
  subcategoriaId: z.string().optional(),
  diaDelMes: z.number().int().min(1).max(31),
  notas: z.string().trim().max(60).optional(),
});

export type CrearRecurrenteInput = z.infer<typeof CrearRecurrenteSchema>;

function normalizeAmount(value: string | number): string {
  const parsed = typeof value === "number" ? value : Number(value.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("Monto inválido");
  return parsed.toFixed(2);
}

function monthlyDate(year: number, month: number, day: number): Date {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
}

export async function crearRecurrente(prisma: PrismaClient, input: CrearRecurrenteInput) {
  const data = CrearRecurrenteSchema.parse(input);
  const [cuenta, categoria, subcategoria] = await Promise.all([
    prisma.cuenta.findUnique({ where: { id: data.cuentaId } }),
    prisma.categoria.findUnique({ where: { id: data.categoriaId } }),
    data.subcategoriaId ? prisma.subcategoria.findUnique({ where: { id: data.subcategoriaId } }) : null,
  ]);
  if (!cuenta) throw new Error("Cuenta no encontrada");
  if (!categoria || categoria.tipo !== "GASTO") throw new Error("Categoría de gasto no encontrada");
  if (data.subcategoriaId && (!subcategoria || subcategoria.categoriaId !== categoria.id)) throw new Error("Subcategoría inválida");

  return prisma.gastoRecurrente.create({
    data: {
      nombre: data.nombre,
      tipoMonto: TipoMonto.FIJO,
      montoFijo: normalizeAmount(data.montoFijo),
      cuentaId: data.cuentaId,
      categoriaId: data.categoriaId,
      subcategoriaId: data.subcategoriaId,
      frecuencia: Frecuencia.MENSUAL,
      diaDelMes: data.diaDelMes,
      metodoPago: MetodoPagoRecurrente.MANUAL,
      notas: data.notas || undefined,
    },
    include: { cuenta: true, categoria: true, subcategoria: true },
  });
}

export function listarRecurrentes(prisma: PrismaClient) {
  return prisma.gastoRecurrente.findMany({
    where: { activo: true, tipoMonto: TipoMonto.FIJO, frecuencia: Frecuencia.MENSUAL },
    include: { cuenta: true, categoria: true, subcategoria: true },
    orderBy: { nombre: "asc" },
  });
}

export async function generarInstanciaRecurrente(prisma: PrismaClient, recurrenteId: string, fecha = new Date()) {
  const recurrente = await prisma.gastoRecurrente.findUnique({ where: { id: recurrenteId } });
  if (!recurrente || !recurrente.activo) throw new Error("Recurrente no encontrado");
  if (recurrente.tipoMonto !== TipoMonto.FIJO || recurrente.frecuencia !== Frecuencia.MENSUAL || !recurrente.montoFijo || !recurrente.diaDelMes) {
    throw new Error("El recurrente no es fijo mensual");
  }

  const fechaVencimiento = monthlyDate(fecha.getUTCFullYear(), fecha.getUTCMonth(), recurrente.diaDelMes);
  return prisma.instanciaGastoRecurrente.upsert({
    where: { gastoRecurrenteId_fechaVencimiento: { gastoRecurrenteId: recurrente.id, fechaVencimiento } },
    update: {},
    create: {
      gastoRecurrenteId: recurrente.id,
      fechaVencimiento,
      monto: recurrente.montoFijo,
      montoEsEstimado: false,
    },
    include: { gastoRecurrente: { include: { cuenta: true, categoria: true, subcategoria: true } }, transaccion: true },
  });
}

export async function proyectarInstanciasDelPeriodo(prisma: PrismaClient, periodo: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(periodo);
  if (!match) throw new Error("Período inválido");
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const recurrentes = await prisma.gastoRecurrente.findMany({
    where: { activo: true, tipoMonto: TipoMonto.FIJO, frecuencia: Frecuencia.MENSUAL },
  });

  const instances = await Promise.all(recurrentes.map((recurrente) => {
    if (!recurrente.montoFijo || !recurrente.diaDelMes) return null;
    return prisma.instanciaGastoRecurrente.upsert({
      where: {
        gastoRecurrenteId_fechaVencimiento: {
          gastoRecurrenteId: recurrente.id,
          fechaVencimiento: monthlyDate(year, month, recurrente.diaDelMes),
        },
      },
      update: {},
      create: {
        gastoRecurrenteId: recurrente.id,
        fechaVencimiento: monthlyDate(year, month, recurrente.diaDelMes),
        monto: recurrente.montoFijo,
        montoEsEstimado: false,
      },
    });
  }));

  return instances.filter((instance): instance is NonNullable<typeof instance> => instance !== null);
}

export function listarInstanciasRecurrentes(prisma: PrismaClient) {
  return prisma.instanciaGastoRecurrente.findMany({
    where: { estado: { in: [EstadoInstanciaRecurrente.PROYECTADO] } },
    include: { gastoRecurrente: { include: { cuenta: true, categoria: true, subcategoria: true } }, transaccion: true },
    orderBy: { fechaVencimiento: "asc" },
  });
}

export async function listarInstanciasProximas(prisma: PrismaClient, dias: number) {
  const today = new Date();
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);
  end.setDate(end.getDate() + dias);
  return prisma.instanciaGastoRecurrente.findMany({
    where: { estado: EstadoInstanciaRecurrente.PROYECTADO, fechaVencimiento: { lte: end } },
    include: { gastoRecurrente: { include: { cuenta: true, categoria: true, subcategoria: true } }, transaccion: true },
    orderBy: { fechaVencimiento: "asc" },
  });
}

export async function confirmarInstanciaRecurrente(prisma: PrismaClient, instanciaId: string, cuentaRealId?: string) {
  const instancia = await prisma.instanciaGastoRecurrente.findUnique({
    where: { id: instanciaId },
    include: { gastoRecurrente: true },
  });
  if (!instancia) throw new Error("Instancia recurrente no encontrada");
  if (instancia.estado !== EstadoInstanciaRecurrente.PROYECTADO) throw new Error("La instancia ya fue resuelta");

  const cuentaId = cuentaRealId ?? instancia.gastoRecurrente.cuentaId;
  const idempotencyKey = `recurrente:${instancia.id}`;
  const transaccion = await crearTransaccion(prisma, {
    monto: String(instancia.monto ?? instancia.gastoRecurrente.montoFijo ?? 0),
    cuentaId,
    categoriaId: instancia.gastoRecurrente.categoriaId,
    subcategoriaId: instancia.gastoRecurrente.subcategoriaId ?? undefined,
    origen: "RECURRENTE_CONFIRMADO",
    idempotencyKey,
    fecha: instancia.fechaVencimiento.toISOString(),
    comercio: instancia.gastoRecurrente.nombre,
  });

  return prisma.instanciaGastoRecurrente.update({
    where: { id: instancia.id },
    data: { estado: EstadoInstanciaRecurrente.CONFIRMADO, cuentaRealId: cuentaId, transaccionId: transaccion.id },
    include: { gastoRecurrente: { include: { cuenta: true, categoria: true, subcategoria: true } }, transaccion: true },
  });
}

export function omitirInstanciaRecurrente(prisma: PrismaClient, instanciaId: string) {
  return prisma.instanciaGastoRecurrente.updateMany({
    where: { id: instanciaId, estado: EstadoInstanciaRecurrente.PROYECTADO },
    data: { estado: EstadoInstanciaRecurrente.OMITIDO },
  }).then((result) => {
    if (result.count === 0) throw new Error("La instancia no existe o ya fue resuelta");
    return prisma.instanciaGastoRecurrente.findUnique({ where: { id: instanciaId } });
  });
}
