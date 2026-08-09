CREATE TYPE "EstadoInsight" AS ENUM ('INVALIDADO', 'GENERANDO', 'DISPONIBLE', 'ERROR');

CREATE TABLE "AnalisisInsight" (
    "id" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "estado" "EstadoInsight" NOT NULL DEFAULT 'INVALIDADO',
    "huellaDatos" TEXT,
    "generadoEn" TIMESTAMP(3),
    "invalidadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalisisInsight_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnalisisInsight_periodo_key" ON "AnalisisInsight"("periodo");
