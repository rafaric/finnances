import { EstadoTransaccion, PrismaClient } from "@prisma/client";

export async function calcularSaldo(
  prisma: PrismaClient,
  cuentaId: string,
  asOf?: Date,
): Promise<number> {
  const cuenta = await prisma.cuenta.findUnique({ where: { id: cuentaId } });
  if (!cuenta) throw new Error("Cuenta no encontrada");

  if (cuenta.tipo === "TARJETA_CREDITO") {
    const resumen = await prisma.resumen.findFirst({
      where: { cuentaId },
      orderBy: [{ periodo: "desc" }, { id: "desc" }],
    });

    if (resumen) {
      const pagos = await prisma.pagoResumen.aggregate({
        where: { resumenId: resumen.id, ...(asOf ? { fecha: { lte: asOf } } : {}) },
        _sum: { monto: true },
      });
      const pendiente = Math.max(0, Number(resumen.montoTotalInformado) - Number(pagos._sum.monto ?? 0));
      return Number((-pendiente).toFixed(2));
    }
  }

  const [transacciones, ingresos, transferenciasSalientes, transferenciasEntrantes] =
    await Promise.all([
      prisma.transaccion.findMany({
        where: { cuentaId, estado: EstadoTransaccion.CONFIRMADA, ...(asOf ? { fecha: { lte: asOf } } : {}) },
      }),
      prisma.ingreso.findMany({ where: { cuentaId, ...(asOf ? { fechaCobro: { lte: asOf } } : {}) }, select: { monto: true } }),
      prisma.transferenciaInterna.findMany({
        where: { cuentaOrigenId: cuentaId, ...(asOf ? { fecha: { lte: asOf } } : {}) },
      }),
      prisma.transferenciaInterna.findMany({
        where: { cuentaDestinoId: cuentaId, ...(asOf ? { fecha: { lte: asOf } } : {}) },
      }),
    ]);

  const movimientosSum = transacciones.reduce((acc, t) => {
    return acc + Number(t.monto);
  }, 0);
  const ingresosSum = ingresos.reduce((acc, ingreso) => acc + Number(ingreso.monto), 0);

  const transferenciasSalientesSum = transferenciasSalientes.reduce((acc, t) => {
    return acc + Number(t.monto);
  }, 0);

  const transferenciasEntrantesSum = transferenciasEntrantes.reduce((acc, t) => {
    return acc + Number(t.monto);
  }, 0);

  return (
    Number(cuenta.saldoInicial) +
    movimientosSum + ingresosSum -
    transferenciasSalientesSum +
    transferenciasEntrantesSum
  );
}

export default calcularSaldo;
