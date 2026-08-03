import { PrismaClient } from "@prisma/client";
import {
  crearTransaccion,
  crearTransaccionOCR,
  corregirTransaccionOCR,
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

    // gasto pendiente no modifica saldo
    const pendienteKey = "test-pendiente-" + Date.now();
    await crearTransaccion(prisma, {
      monto: "50",
      cuentaId: cuenta.id,
      categoria: "OTROS",
      origen: "MANUAL",
      idempotencyKey: pendienteKey,
      estado: "PENDIENTE_REVISION",
    } as any);
    const saldoConPendiente = await calcularSaldo(prisma, cuenta.id);
    if (saldoConPendiente !== 400) {
      throw new Error(`Pending transaction should not affect saldo, got ${saldoConPendiente}`);
    }
    console.log("saldo con pendiente (sin cambio):", saldoConPendiente);

    // corrección OCR confirma y reduce saldo una sola vez
    const ocrKey = "test-ocr-signo-" + Date.now();
    const ocrTx = await crearTransaccionOCR(prisma, {
      textoCrudo: "Comprobante pago $75",  // sin comercio ni categoria inferible → PENDIENTE
      cuentaId: cuenta.id,
      idempotencyKey: ocrKey,
    });
    if (ocrTx.estado === "CONFIRMADA") {
      // si el OCR infirió todo, el saldo ya bajó — verificamos que no baje de nuevo al corregir
      const saldoAntesCor = await calcularSaldo(prisma, cuenta.id);
      await corregirTransaccionOCR(prisma, ocrTx.id, { categoria: "COMIDA", monto: "75" }).catch(() => {});
      const saldoDesp = await calcularSaldo(prisma, cuenta.id);
      if (saldoDesp !== saldoAntesCor) throw new Error("Confirmed OCR re-correction should not change saldo");
    } else {
      const saldoAntesCor = await calcularSaldo(prisma, cuenta.id);
      await corregirTransaccionOCR(prisma, ocrTx.id, { categoria: "COMIDA", monto: "75" });
      const saldoDesp = await calcularSaldo(prisma, cuenta.id);
      if (saldoAntesCor - saldoDesp !== 75) {
        throw new Error(`OCR correction should reduce saldo by 75, got delta ${saldoAntesCor - saldoDesp}`);
      }
      // segunda corrección debe fallar — no duplica
      await corregirTransaccionOCR(prisma, ocrTx.id, { categoria: "COMIDA" }).catch(() => {});
      const saldoTras2 = await calcularSaldo(prisma, cuenta.id);
      if (saldoTras2 !== saldoDesp) throw new Error("Double OCR correction should not change saldo again");
    }
    console.log("saldo tras corrección OCR (una sola vez):", await calcularSaldo(prisma, cuenta.id));

    // reintento idempotente no duplica el gasto
    const saldoAntes = await calcularSaldo(prisma, cuenta.id);
    await crearTransaccion(prisma, input); // mismo key que el primer gasto
    const saldoDespues = await calcularSaldo(prisma, cuenta.id);
    if (saldoAntes !== saldoDespues) {
      throw new Error("Idempotent retry should not change saldo");
    }
    console.log("saldo tras reintento idempotente (sin cambio):", saldoDespues);
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
