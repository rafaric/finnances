import { PrismaClient, Transaccion } from "@prisma/client";
import { z } from "zod";

const TransaccionSchema = z.object({
  monto: z.string().or(z.number()),
  cuentaId: z.string(),
  categoria: z.string(),
  origen: z.string(),
  idempotencyKey: z.string(),
  fecha: z.string().optional(),
  comercio: z.string().optional(),
});

export type CrearTransaccionInput = z.infer<typeof TransaccionSchema>;

export async function crearTransaccion(
  prisma: PrismaClient,
  input: CrearTransaccionInput,
): Promise<Transaccion> {
  const data = TransaccionSchema.parse(input);

  // Check idempotency: if a transaction with the same key exists, return it
  const existing = await prisma.transaccion.findUnique({
    where: { idempotencyKey: data.idempotencyKey },
  });
  if (existing) return existing as Transaccion;

  // Create the transaction record
  const created = await prisma.transaccion.create({
    data: {
      monto: typeof data.monto === "string" ? data.monto : String(data.monto),
      moneda: "ARS",
      origen: data.origen as any,
      cuentaId: data.cuentaId,
      categoria: data.categoria as any,
      idempotencyKey: data.idempotencyKey,
      comercio: data.comercio,
      fecha: data.fecha ? new Date(data.fecha) : new Date(),
    },
  });

  // NOTE: business rules for updating account balances, cuotas, transfers
  // and related side-effects should be implemented here.

  return created as Transaccion;
}
