import { PrismaClient } from "@prisma/client";
import { crearTransferenciaInterna } from "../src/services/transaccion";
import { calcularSaldo } from "../src/services/saldo";

async function run() {
  const prisma = new PrismaClient();
  try {
    const origen = await prisma.cuenta.create({
      data: { nombre: "Cuenta Origen", tipo: "EFECTIVO", saldoInicial: "1000" },
    });
    const destino = await prisma.cuenta.create({
      data: { nombre: "Cuenta Destino", tipo: "EFECTIVO", saldoInicial: "200" },
    });

    const idempotencyKey = `transferencia-interna-1-${Date.now()}`;
    const transferencia = await crearTransferenciaInterna(prisma, {
      cuentaOrigenId: origen.id,
      cuentaDestinoId: destino.id,
      monto: "150",
      nota: "Pago entre cuentas",
      fecha: "2026-08-02",
      idempotencyKey,
    });

    console.log("transferencia created id:", transferencia.id);
    if (transferencia.cuentaOrigenId !== origen.id) {
      throw new Error(
        "Expected transferencia cuentaOrigenId to match origen",
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
    const [saldoOrigen, saldoDestino] = await Promise.all([
      calcularSaldo(prisma, origen.id),
      calcularSaldo(prisma, destino.id),
    ]);
    const transacciones = await prisma.transaccion.findMany({
      where: { idempotencyKey },
    });

    if (origenAfter.saldoInicial.toString() !== "1000") {
      throw new Error("Expected origen saldoInicial to remain unchanged");
    }
    if (destinoAfter.saldoInicial.toString() !== "200") {
      throw new Error("Expected destino saldoInicial to remain unchanged");
    }
    if (saldoOrigen !== 850) {
      throw new Error("Expected calculated origen saldo to decrease by 150");
    }
    if (saldoDestino !== 350) {
      throw new Error("Expected calculated destino saldo to increase by 150");
    }
    if (transacciones.length !== 0) {
      throw new Error("Expected internal transfers to avoid creating Transaccion records");
    }
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
