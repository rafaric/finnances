import Fastify from "fastify";
import cors from "@fastify/cors";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { crearTransaccion } from "./services/transaccion";
import { z } from "zod";

const app = Fastify({ logger: true });
const prisma = new PrismaClient();

app.register(cors, { origin: true });

app.get("/health", async () => ({ status: "ok" }));

app.post("/transacciones", async (request, reply) => {
  try {
    const body = request.body as any;
    const resultado = await crearTransaccion(prisma, body);
    return reply.code(201).send(resultado);
  } catch (error) {
    request.log.error(error);
    return reply.code(400).send({ error: "Invalid payload or business error" });
  }
});

const GastoSchema = z.object({
  monto: z.string().or(z.number()),
  cuentaId: z.string(),
  categoria: z.string(),
  origen: z.string(),
  idempotencyKey: z.string(),
  fecha: z.string().optional(),
  comercio: z.string().optional(),
  cuotaId: z.string().optional(),
  transferenciaInternaId: z.string().optional(),
});

app.post("/api/v1/gastos", async (request, reply) => {
  try {
    const data = GastoSchema.parse(request.body);
    const resultado = await crearTransaccion(prisma, data as any);
    return reply.code(201).send(resultado);
  } catch (error) {
    request.log.error(error);
    if (error && error.name === "ZodError") {
      return reply.code(400).send({ error: (error as any).errors });
    }
    return reply.code(500).send({ error: "Internal error" });
  }
});

const start = async () => {
  try {
    await app.listen({ port: 4000, host: "0.0.0.0" });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
