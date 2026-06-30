/*
  Warnings:

  - A unique constraint covering the columns `[hotelId,name]` on the table `Category` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[hotelId,name]` on the table `PointOfSale` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[hotelId,code]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[hotelId,number]` on the table `Room` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `hotelId` to the `Category` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hotelId` to the `DailyReport` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hotelId` to the `Folio` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hotelId` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hotelId` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hotelId` to the `PhysicalInventory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hotelId` to the `PointOfSale` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hotelId` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hotelId` to the `Room` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hotelId` to the `StockMovement` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Category_name_key";

-- DropIndex
DROP INDEX "DailyReport_date_posId_idx";

-- DropIndex
DROP INDEX "Order_orderNumber_idx";

-- DropIndex
DROP INDEX "PointOfSale_name_key";

-- DropIndex
DROP INDEX "Product_code_key";

-- DropIndex
DROP INDEX "Room_number_key";

-- DropIndex
DROP INDEX "StockMovement_productId_createdAt_idx";

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "hotelId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "DailyReport" ADD COLUMN     "hotelId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Folio" ADD COLUMN     "hotelId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "hotelId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "hotelId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "PhysicalInventory" ADD COLUMN     "hotelId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "PointOfSale" ADD COLUMN     "hotelId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "hotelId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "hotelId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "hotelId" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Category_hotelId_name_key" ON "Category"("hotelId", "name");

-- CreateIndex
CREATE INDEX "DailyReport_date_hotelId_posId_idx" ON "DailyReport"("date", "hotelId", "posId");

-- CreateIndex
CREATE INDEX "Order_hotelId_orderNumber_idx" ON "Order"("hotelId", "orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PointOfSale_hotelId_name_key" ON "PointOfSale"("hotelId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_hotelId_code_key" ON "Product"("hotelId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Room_hotelId_number_key" ON "Room"("hotelId", "number");

-- CreateIndex
CREATE INDEX "StockMovement_hotelId_productId_createdAt_idx" ON "StockMovement"("hotelId", "productId", "createdAt");

-- AddForeignKey
ALTER TABLE "PointOfSale" ADD CONSTRAINT "PointOfSale_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhysicalInventory" ADD CONSTRAINT "PhysicalInventory_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folio" ADD CONSTRAINT "Folio_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
