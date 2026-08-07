CREATE UNIQUE INDEX "Cuota_compraId_numeroCuota_key" ON "Cuota"("compraId", "numeroCuota");
CREATE INDEX "Cuota_fechaImputacion_estado_idx" ON "Cuota"("fechaImputacion", "estado");
CREATE UNIQUE INDEX "Resumen_cuentaId_periodo_key" ON "Resumen"("cuentaId", "periodo");
