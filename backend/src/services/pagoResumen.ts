import { PrismaClient, TipoCuenta, TipoPagoResumen } from "@prisma/client";
import { z } from "zod";
import { crearTransferenciaInterna } from "./transaccion";
import { sumarPagosElegibles } from "./pagosResumenElegibles";

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
  const pagos = await prisma.pagoResumen.findMany({ where: { resumenId }, select: { fecha: true, monto: true } });
  const totalPaidBefore = sumarPagosElegibles(pagos, resumen.fechaCierre);
  const remaining = Number(resumen.montoTotalInformado) - totalPaidBefore;
  if (amount > remaining + 0.01) throw new Error("El pago supera el saldo pendiente del resumen");

  const source = await prisma.cuenta.findUnique({ where: { id: data.cuentaOrigenId } });
  if (!source || source.tipo === TipoCuenta.TARJETA_CREDITO) throw new Error("La cuenta de pago debe ser una cuenta de fondos");
  const transfer = await crearTransferenciaInterna(prisma, {
    cuentaOrigenId: data.cuentaOrigenId,
    cuentaDestinoId: resumen.cuentaId,
    monto: amount,
    fecha: data.fecha,
    nota: `Pago resumen ${resumen.periodo}`,
    idempotencyKey: `pago-resumen-transfer-${data.idempotencyKey}`,
  });
  const payment = await prisma.pagoResumen.create({ data: { resumenId, cuentaOrigenId: data.cuentaOrigenId, monto: amount, fecha: new Date(data.fecha), tipo: data.tipo, transferenciaId: transfer.id, idempotencyKey: data.idempotencyKey } });
  const totalPaid = totalPaidBefore + amount;
  await prisma.resumen.update({ where: { id: resumenId }, data: { montoPagado: totalPaid, fechaPago: new Date(data.fecha), estado: totalPaid + 0.01 >= Number(resumen.montoTotalInformado) ? "PAGADO_TOTAL" : "PAGADO_PARCIAL" } });
  return payment;
}

export async function registrarDebitosAutomaticos(prisma: PrismaClient, cuentaOrigenId: string, fecha: string, idempotencyKey: string) {
  const cards = await prisma.cuenta.findMany({ where: { cuentaDebitoMinimoId: cuentaOrigenId, tipo: TipoCuenta.TARJETA_CREDITO } });
  const payments = [];
  const debitDate = new Date(fecha);
  if (Number.isNaN(debitDate.getTime())) throw new Error("Fecha de débito inválida");
  for (const card of cards) {
    const summaries = await prisma.resumen.findMany({
      where: { cuentaId: card.id, estado: { in: ["PENDIENTE", "PAGADO_PARCIAL"] } },
      orderBy: { periodo: "desc" },
    });
    const resumen = summaries.find((candidate) => {
      if (!candidate.fechaCierre || !candidate.fechaVencimiento) return false;
      if (Number.isNaN(candidate.fechaCierre.getTime()) || Number.isNaN(candidate.fechaVencimiento.getTime())) return false;
      return candidate.fechaCierre <= debitDate && debitDate <= candidate.fechaVencimiento;
    });
    if (!resumen) continue;
    const pagos = await prisma.pagoResumen.findMany({ where: { resumenId: resumen.id }, select: { fecha: true, monto: true } });
    const pending = Math.max(0, Number(resumen.montoMinimoInformado) - sumarPagosElegibles(pagos, resumen.fechaCierre));
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
