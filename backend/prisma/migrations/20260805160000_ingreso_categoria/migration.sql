-- Add categoriaId and subcategoriaId to Ingreso model, remove concepto
ALTER TABLE "Ingreso" ADD COLUMN "categoriaId" TEXT;
ALTER TABLE "Ingreso" ADD COLUMN "subcategoriaId" TEXT;

-- categoriaId will be set by seed; set default for existing rows
UPDATE "Ingreso" SET "categoriaId" = 'cat-ingresos' WHERE "categoriaId" IS NULL;

ALTER TABLE "Ingreso" ALTER COLUMN "categoriaId" SET NOT NULL;
ALTER TABLE "Ingreso" DROP COLUMN "concepto";

ALTER TABLE "Ingreso"
  ADD CONSTRAINT "Ingreso_categoriaId_fkey"
  FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Ingreso"
  ADD CONSTRAINT "Ingreso_subcategoriaId_fkey"
  FOREIGN KEY ("subcategoriaId") REFERENCES "Subcategoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;
