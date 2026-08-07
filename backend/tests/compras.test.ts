import { PrismaClient } from "@prisma/client";
import { crearCompra } from "../src/services/compra";

async function run() {
  const prisma = new PrismaClient();
  const suffix = Date.now();

  try {
    const tarjeta = await prisma.cuenta.create({
      data: {
        nombre: `Tarjeta Compra Test ${suffix}`,
        tipo: "TARJETA_CREDITO",
        diaCierre: 10,
        diaPago: 6,
        saldoInicial: "0",
      },
    });

    const compra = await crearCompra(prisma, {
      montoTotal: "3000",
      comercio: "Comercio Test",
      fechaCompra: "2026-08-05",
      cantidadCuotas: 3,
      cuentaId: tarjeta.id,
    });

    if (compra.cuotas.length !== 3) throw new Error("expected three cuotas");
    if (compra.cuotas[0].numeroCuota !== 1) throw new Error("first cuota number mismatch");
    if (Number(compra.cuotas[0].monto) !== 1000) throw new Error("cuota amount mismatch");
    if (compra.cuotas[0].fechaImputacion.toISOString() !== "2026-09-06T00:00:00.000Z") throw new Error("first cuota due date mismatch");
    if (compra.cuotas[2].fechaImputacion.toISOString() !== "2026-11-06T00:00:00.000Z") throw new Error("last cuota due date mismatch");

    const cuentaBancaria = await prisma.cuenta.create({
      data: { nombre: `Cuenta Compra Test ${suffix}`, tipo: "CUENTA_BANCARIA", saldoInicial: "0" },
    });

    let rejected = false;
    try {
      await crearCompra(prisma, {
        montoTotal: "100",
        comercio: "No tarjeta",
        fechaCompra: "2026-08-01",
        cantidadCuotas: 1,
        cuentaId: cuentaBancaria.id,
      });
    } catch (error) {
      rejected = error instanceof Error && error.message === "La cuenta debe ser una tarjeta de crédito";
    }
    if (!rejected) throw new Error("non-card account should be rejected");

    console.log("✓ crearCompra projects installments and validates card accounts");
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
