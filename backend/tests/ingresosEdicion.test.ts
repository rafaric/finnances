import { editarIngreso } from "../src/services/ingreso";
import type { PrismaClient } from "@prisma/client";

async function main() {
  await expectRejected({ monto: "0" }, "Monto inválido");
  await expectRejected({ monto: "-10" }, "Monto inválido");
  console.log("✓ edición de ingresos rechaza montos no positivos");
}

async function expectRejected(input: { monto: string }, code: string) {
  try {
    await editarIngreso({} as PrismaClient, "income-id", input);
    throw new Error("expected editarIngreso to reject");
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes(code)) throw error;
  }
}

void main();
