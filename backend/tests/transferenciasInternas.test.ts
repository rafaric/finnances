import { PrismaClient } from "@prisma/client";
import { crearTransferenciaInterna } from "../src/services/transaccion";

async function run() {
  const prisma = new PrismaClient();
  try {
    const origen = await prisma.cuenta.create({
      data: { nombre: "Cuenta Origen", tipo: "EFECTIVO", saldoInicial: "1000" },
    });
    const destino = await prisma.cuenta.create({
      data: { nombre: "Cuenta Destino", tipo: "EFECTIVO", saldoInicial: "200" },
    });

    const transferencia = await crearTransferenciaInterna(prisma, {
      cuentaOrigenId: origen.id,
      cuentaDestinoId: destino.id,
      monto: "150",
      nota: "Pago entre cuentas",
      fecha: "2026-08-02",
      idempotencyKey: "transferencia-interna-1",
    });

    console.log("transferencia created id:", transferencia.id);
    if (transferencia.cuentaId !== origen.id) {
      throw new Error(
        "Expected transferencia transaccion cuentaId to be origen",
      );
    }
    if (transferencia.monto.toString() !== "150") {
      throw new Error("Expected transferencia monto to be 150");
    }

    const origenAfter = await prisma.cuenta.findUnique({
      where: { id: origen.id },
    });
    const destinoAfter = await prisma.cuenta.findUnique({
      where: { id: destino.id },
    });
    if (!origenAfter || !destinoAfter) {
      throw new Error("Expected both accounts to exist after transfer");
    }
    if (origenAfter.saldoInicial.toString() !== "850") {
      throw new Error("Expected origen balance to decrease by 150");
    }
    if (destinoAfter.saldoInicial.toString() !== "350") {
      throw new Error("Expected destino balance to increase by 150");
    }
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
