import Fastify from "fastify";
import cors from "@fastify/cors";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { crearTransaccion } from "./services/transaccion";

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

const start = async () => {
  try {
    await app.listen({ port: 4000, host: "0.0.0.0" });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
