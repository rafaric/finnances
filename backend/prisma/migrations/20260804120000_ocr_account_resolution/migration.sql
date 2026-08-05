ALTER TABLE "Cuenta" ADD COLUMN "nombreEntidad" TEXT;
CREATE UNIQUE INDEX "Cuenta_nombreEntidad_key" ON "Cuenta"("nombreEntidad");
ALTER TABLE "Transaccion" ALTER COLUMN "cuentaId" DROP NOT NULL;
