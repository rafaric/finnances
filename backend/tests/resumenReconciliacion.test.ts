import { PrismaClient } from "@prisma/client";
import { crearCompra } from "../src/services/compra";
import { crearResumenDesdeGemini } from "../src/services/resumen";
import { listarCargosResumen, resolverCargoResumen } from "../src/services/cargoResumen";

async function run() {
  const prisma = new PrismaClient();
  const suffix = Date.now();
  try {
    const cuenta = await prisma.cuenta.create({
      data: { nombre: `Tarjeta Reconciliacion ${suffix}`, tipo: "TARJETA_CREDITO", diaCierre: 20, saldoInicial: "0" },
    });
    await crearCompra(prisma, { montoTotal: "1000", comercio: "Compra conocida", fechaCompra: "2026-07-05", cantidadCuotas: 1, cuentaId: cuenta.id });

    const resumen = await crearResumenDesdeGemini(prisma, cuenta.id, {
      consumos: [{ fecha: "2026-08-05", comercio: "Compra conocida", monto: 1000, cuotaActual: 1, cuotasTotales: 1 }],
      entidad: null,
      ultimosDigitos: null,
      periodo: "2026-08",
      montoTotal: 1100,
      montoMinimo: 100,
      totalConsumos: 1000,
      saldoFinanciado: 0,
      intereses: 100,
      impuestos: null,
      comisiones: null,
      seguros: null,
      ivaIntereses: null,
      ivaComisiones: null,
      ivaImpuestos: null,
      impuestoSello: null,
      confianza: 0.9,
    });

    if (resumen.estadoConciliacion !== "COINCIDE") throw new Error("matching summary should reconcile");
    if (Number(resumen.diferenciaConciliacion) !== 0) throw new Error("reconciliation difference should be zero");
    if (Number(resumen.interesesInformados) !== 100) throw new Error("interest should be persisted");
    const cargos = await listarCargosResumen(prisma, resumen.id);
    if (cargos.length !== 1 || cargos[0].tipo !== "INTERESES") throw new Error("interest charge should be pending");
    const resolved = await resolverCargoResumen(prisma, cargos[0].id, { estado: "CONFIRMADO" });
    if (resolved.estado !== "CONFIRMADO" || !resolved.transaccionId) throw new Error("interest charge should create a transaction");
    const transaction = await prisma.transaccion.findUnique({ where: { id: resolved.transaccionId } });
    if (transaction?.origen !== "RESUMEN_CONFIRMADO" || Number(transaction.monto) !== -100) throw new Error("charge transaction mismatch");
    console.log("✓ summary persistence reconciles against projected installments");
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
