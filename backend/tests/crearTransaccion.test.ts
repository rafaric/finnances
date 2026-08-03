import { PrismaClient } from "@prisma/client";
import {
  crearTransaccion,
  normalizarMontoGasto,
} from "../src/services/transaccion";
import { calcularSaldo } from "../src/services/saldo";

async function run() {
  const prisma = new PrismaClient();
  try {
    if (normalizarMontoGasto("150") !== "-150.00") {
      throw new Error("Expected positive expense input to normalize to -150.00");
    }
    if (normalizarMontoGasto("-150") !== "-150.00") {
      throw new Error("Expected negative expense input to remain negative");
    }
    if (normalizarMontoGasto("1.234,56") !== "-1234.56") {
      throw new Error("Expected Argentine amount format to normalize correctly");
    }
    try {
      normalizarMontoGasto("0");
      throw new Error("Expected zero expense input to be rejected");
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "Monto inválido") {
        throw error;
      }
    }

    const key = "test-key-" + Date.now();
    // Create a test account
    const cuenta = await prisma.cuenta.create({
      data: { nombre: "Cuenta Test", tipo: "EFECTIVO", saldoInicial: "500" },
    });

    const input = {
      monto: "100",
      cuentaId: cuenta.id,
      categoria: "OTROS",
      origen: "MANUAL",
      idempotencyKey: key,
    } as any;

    const first = await crearTransaccion(prisma, input);
    const second = await crearTransaccion(prisma, input);

    console.log("first id:", first.id);
    console.log("second id:", second.id);
    console.log("idempotent equal:", first.id === second.id);

    const cuentaAfter = await prisma.cuenta.findUnique({
      where: { id: cuenta.id },
    });
    const saldo = await calcularSaldo(prisma, cuenta.id);
    console.log("saldoInicial after:", cuentaAfter?.saldoInicial.toString());
    console.log("saldo calculado:", saldo);

    if (cuentaAfter?.saldoInicial.toString() !== "500") {
      throw new Error("Expected saldoInicial to remain immutable");
    }
    if (first.monto.toString() !== "-100") {
      throw new Error("Expected expense monto to be persisted as negative");
    }
    if (saldo !== 400) {
      throw new Error("Expected calculated saldo to reflect the transaction");
    }
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
