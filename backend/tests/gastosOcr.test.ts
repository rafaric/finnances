import { PrismaClient } from "@prisma/client";
import {
  crearTransaccionOCR,
  corregirTransaccionOCR,
} from "../src/services/transaccion";
import { calcularSaldo } from "../src/services/saldo";

async function run() {
  const prisma = new PrismaClient();
  try {
    const cuenta = await prisma.cuenta.create({
      data: { nombre: "Cuenta OCR Test", tipo: "EFECTIVO", saldoInicial: "0" },
    });

    const key1 = "ocr-key-1-" + Date.now();
    const key2 = "ocr-key-2-" + Date.now();

    const confirmed = await crearTransaccionOCR(prisma, {
      textoCrudo:
        "monto: 150.00, categoria: COMIDA, comercio: La Pizzeria, fecha: 2026-08-02",
      cuentaId: cuenta.id,
      idempotencyKey: key1,
    });

    console.log("confirmed estado:", confirmed.estado);
    console.log("confirmed monto:", confirmed.monto.toString());

    const pending = await crearTransaccionOCR(prisma, {
      textoCrudo: "200, comprobante 1234, local comercial",
      cuentaId: cuenta.id,
      idempotencyKey: key2,
    });

    console.log("pending estado:", pending.estado);
    console.log("pending monto:", pending.monto.toString());

    if (confirmed.estado !== "CONFIRMADA") {
      throw new Error("Expected first OCR transaction to be CONFIRMADA");
    }
    if (pending.estado !== "PENDIENTE_CATEGORIA") {
      throw new Error(
        "Expected second OCR transaction to be PENDIENTE_CATEGORIA",
      );
    }

    const corrected = await corregirTransaccionOCR(prisma, pending.id, {
      categoria: "COMIDA",
      comercio: "Supermercado",
    });

    console.log("corrected estado:", corrected.estado);
    console.log("corrected monto:", corrected.monto.toString());

    if (corrected.estado !== "CONFIRMADA") {
      throw new Error("Expected corrected OCR transaction to be CONFIRMADA");
    }
    if (corrected.monto.toString() !== "200") {
      throw new Error("Expected corrected OCR transaction monto to be 200");
    }

    const cuentaAfter = await prisma.cuenta.findUnique({
      where: { id: cuenta.id },
    });
    const saldo = await calcularSaldo(prisma, cuenta.id);
    console.log(
      "saldoInicial after correction:",
      cuentaAfter?.saldoInicial.toString(),
    );
    console.log("saldo calculado after correction:", saldo);
    if (cuentaAfter?.saldoInicial.toString() !== "0") {
      throw new Error("Expected saldoInicial to remain immutable after OCR flow");
    }
    if (saldo !== 350) {
      throw new Error(
        "Expected calculated saldo to reflect confirmed and corrected OCR transactions",
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
