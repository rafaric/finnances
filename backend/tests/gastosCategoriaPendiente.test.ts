import { PrismaClient } from "@prisma/client";
import {
  crearTransaccionOCR,
  resolverCategoriaPendienteTransaccion,
} from "../src/services/transaccion";

async function run() {
  const prisma = new PrismaClient();
  try {
    const cuenta = await prisma.cuenta.create({
      data: {
        nombre: "Cuenta OCR Categoria",
        tipo: "EFECTIVO",
        saldoInicial: "0",
      },
    });

    const key = "ocr-cat-key-" + Date.now();
    const pending = await crearTransaccionOCR(prisma, {
      textoCrudo: "100, comprobante 9876, comercio no identificado",
      cuentaId: cuenta.id,
      idempotencyKey: key,
    });

    console.log("pending estado:", pending.estado);
    console.log("pending monto:", pending.monto.toString());

    if (pending.estado !== "PENDIENTE_CATEGORIA") {
      throw new Error("Expected OCR transaction to be PENDIENTE_CATEGORIA");
    }

    const resolved = await resolverCategoriaPendienteTransaccion(
      prisma,
      pending.id,
      {
        categoria: "COMIDA",
        comercio: "Kiosco",
      },
    );

    console.log("resolved estado:", resolved.estado);
    console.log("resolved categoria:", resolved.categoria);

    if (resolved.estado !== "CONFIRMADA") {
      throw new Error("Expected resolved transaction to be CONFIRMADA");
    }
    if (resolved.categoria !== "COMIDA") {
      throw new Error("Expected resolved transaction categoria to be COMIDA");
    }

    const cuentaAfter = await prisma.cuenta.findUnique({
      where: { id: cuenta.id },
    });
    if (!cuentaAfter) throw new Error("Expected account to exist");

    console.log(
      "saldoInicial after resolve:",
      cuentaAfter.saldoInicial.toString(),
    );
    if (cuentaAfter.saldoInicial.toString() !== "100") {
      throw new Error(
        "Expected account saldoInicial to update after resolving category",
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
