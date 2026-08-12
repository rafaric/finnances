CREATE TABLE "CicloFinanciero" (
    "id" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CicloFinanciero_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CicloFinanciero_periodo_key" ON "CicloFinanciero"("periodo");
CREATE INDEX "CicloFinanciero_inicio_idx" ON "CicloFinanciero"("inicio");

ALTER TABLE "Ingreso" ADD COLUMN "iniciaCicloFinanciero" BOOLEAN NOT NULL DEFAULT false;
