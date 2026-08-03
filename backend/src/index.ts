import { PrismaClient } from "@prisma/client";
import { buildApp } from "./app";

const prisma = new PrismaClient();
const app = buildApp(prisma);

const start = async () => {
  try {
    await app.listen({ port: 4000, host: "0.0.0.0" });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
