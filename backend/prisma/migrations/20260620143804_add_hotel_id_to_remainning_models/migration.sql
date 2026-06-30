/*
  Warnings:

  - A unique constraint covering the columns `[hotelId,email]` on the table `Guest` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[hotelId,name]` on the table `PaymentMethod` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[hotelId,productId,posId,expiryDate]` on the table `Stock` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `hotelId` to the `Guest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hotelId` to the `OrderItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hotelId` to the `PosShift` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hotelId` to the `PurchaseOrderItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hotelId` to the `Recipe` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hotelId` to the `RecipeIngredient` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hotelId` to the `SecurityGateLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hotelId` to the `Stock` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Folio_roomId_status_idx";

-- DropIndex
DROP INDEX "Order_status_idx";

-- DropIndex
DROP INDEX "Payment_folioId_idx";

-- DropIndex
DROP INDEX "Product_code_idx";

-- DropIndex
DROP INDEX "Stock_productId_posId_expiryDate_key";

-- DropIndex
DROP INDEX "User_username_idx";

-- AlterTable
ALTER TABLE "Guest" ADD COLUMN     "hotelId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "hotelId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "PaymentMethod" ADD COLUMN     "hotelId" INTEGER;

-- AlterTable
ALTER TABLE "PosShift" ADD COLUMN     "hotelId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "PurchaseOrderItem" ADD COLUMN     "hotelId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "hotelId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "RecipeIngredient" ADD COLUMN     "hotelId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "SecurityGateLog" ADD COLUMN     "hotelId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Stock" ADD COLUMN     "hotelId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "Folio_roomId_status_hotelId_idx" ON "Folio"("roomId", "status", "hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "Guest_hotelId_email_key" ON "Guest"("hotelId", "email");

-- CreateIndex
CREATE INDEX "Order_status_hotelId_idx" ON "Order"("status", "hotelId");

-- CreateIndex
CREATE INDEX "Payment_folioId_hotelId_idx" ON "Payment"("folioId", "hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_hotelId_name_key" ON "PaymentMethod"("hotelId", "name");

-- CreateIndex
CREATE INDEX "Product_code_hotelId_idx" ON "Product"("code", "hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "Stock_hotelId_productId_posId_expiryDate_key" ON "Stock"("hotelId", "productId", "posId", "expiryDate");

-- CreateIndex
CREATE INDEX "User_username_hotelId_idx" ON "User"("username", "hotelId");

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosShift" ADD CONSTRAINT "PosShift_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityGateLog" ADD CONSTRAINT "SecurityGateLog_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
