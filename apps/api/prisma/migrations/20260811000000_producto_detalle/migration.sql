-- AlterTable
ALTER TABLE "products" ADD COLUMN     "alto_cm" DECIMAL(6,2),
ADD COLUMN     "ancho_cm" DECIMAL(6,2),
ADD COLUMN     "largo_cm" DECIMAL(6,2),
ADD COLUMN     "marca" TEXT,
ADD COLUMN     "material" TEXT,
ADD COLUMN     "medidas" JSONB,
ADD COLUMN     "oferta_fin" TIMESTAMP(3),
ADD COLUMN     "oferta_inicio" TIMESTAMP(3),
ADD COLUMN     "peso_gramos" INTEGER,
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "tipo_prenda" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

