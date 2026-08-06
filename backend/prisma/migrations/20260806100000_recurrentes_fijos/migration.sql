CREATE UNIQUE INDEX "InstanciaGastoRecurrente_gastoRecurrenteId_fechaVencimiento_key"
ON "InstanciaGastoRecurrente"("gastoRecurrenteId", "fechaVencimiento");

CREATE INDEX "GastoRecurrente_activo_cuentaId_idx"
ON "GastoRecurrente"("activo", "cuentaId");

CREATE INDEX "InstanciaGastoRecurrente_estado_fechaVencimiento_idx"
ON "InstanciaGastoRecurrente"("estado", "fechaVencimiento");
