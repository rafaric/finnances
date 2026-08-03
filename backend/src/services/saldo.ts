import { EstadoTransaccion, PrismaClient } from "@prisma/client";

export async function calcularSaldo(
  prisma: PrismaClient,
  cuentaId: string,
): Promise<number> {
  const cuenta = await prisma.cuenta.findUnique({ where: { id: cuentaId } });
  if (!cuenta) throw new Error("Cuenta no encontrada");

  const [transacciones, transferenciasSalientes, transferenciasEntrantes] =
    await Promise.all([
      prisma.transaccion.findMany({
        where: { cuentaId, estado: EstadoTransaccion.CONFIRMADA },
      }),
      prisma.transferenciaInterna.findMany({
        where: { cuentaOrigenId: cuentaId },
      }),
      prisma.transferenciaInterna.findMany({
        where: { cuentaDestinoId: cuentaId },
      }),
    ]);

  const movimientosSum = transacciones.reduce((acc, t) => {
    return acc + Number(t.monto);
  }, 0);

  const transferenciasSalientesSum = transferenciasSalientes.reduce((acc, t) => {
    return acc + Number(t.monto);
  }, 0);

  const transferenciasEntrantesSum = transferenciasEntrantes.reduce((acc, t) => {
    return acc + Number(t.monto);
  }, 0);

  return (
    Number(cuenta.saldoInicial) +
    movimientosSum -
    transferenciasSalientesSum +
    transferenciasEntrantesSum
  );
}

export default calcularSaldo;
