import { PrismaClient } from "@prisma/client";
import {
  confirmarInstanciaRecurrente,
  crearRecurrente,
  generarInstanciaRecurrente,
  omitirInstanciaRecurrente,
  proyectarInstanciasDelPeriodo,
} from "../src/services/recurrente";

const prisma = new PrismaClient();

async function run() {
  const suffix = Date.now();
  const account = await prisma.cuenta.create({
    data: { nombre: `Recurrente Test ${suffix}`, tipo: "EFECTIVO", saldoInicial: "1000" },
  });

  let recurrenteId: string | undefined;
  try {
    const recurrente = await crearRecurrente(prisma, {
      nombre: "Alquiler de prueba",
      montoFijo: "250",
      cuentaId: account.id,
      categoriaId: "cat-renta",
      diaDelMes: 10,
    });
    recurrenteId = recurrente.id;
    if (recurrente.tipoMonto !== "FIJO" || recurrente.frecuencia !== "MENSUAL") throw new Error("recurrente should be fixed monthly");

    const first = await generarInstanciaRecurrente(prisma, recurrente.id, new Date("2026-08-05T00:00:00.000Z"));
    const second = await generarInstanciaRecurrente(prisma, recurrente.id, new Date("2026-08-20T00:00:00.000Z"));
    if (first.id !== second.id || first.estado !== "PROYECTADO") throw new Error("projection must be idempotent for the month");
    const batch = await proyectarInstanciasDelPeriodo(prisma, "2026-10");
    if (batch.length !== 1 || batch[0].gastoRecurrenteId !== recurrente.id) throw new Error("monthly projection should create one instance per active recurring expense");

    const confirmed = await confirmarInstanciaRecurrente(prisma, first.id);
    if (confirmed.estado !== "CONFIRMADO" || !confirmed.transaccionId) throw new Error("confirmation should create a transaction");
    const balanceTransactions = await prisma.transaccion.count({ where: { id: confirmed.transaccionId } });
    if (balanceTransactions !== 1) throw new Error("confirmation should create one transaction");

    await confirmarInstanciaRecurrente(prisma, first.id).catch(() => undefined);
    const transactionCount = await prisma.transaccion.count({ where: { comercio: "Alquiler de prueba" } });
    if (transactionCount !== 1) throw new Error("repeated confirmation should not duplicate the transaction");

    const secondInstance = await generarInstanciaRecurrente(prisma, recurrente.id, new Date("2026-09-05T00:00:00.000Z"));
    const omitted = await omitirInstanciaRecurrente(prisma, secondInstance.id);
    if (omitted?.estado !== "OMITIDO") throw new Error("omission should resolve the instance");

    console.log("✓ recurrente fijo: projection, confirmation idempotency and omission");
  } finally {
    await prisma.transaccion.deleteMany({ where: { comercio: "Alquiler de prueba" } });
    if (recurrenteId) await prisma.instanciaGastoRecurrente.deleteMany({ where: { gastoRecurrenteId: recurrenteId } });
    await prisma.gastoRecurrente.deleteMany({ where: { cuentaId: account.id } });
    await prisma.cuenta.delete({ where: { id: account.id } });
    await prisma.$disconnect();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
