import { PrismaClient } from "@prisma/client";
import { crearCompra } from "../src/services/compra";
import { registrarDebitosAutomaticos } from "../src/services/pagoResumen";

async function run() {
  const prisma = new PrismaClient();
  const suffix = Date.now();
  try {
    const nbch = await prisma.cuenta.create({ data: { nombre: `NBCH Sueldo ${suffix}`, tipo: "CUENTA_BANCARIA", saldoInicial: "1000" } });
    const tarjeta = await prisma.cuenta.create({ data: { nombre: `Tarjeta Pago ${suffix}`, tipo: "TARJETA_CREDITO", saldoInicial: "0", diaCierre: 20, diaPago: 6, cuentaDebitoMinimoId: nbch.id } });
    const categoria = await prisma.categoria.findFirst({ where: { tipo: "GASTO" } });
    if (!categoria) throw new Error("test category missing");
    const compra = await crearCompra(prisma, { montoTotal: "900", comercio: "Compra pago", fechaCompra: "2026-07-10", cantidadCuotas: 1, cuentaId: tarjeta.id, categoriaId: categoria.id });
    const resumen = await prisma.resumen.create({ data: { cuentaId: tarjeta.id, periodo: "2026-08", montoTotalInformado: "900", montoMinimoInformado: "100", estado: "PENDIENTE" } });

    const first = await registrarDebitosAutomaticos(prisma, nbch.id, "2026-08-31", `sueldo-${suffix}`);
    const second = await registrarDebitosAutomaticos(prisma, nbch.id, "2026-08-31", `sueldo-${suffix}`);
    const payments = await prisma.pagoResumen.findMany({ where: { resumenId: resumen.id } });
    const cuota = await prisma.cuota.findUnique({ where: { id: compra.cuotas[0].id } });

    if (first.length !== 1 || second.length !== 0 || payments.length !== 1) throw new Error("automatic debit is not idempotent");
    if (Number(payments[0].monto) !== 100) throw new Error("minimum payment mismatch");
    if (cuota?.estado !== "CONFIRMADO" || !cuota.transaccionId) throw new Error("quota was not confirmed");
    console.log("✓ automatic minimum debit is scoped and idempotent");
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((error: unknown) => { console.error(error); process.exit(1); });
