ALTER TABLE "Cuenta" ADD COLUMN "cuentaDebitoMinimoId" TEXT;
ALTER TABLE "Cuenta" ADD CONSTRAINT "Cuenta_cuentaDebitoMinimoId_fkey" FOREIGN KEY ("cuentaDebitoMinimoId") REFERENCES "Cuenta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE TYPE "TipoPagoResumen" AS ENUM ('DEBITO_AUTOMATICO', 'MANUAL');
CREATE TABLE "PagoResumen" (
  "id" TEXT NOT NULL,
  "resumenId" TEXT NOT NULL,
  "cuentaOrigenId" TEXT NOT NULL,
  "monto" DECIMAL(10,2) NOT NULL,
  "fecha" TIMESTAMP(3) NOT NULL,
  "tipo" "TipoPagoResumen" NOT NULL,
  "transferenciaId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  CONSTRAINT "PagoResumen_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PagoResumen_transferenciaId_key" ON "PagoResumen"("transferenciaId");
CREATE UNIQUE INDEX "PagoResumen_idempotencyKey_key" ON "PagoResumen"("idempotencyKey");
CREATE INDEX "PagoResumen_resumenId_fecha_idx" ON "PagoResumen"("resumenId", "fecha");
ALTER TABLE "PagoResumen" ADD CONSTRAINT "PagoResumen_resumenId_fkey" FOREIGN KEY ("resumenId") REFERENCES "Resumen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PagoResumen" ADD CONSTRAINT "PagoResumen_cuentaOrigenId_fkey" FOREIGN KEY ("cuentaOrigenId") REFERENCES "Cuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PagoResumen" ADD CONSTRAINT "PagoResumen_transferenciaId_fkey" FOREIGN KEY ("transferenciaId") REFERENCES "TransferenciaInterna"("id") ON DELETE SET NULL ON UPDATE CASCADE;
