import { PrismaClient } from "@prisma/client";
import { crearTransaccion } from "../src/services/transaccion";
import { calcularSaldo } from "../src/services/saldo";

async function run() {
  const prisma = new PrismaClient();
  try {
    // Create a test account with saldoInicial 500
    const cuenta = await prisma.cuenta.create({
      data: { nombre: "Cuenta Saldo", tipo: "EFECTIVO", saldoInicial: "500" },
    });

    const key1 = "saldo-key-1-" + Date.now();
    const key2 = "saldo-key-2-" + Date.now();

    await crearTransaccion(prisma, {
      monto: "50",
      cuentaId: cuenta.id,
      categoria: "OTROS",
      origen: "MANUAL",
      idempotencyKey: key1,
    } as any);

    await crearTransaccion(prisma, {
      monto: "-20",
      cuentaId: cuenta.id,
      categoria: "OTROS",
      origen: "MANUAL",
      idempotencyKey: key2,
    } as any);

    const saldo = await calcularSaldo(prisma, cuenta.id);
    console.log("calculated saldo:", saldo);
    if (saldo !== 430) {
      throw new Error("Expected saldo to be saldoInicial + transacciones confirmadas");
    }

    const cuentaAfter = await prisma.cuenta.findUnique({ where: { id: cuenta.id } });
    if (cuentaAfter?.saldoInicial.toString() !== "500") {
      throw new Error("Expected saldoInicial to remain unchanged");
    }
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
