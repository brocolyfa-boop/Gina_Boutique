-- DropIndex
DROP INDEX "orders_numero_key";

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "numero",
ADD COLUMN     "secuencia" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "orders_secuencia_key" ON "orders"("secuencia");

