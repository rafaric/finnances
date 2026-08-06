/* 1. Create new enums */
CREATE TYPE "TipoCategoria" AS ENUM ('GASTO', 'INGRESO');
CREATE TYPE "IconoCategoria" AS ENUM (
  'UTENSILIOS_COCINA', 'CARRO', 'CASA', 'LLAVE', 'TELEFONO',
  'CORAZON', 'OCULOS', 'SUPER', 'GIMNASIO', 'LIBROS', 'AVION', 'OTRO'
);
CREATE TYPE "ColorCategoria" AS ENUM (
  'ROJO', 'NARANJA', 'AMARILLO', 'VERDE', 'AZUL',
  'INDIGO', 'VIOLETA', 'ROSA', 'PEZ', 'TURQUESA', 'BLANCO', 'NEGRO'
);

/* 2. Create temporary Categoria table (will rename after dropping old enum) */
CREATE TABLE "_Categoria_new" (
  "id" TEXT NOT NULL,
  "nombre" VARCHAR(30) NOT NULL,
  "icono" "IconoCategoria" NOT NULL,
  "color" "ColorCategoria" NOT NULL,
  "tipo" "TipoCategoria" NOT NULL,
  "activa" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "_Categoria_new_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "_Categoria_new_nombre_tipo_key" ON "_Categoria_new"("nombre", "tipo");

/* 3. Seed: create Categoria records from old enum values */
INSERT INTO "_Categoria_new" ("id", "nombre", "icono", "color", "tipo", "activa", "createdAt", "updatedAt")
VALUES
  ('cat-comida', 'Comida', 'SUPER', 'NARANJA', 'GASTO', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat-transporte', 'Transporte', 'CARRO', 'AZUL', 'GASTO', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat-vivienda', 'Vivienda', 'CASA', 'VERDE', 'GASTO', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat-servicios', 'Servicios', 'TELEFONO', 'INDIGO', 'GASTO', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat-ocio', 'Ocio', 'OCULOS', 'VIOLETA', 'GASTO', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat-deudas', 'Deudas', 'CORAZON', 'ROJO', 'GASTO', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat-otros', 'Otros', 'OTRO', 'NEGRO', 'GASTO', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat-ingresos', 'Ingresos', 'LIBROS', 'VERDE', 'INGRESO', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

/* 4. Add categoriaId to Transaccion (nullable temporarily) */
ALTER TABLE "Transaccion" ADD COLUMN "categoriaId" TEXT;

/* 5. Migrate Transaccion.categoria enum values to categoriaId */
UPDATE "Transaccion" SET "categoriaId" = 'cat-comida' WHERE "categoria" = 'COMIDA';
UPDATE "Transaccion" SET "categoriaId" = 'cat-transporte' WHERE "categoria" = 'TRANSPORTE';
UPDATE "Transaccion" SET "categoriaId" = 'cat-vivienda' WHERE "categoria" = 'VIVIENDA';
UPDATE "Transaccion" SET "categoriaId" = 'cat-servicios' WHERE "categoria" = 'SERVICIOS';
UPDATE "Transaccion" SET "categoriaId" = 'cat-ocio' WHERE "categoria" = 'OCIO';
UPDATE "Transaccion" SET "categoriaId" = 'cat-deudas' WHERE "categoria" = 'DEUDAS';
UPDATE "Transaccion" SET "categoriaId" = 'cat-otros' WHERE "categoria" = 'OTROS';

/* 6. Add categoriaId to GastoRecurrente (nullable temporarily) */
ALTER TABLE "GastoRecurrente" ADD COLUMN "categoriaId" TEXT;

/* 7. Migrate GastoRecurrente.categoria enum values to categoriaId */
UPDATE "GastoRecurrente" SET "categoriaId" = 'cat-comida' WHERE "categoria" = 'COMIDA';
UPDATE "GastoRecurrente" SET "categoriaId" = 'cat-transporte' WHERE "categoria" = 'TRANSPORTE';
UPDATE "GastoRecurrente" SET "categoriaId" = 'cat-vivienda' WHERE "categoria" = 'VIVIENDA';
UPDATE "GastoRecurrente" SET "categoriaId" = 'cat-servicios' WHERE "categoria" = 'SERVICIOS';
UPDATE "GastoRecurrente" SET "categoriaId" = 'cat-ocio' WHERE "categoria" = 'OCIO';
UPDATE "GastoRecurrente" SET "categoriaId" = 'cat-deudas' WHERE "categoria" = 'DEUDAS';
UPDATE "GastoRecurrente" SET "categoriaId" = 'cat-otros' WHERE "categoria" = 'OTROS';

/* 8. Add categoriaId to ContactoCategoria (nullable temporarily) */
ALTER TABLE "ContactoCategoria" ADD COLUMN "categoriaId" TEXT;

/* 9. Migrate ContactoCategoria.categoria enum values to categoriaId */
UPDATE "ContactoCategoria" SET "categoriaId" = 'cat-comida' WHERE "categoria" = 'COMIDA';
UPDATE "ContactoCategoria" SET "categoriaId" = 'cat-transporte' WHERE "categoria" = 'TRANSPORTE';
UPDATE "ContactoCategoria" SET "categoriaId" = 'cat-vivienda' WHERE "categoria" = 'VIVIENDA';
UPDATE "ContactoCategoria" SET "categoriaId" = 'cat-servicios' WHERE "categoria" = 'SERVICIOS';
UPDATE "ContactoCategoria" SET "categoriaId" = 'cat-ocio' WHERE "categoria" = 'OCIO';
UPDATE "ContactoCategoria" SET "categoriaId" = 'cat-deudas' WHERE "categoria" = 'DEUDAS';
UPDATE "ContactoCategoria" SET "categoriaId" = 'cat-otros' WHERE "categoria" = 'OTROS';

/* 10. Migrate Subcategoria: rename categoria column to categoriaId and change type */
ALTER TABLE "Subcategoria" RENAME COLUMN "categoria" TO "categoriaId";
ALTER TABLE "Subcategoria" ALTER COLUMN "categoriaId" TYPE TEXT USING "categoriaId"::TEXT;

/* 11. Migrate Subcategoria categoriaId from old enum values to new IDs */
UPDATE "Subcategoria" SET "categoriaId" =
  CASE "categoriaId"
    WHEN 'COMIDA' THEN 'cat-comida'
    WHEN 'TRANSPORTE' THEN 'cat-transporte'
    WHEN 'VIVIENDA' THEN 'cat-vivienda'
    WHEN 'SERVICIOS' THEN 'cat-servicios'
    WHEN 'OCIO' THEN 'cat-ocio'
    WHEN 'DEUDAS' THEN 'cat-deudas'
    WHEN 'OTROS' THEN 'cat-otros'
    ELSE 'cat-otros'
  END;

/* 12. Remove old categoria column from Transaccion */
ALTER TABLE "Transaccion" DROP COLUMN "categoria";

/* 13. Remove old categoria column from GastoRecurrente */
ALTER TABLE "GastoRecurrente" DROP COLUMN "categoria";

/* 14. Remove old categoria column from ContactoCategoria */
ALTER TABLE "ContactoCategoria" DROP COLUMN "categoria";

/* 15. Drop the old Categoria enum type */
DROP TYPE "Categoria";

/* 16. Rename _Categoria_new to Categoria */
ALTER TABLE "_Categoria_new" RENAME TO "Categoria";
ALTER INDEX "_Categoria_new_pkey" RENAME TO "Categoria_pkey";
ALTER INDEX "_Categoria_new_nombre_tipo_key" RENAME TO "Categoria_nombre_tipo_key";

/* 17. Set categoriaId NOT NULL on all tables */
ALTER TABLE "Transaccion" ALTER COLUMN "categoriaId" SET NOT NULL;
ALTER TABLE "GastoRecurrente" ALTER COLUMN "categoriaId" SET NOT NULL;
ALTER TABLE "ContactoCategoria" ALTER COLUMN "categoriaId" SET NOT NULL;
ALTER TABLE "Subcategoria" ALTER COLUMN "categoriaId" SET NOT NULL;

/* 18. Add foreign key constraints */
ALTER TABLE "Transaccion"
  ADD CONSTRAINT "Transaccion_categoriaId_fkey"
  FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GastoRecurrente"
  ADD CONSTRAINT "GastoRecurrente_categoriaId_fkey"
  FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ContactoCategoria"
  ADD CONSTRAINT "ContactoCategoria_categoriaId_fkey"
  FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Subcategoria"
  ADD CONSTRAINT "Subcategoria_categoriaId_fkey"
  FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

/* 19. Add nombre length constraint to Subcategoria */
ALTER TABLE "Subcategoria" ALTER COLUMN "nombre" TYPE VARCHAR(30);

/* 20. Create unique index on Subcategoria (categoriaId, nombre) */
CREATE UNIQUE INDEX "Subcategoria_categoriaId_nombre_key" ON "Subcategoria"("categoriaId", "nombre");
