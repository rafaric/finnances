CREATE TYPE "TipoCargoResumen" AS ENUM ('INTERESES', 'IMPUESTOS', 'COMISIONES', 'SEGUROS');
CREATE TYPE "EstadoCargoResumen" AS ENUM ('PENDIENTE', 'CONFIRMADO', 'OMITIDO');
CREATE TABLE "CargoResumen" (
  "id" TEXT NOT NULL,
  "resumenId" TEXT NOT NULL,
  "tipo" "TipoCargoResumen" NOT NULL,
  "monto" DECIMAL(10,2) NOT NULL,
  "estado" "EstadoCargoResumen" NOT NULL DEFAULT 'PENDIENTE',
  "transaccionId" TEXT,
  CONSTRAINT "CargoResumen_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CargoResumen_transaccionId_key" ON "CargoResumen"("transaccionId");
CREATE UNIQUE INDEX "CargoResumen_resumenId_tipo_key" ON "CargoResumen"("resumenId", "tipo");
ALTER TABLE "CargoResumen" ADD CONSTRAINT "CargoResumen_resumenId_fkey" FOREIGN KEY ("resumenId") REFERENCES "Resumen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CargoResumen" ADD CONSTRAINT "CargoResumen_transaccionId_fkey" FOREIGN KEY ("transaccionId") REFERENCES "Transaccion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
