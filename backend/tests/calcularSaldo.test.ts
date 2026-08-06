import { PrismaClient } from "@prisma/client";
import { crearTransaccion, crearTransferenciaInterna } from "../src/services/transaccion";
import { calcularSaldo } from "../src/services/saldo";

async function run() {
  const prisma = new PrismaClient();
  try {
    const ts = Date.now();

    // ── 1. saldoInicial inmutable, gastos confirmados reducen saldo ───────────
    const cuenta = await prisma.cuenta.create({
      data: { nombre: "Cuenta Saldo", tipo: "EFECTIVO", saldoInicial: "500" },
    });

    await crearTransaccion(prisma, {
      monto: "50", cuentaId: cuenta.id, categoriaId: "cat-otros",
      origen: "MANUAL", idempotencyKey: `saldo-1-${ts}`,
    } as any);
    await crearTransaccion(prisma, {
      monto: "20", cuentaId: cuenta.id, categoriaId: "cat-otros",
      origen: "MANUAL", idempotencyKey: `saldo-2-${ts}`,
    } as any);

    const saldo = await calcularSaldo(prisma, cuenta.id);
    if (saldo !== 430) throw new Error(`Expected 430, got ${saldo}`);

    const cuentaAfter = await prisma.cuenta.findUnique({ where: { id: cuenta.id } });
    if (cuentaAfter?.saldoInicial.toString() !== "500")
      throw new Error("saldoInicial must remain immutable");
    console.log("✓ gastos confirmados reducen saldo, saldoInicial inmutable");

    // ── 2. gasto pendiente no modifica saldo ──────────────────────────────────
    await crearTransaccion(prisma, {
      monto: "100", cuentaId: cuenta.id, categoriaId: "cat-otros",
      origen: "MANUAL", idempotencyKey: `saldo-pendiente-${ts}`,
      estado: "PENDIENTE_REVISION",
    } as any);
    const saldoConPendiente = await calcularSaldo(prisma, cuenta.id);
    if (saldoConPendiente !== 430)
      throw new Error(`Pending tx must not affect saldo, got ${saldoConPendiente}`);
    console.log("✓ gasto pendiente no modifica saldo");

    // ── 3. transferencia reduce origen y aumenta destino ─────────────────────
    const cuentaB = await prisma.cuenta.create({
      data: { nombre: "Cuenta B", tipo: "EFECTIVO", saldoInicial: "0" },
    });

    await crearTransferenciaInterna(prisma, {
      cuentaOrigenId: cuenta.id,
      cuentaDestinoId: cuentaB.id,
      monto: "100",
      idempotencyKey: `saldo-transf-${ts}`,
    });

    const saldoOrigenTrasTransf = await calcularSaldo(prisma, cuenta.id);
    const saldoDestinoTrasTransf = await calcularSaldo(prisma, cuentaB.id);

    if (saldoOrigenTrasTransf !== 330)
      throw new Error(`Origen should be 330, got ${saldoOrigenTrasTransf}`);
    if (saldoDestinoTrasTransf !== 100)
      throw new Error(`Destino should be 100, got ${saldoDestinoTrasTransf}`);
    console.log("✓ transferencia reduce origen y aumenta destino");

    // ── 4. transferencia no aparece como transaccion ──────────────────────────
    const txs = await prisma.transaccion.findMany({ where: { cuentaId: cuenta.id } });
    const hayTransferenciaComoTx = txs.some(t => t.comercio === "Transferencia interna");
    if (hayTransferenciaComoTx)
      throw new Error("Transferencia must not create a Transaccion row");
    console.log("✓ transferencia no crea Transaccion");

    // ── 5. cuenta inexistente lanza error ─────────────────────────────────────
    try {
      await calcularSaldo(prisma, "nonexistent-id");
      throw new Error("Should have thrown for nonexistent cuenta");
    } catch (e) {
      if (!(e instanceof Error) || e.message !== "Cuenta no encontrada")
        throw e;
    }
    console.log("✓ cuenta inexistente lanza error");

    console.log("\nAll calcularSaldo tests passed ✓");
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
