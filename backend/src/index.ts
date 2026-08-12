import { PrismaClient } from "@prisma/client";
import { buildApp } from "./app";
import "dotenv/config";

const prisma = new PrismaClient();
const app = buildApp(prisma);

const start = async () => {
  try {
    const port = Number(process.env.PORT ?? 4000);
    await app.listen({ port, host: "0.0.0.0" });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
