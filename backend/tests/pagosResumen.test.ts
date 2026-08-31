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
     const resumen = await prisma.resumen.create({ data: { cuentaId: tarjeta.id, periodo: "2026-08", fechaCierre: new Date("2026-07-20"), fechaVencimiento: new Date("2026-08-06"), montoTotalInformado: "900", montoMinimoInformado: "100", estado: "PENDIENTE" } });

     const first = await registrarDebitosAutomaticos(prisma, nbch.id, "2026-08-05", `sueldo-${suffix}`);
     const second = await registrarDebitosAutomaticos(prisma, nbch.id, "2026-08-05", `sueldo-${suffix}`);
    const payments = await prisma.pagoResumen.findMany({ where: { resumenId: resumen.id } });
    const cuota = await prisma.cuota.findUnique({ where: { id: compra.cuotas[0].id } });

    if (first.length !== 1 || second.length !== 0 || payments.length !== 1) throw new Error("automatic debit is not idempotent");
     if (Number(payments[0].monto) !== 100) throw new Error("minimum payment mismatch");
     if (cuota?.estado !== "PROYECTADO" || cuota.transaccionId) throw new Error("minimum payment should not confirm quota");

     const futureSummary = await prisma.resumen.create({ data: { cuentaId: tarjeta.id, periodo: "2026-09", fechaCierre: new Date("2026-08-20"), fechaVencimiento: new Date("2026-09-06"), montoTotalInformado: "500", montoMinimoInformado: "200", estado: "PENDIENTE" } });
     const skipped = await registrarDebitosAutomaticos(prisma, nbch.id, "2026-08-05", `future-${suffix}`);
     if (skipped.length !== 0 || await prisma.pagoResumen.count({ where: { resumenId: futureSummary.id } })) throw new Error("future summary was debited before closing");
     console.log("✓ automatic minimum debit is scoped, idempotent and does not confirm quotas");
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((error: unknown) => { console.error(error); process.exit(1); });
