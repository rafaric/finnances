import { PrismaClient } from "@prisma/client";

export async function calcularSaldo(
  prisma: PrismaClient,
  cuentaId: string,
): Promise<number> {
  const cuenta = await prisma.cuenta.findUnique({ where: { id: cuentaId } });
  if (!cuenta) throw new Error("Cuenta no encontrada");

  const transacciones = await prisma.transaccion.findMany({
    where: { cuentaId },
  });

  const movimientosSum = transacciones.reduce((acc, t) => {
    return acc + Number(t.monto);
  }, 0);

  return Number(cuenta.saldoInicial) + movimientosSum;
}

export default calcularSaldo;
