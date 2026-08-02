import { PrismaClient, Transaccion } from "@prisma/client";
import { z } from "zod";

const TransaccionSchema = z.object({
  monto: z.string().or(z.number()),
  cuentaId: z.string(),
  categoria: z.string(),
  origen: z.string(),
  idempotencyKey: z.string(),
  fecha: z.string().optional(),
  comercio: z.string().optional(),
  cuotaId: z.string().optional(),
  transferenciaInternaId: z.string().optional(),
});

export type CrearTransaccionInput = z.infer<typeof TransaccionSchema>;

export async function crearTransaccion(
  prisma: PrismaClient,
  input: CrearTransaccionInput,
): Promise<Transaccion> {
  const data = TransaccionSchema.parse(input);

  // Idempotency check
  const existing = await prisma.transaccion.findUnique({
    where: { idempotencyKey: data.idempotencyKey },
  });
  if (existing) return existing as Transaccion;

  // Use a transaction to keep DB changes atomic
  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.transaccion.create({
      data: {
        monto: typeof data.monto === "string" ? data.monto : String(data.monto),
        moneda: "ARS",
        origen: data.origen as any,
        cuentaId: data.cuentaId,
        categoria: data.categoria as any,
        idempotencyKey: data.idempotencyKey,
        comercio: data.comercio,
        fecha: data.fecha ? new Date(data.fecha) : new Date(),
        transferenciaFondeoId: data.transferenciaInternaId,
      },
    });

    // Adjust balances when transferenciaInternaId is present
    if (data.transferenciaInternaId) {
      const transferencia = await tx.transferenciaInterna.findUnique({
        where: { id: data.transferenciaInternaId },
      });
      if (transferencia) {
        // decrement origen
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
    } else {
      // Regular transaction: update the account balance (we use saldoInicial as current balance field)
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

    // Link cuota if provided
    if (data.cuotaId) {
      await tx.cuota.update({
        where: { id: data.cuotaId },
        data: { transaccionId: created.id, estado: "CONFIRMADO" },
      });
    }

    return created as Transaccion;
  });

  return result;
}
