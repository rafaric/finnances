import { PrismaClient } from "@prisma/client";
import { crearTransaccion } from "../src/services/transaccion";

async function run() {
  const prisma = new PrismaClient();
  try {
    const key = "test-key-" + Date.now();
    // Create a test account
    const cuenta = await prisma.cuenta.create({
      data: { nombre: "Cuenta Test", tipo: "EFECTIVO", saldoInicial: "0" },
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
    console.log("saldoInicial after:", cuentaAfter?.saldoInicial.toString());
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
