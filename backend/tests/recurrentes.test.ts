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
  let variableId: string | undefined;
  try {
    const recurrente = await crearRecurrente(prisma, {
      nombre: "Alquiler de prueba",
      tipoMonto: "FIJO",
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

    const variable = await crearRecurrente(prisma, {
      nombre: "Luz variable",
      tipoMonto: "VARIABLE",
      cuentaId: account.id,
      categoriaId: "cat-servicios",
      diaDelMes: 15,
    });
    variableId = variable.id;
    const variableInstance = await generarInstanciaRecurrente(prisma, variable.id, new Date("2026-08-05T00:00:00.000Z"));
    if (variableInstance.monto !== null || !variableInstance.montoEsEstimado) throw new Error("variable projection should have no amount");
    const variableConfirmed = await confirmarInstanciaRecurrente(prisma, variableInstance.id, { monto: "87.50", fecha: "2026-08-16" });
    if (Number(variableConfirmed.monto) !== 87.5 || variableConfirmed.montoEsEstimado || !variableConfirmed.transaccionId) throw new Error("variable confirmation should store the real amount");
    await prisma.gastoRecurrente.update({ where: { id: variable.id }, data: { activo: false } });
    const pausedProjection = await proyectarInstanciasDelPeriodo(prisma, "2026-11");
    if (pausedProjection.some((instance) => instance.gastoRecurrenteId === variable.id)) throw new Error("paused recurring expense should not project");

    console.log("✓ recurrentes fijos y variables: projection, confirmation, idempotency and omission");
  } finally {
    await prisma.transaccion.deleteMany({ where: { comercio: "Alquiler de prueba" } });
    if (recurrenteId) await prisma.instanciaGastoRecurrente.deleteMany({ where: { gastoRecurrenteId: recurrenteId } });
    if (variableId) {
      await prisma.transaccion.deleteMany({ where: { comercio: "Luz variable" } });
      await prisma.instanciaGastoRecurrente.deleteMany({ where: { gastoRecurrenteId: variableId } });
      await prisma.gastoRecurrente.delete({ where: { id: variableId } });
    }
    await prisma.gastoRecurrente.deleteMany({ where: { cuentaId: account.id } });
    await prisma.cuenta.delete({ where: { id: account.id } });
    await prisma.$disconnect();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
