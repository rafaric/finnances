import { PrismaClient } from "@prisma/client";
import { crearResumenOCR } from "../src/services/transaccion";

async function run() {
  const prisma = new PrismaClient();
  try {
    const cuenta = await prisma.cuenta.create({
      data: {
        nombre: "Cuenta Resumen Test",
        tipo: "EFECTIVO",
        saldoInicial: "0",
      },
    });

    const texto = `Resumen tarjeta\nPeriodo: 2026-08\nMonto total informado: $ 1234.56\nMonto minimo informado: $ 123.45\nTotal consumos: $ 10.00`;

    const resumen = await crearResumenOCR(prisma, {
      textoCrudo: texto,
      cuentaId: cuenta.id,
      idempotencyKey: "resumen-1",
    } as any);

    console.log("resumen created id:", resumen.id);

    if (!resumen || !resumen.id) throw new Error("Resumen no creado");
    if (resumen.cuentaId !== cuenta.id)
      throw new Error("Resumen cuentaId mismatch");
    if (resumen.montoTotalInformado.toString() !== "1234.56")
      throw new Error("Monto total incorrecto");
    if (resumen.montoMinimoInformado.toString() !== "123.45")
      throw new Error("Monto minimo incorrecto");
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
