import { OrigenTransaccion, PrismaClient, TipoCuenta, TipoPagoResumen } from "@prisma/client";
import { z } from "zod";
import { crearTransferenciaInterna } from "./transaccion";

const CrearPagoSchema = z.object({
  cuentaOrigenId: z.string(),
  monto: z.string().or(z.number()),
  fecha: z.string(),
  tipo: z.nativeEnum(TipoPagoResumen),
  idempotencyKey: z.string(),
});

export type CrearPagoInput = z.infer<typeof CrearPagoSchema>;

export async function registrarPagoResumen(prisma: PrismaClient, resumenId: string, input: CrearPagoInput) {
  const data = CrearPagoSchema.parse(input);
  const resumen = await prisma.resumen.findUnique({ where: { id: resumenId } });
  if (!resumen) throw new Error("Resumen no encontrado");
  if (resumen.estado === "PAGADO_TOTAL") throw new Error("El resumen ya está pagado");

  const amount = Number(data.monto);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Monto inválido");
  const paid = await prisma.pagoResumen.aggregate({ where: { resumenId }, _sum: { monto: true } });
  const remaining = Number(resumen.montoTotalInformado) - Number(paid._sum.monto ?? 0);
  if (amount > remaining + 0.01) throw new Error("El pago supera el saldo pendiente del resumen");

  const source = await prisma.cuenta.findUnique({ where: { id: data.cuentaOrigenId } });
  if (!source || source.tipo === TipoCuenta.TARJETA_CREDITO) throw new Error("La cuenta de pago debe ser una cuenta de fondos");
  const start = new Date(`${resumen.periodo}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const cuotas = await prisma.cuota.findMany({ where: { fechaImputacion: { gte: start, lt: end }, estado: "PROYECTADO", compra: { cuentaId: resumen.cuentaId } }, include: { compra: true } });
  if (cuotas.some((cuota) => !cuota.compra.categoriaId)) throw new Error("Hay cuotas sin categoría que deben corregirse antes de pagar el resumen");
  const transfer = await crearTransferenciaInterna(prisma, {
    cuentaOrigenId: data.cuentaOrigenId,
    cuentaDestinoId: resumen.cuentaId,
    monto: amount,
    fecha: data.fecha,
    nota: `Pago resumen ${resumen.periodo}`,
    idempotencyKey: `pago-resumen-transfer-${data.idempotencyKey}`,
  });
  const payment = await prisma.pagoResumen.create({ data: { resumenId, cuentaOrigenId: data.cuentaOrigenId, monto: amount, fecha: new Date(data.fecha), tipo: data.tipo, transferenciaId: transfer.id, idempotencyKey: data.idempotencyKey } });
  for (const cuota of cuotas) {
    if (!cuota.compra.categoriaId) throw new Error("Hay cuotas sin categoría que deben corregirse antes de pagar el resumen");
    await prisma.transaccion.create({ data: { monto: Number(cuota.monto) * -1, cuentaId: resumen.cuentaId, categoriaId: cuota.compra.categoriaId, comercio: cuota.compra.comercio, fecha: new Date(data.fecha), estado: "CONFIRMADA", origen: OrigenTransaccion.CUOTA_CONFIRMADA, idempotencyKey: `cuota-pago-${cuota.id}`, cuota: { connect: { id: cuota.id } } } });
    await prisma.cuota.update({ where: { id: cuota.id }, data: { estado: "CONFIRMADO" } });
  }
  const totalPaid = Number(paid._sum.monto ?? 0) + amount;
  await prisma.resumen.update({ where: { id: resumenId }, data: { montoPagado: totalPaid, fechaPago: new Date(data.fecha), estado: totalPaid + 0.01 >= Number(resumen.montoTotalInformado) ? "PAGADO_TOTAL" : "PAGADO_PARCIAL" } });
  return payment;
}

export async function registrarDebitosAutomaticos(prisma: PrismaClient, cuentaOrigenId: string, fecha: string, idempotencyKey: string) {
  const cards = await prisma.cuenta.findMany({ where: { cuentaDebitoMinimoId: cuentaOrigenId, tipo: TipoCuenta.TARJETA_CREDITO } });
  const payments = [];
  for (const card of cards) {
    const resumen = await prisma.resumen.findFirst({
      where: { cuentaId: card.id, estado: { in: ["PENDIENTE", "PAGADO_PARCIAL"] } },
      orderBy: { periodo: "desc" },
    });
    if (!resumen) continue;
    const paid = await prisma.pagoResumen.aggregate({ where: { resumenId: resumen.id }, _sum: { monto: true } });
    const pending = Math.max(0, Number(resumen.montoMinimoInformado) - Number(paid._sum.monto ?? 0));
    if (pending <= 0) continue;
    payments.push(await registrarPagoResumen(prisma, resumen.id, {
      cuentaOrigenId,
      monto: pending,
      fecha,
      tipo: TipoPagoResumen.DEBITO_AUTOMATICO,
      idempotencyKey: `${idempotencyKey}-tarjeta-${card.id}-resumen-${resumen.id}`,
    }));
  }
  return payments;
}
