import { PrismaClient } from "@prisma/client";
import { crearCompra } from "../src/services/compra";
import { registrarDebitosAutomaticos } from "../src/services/pagoResumen";
import { sumarPagosElegibles } from "../src/services/pagosResumenElegibles";

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

      const consecutivePrevious = await prisma.resumen.create({ data: { cuentaId: tarjeta.id, periodo: "2026-10", fechaCierre: new Date("2026-09-20"), fechaVencimiento: new Date("2026-10-06"), montoTotalInformado: "600", montoMinimoInformado: "250", estado: "PENDIENTE" } });
      const consecutiveNext = await prisma.resumen.create({ data: { cuentaId: tarjeta.id, periodo: "2026-11", fechaCierre: new Date("2026-10-20"), fechaVencimiento: new Date("2026-11-06"), montoTotalInformado: "700", montoMinimoInformado: "300", estado: "PENDIENTE" } });
      await prisma.pagoResumen.create({ data: { resumenId: consecutivePrevious.id, cuentaOrigenId: nbch.id, monto: "250", fecha: new Date("2026-10-01"), tipo: "MANUAL", idempotencyKey: `manual-${suffix}` } });
      const consecutivePayments = await registrarDebitosAutomaticos(prisma, nbch.id, "2026-10-25", `consecutive-${suffix}`);
      if (consecutivePayments.length !== 1 || consecutivePayments[0].resumenId !== consecutiveNext.id || Number(consecutivePayments[0].monto) !== 300) throw new Error("previous summary payment leaked into next minimum");

      const noDates = await prisma.resumen.create({ data: { cuentaId: tarjeta.id, periodo: "2026-12", montoTotalInformado: "400", montoMinimoInformado: "150", estado: "PENDIENTE" } });
     const noDatesPayments = await registrarDebitosAutomaticos(prisma, nbch.id, "2026-12-01", `no-dates-${suffix}`);
      if (noDatesPayments.some((payment) => payment.resumenId === noDates.id)) throw new Error("summary without dates was selected");
      if (sumarPagosElegibles([
        { fecha: new Date("2026-08-31"), monto: "90" },
        { fecha: new Date("2026-09-30"), monto: "40" },
      ], new Date("2026-09-01")) !== 40) throw new Error("payment before closing date was included");
      if (sumarPagosElegibles([{ fecha: new Date("2026-09-30"), monto: "40" }], null) !== 0) throw new Error("summary without closing date invented a payment window");
      console.log("✓ automatic minimum debit is time-scoped, idempotent and does not confirm quotas");
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((error: unknown) => { console.error(error); process.exit(1); });
