ALTER TABLE "Transaccion" DROP CONSTRAINT "Transaccion_transferenciaFondeoId_fkey";

DROP INDEX "Transaccion_transferenciaFondeoId_key";

ALTER TABLE "TransferenciaInterna" ADD COLUMN "idempotencyKey" TEXT;

UPDATE "TransferenciaInterna"
SET "idempotencyKey" = 'legacy-transfer-' || "id"
WHERE "idempotencyKey" IS NULL;

ALTER TABLE "TransferenciaInterna" ALTER COLUMN "idempotencyKey" SET NOT NULL;

CREATE UNIQUE INDEX "TransferenciaInterna_idempotencyKey_key" ON "TransferenciaInterna"("idempotencyKey");

ALTER TABLE "Transaccion" DROP COLUMN "transferenciaFondeoId";
