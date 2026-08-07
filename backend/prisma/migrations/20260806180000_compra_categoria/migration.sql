ALTER TABLE "Compra" ADD COLUMN "categoriaId" TEXT;
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;
