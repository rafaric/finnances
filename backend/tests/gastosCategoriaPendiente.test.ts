import { PrismaClient } from "@prisma/client";
import {
  crearTransaccionOCR,
  resolverCategoriaPendienteTransaccion,
} from "../src/services/transaccion";
import { calcularSaldo } from "../src/services/saldo";

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

    const personTransfer = await crearTransaccionOCR(prisma, {
      textoCrudo: "Transferencia de 250 a Juan Perez, categoria OTROS",
      cuentaId: cuenta.id,
      idempotencyKey: "ocr-person-transfer-" + Date.now(),
      data: {
        monto: 250,
        categoria: "OTROS",
        comercio: "Juan Perez",
        esTransferenciaAPersona: true,
      },
    });
    if (personTransfer.estado !== "PENDIENTE_CATEGORIA" || !personTransfer.esTransferenciaAPersona) {
      throw new Error("Expected person transfer OCR transaction to require category review");
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
    const saldo = await calcularSaldo(prisma, cuenta.id);

    console.log(
      "saldoInicial after resolve:",
      cuentaAfter.saldoInicial.toString(),
    );
    console.log("saldo calculado after resolve:", saldo);
    if (cuentaAfter.saldoInicial.toString() !== "0") {
      throw new Error("Expected saldoInicial to remain immutable after resolve");
    }
    if (saldo !== -100) {
      throw new Error(
        "Expected calculated saldo to include resolved pending category transaction",
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
