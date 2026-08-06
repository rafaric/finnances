ALTER TABLE "Ingreso" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "Ingreso" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "Ingreso" SET "idempotencyKey" = 'legacy-ingreso-' || "id" WHERE "idempotencyKey" IS NULL;
ALTER TABLE "Ingreso" ALTER COLUMN "idempotencyKey" SET NOT NULL;
CREATE UNIQUE INDEX "Ingreso_idempotencyKey_key" ON "Ingreso"("idempotencyKey");
