/*
  Warnings:

  - You are about to alter the column `totalCollected` on the `DailyReport` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `totalBill` on the `Folio` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `totalAmount` on the `FundRequest` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `currencyExchangeRate` on the `Hotel` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `taxeRate` on the `Hotel` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `dayUseOvertimeRate` on the `Hotel` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `theoreticalQuantity` on the `InventoryDetail` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `realQuantity` on the `InventoryDetail` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `discrepancy` on the `InventoryDetail` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `totalAmount` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `discountAmount` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `price` on the `OrderItem` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `amount` on the `Payment` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `salePrice` on the `PosMenu` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `customPrice` on the `PosMenu` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `initialFloat` on the `PosShift` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `expectedAmount` on the `PosShift` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `actualAmount` on the `PosShift` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `defaultPurchasePrice` on the `Product` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `defaultSalePrice` on the `Product` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `quantityOrdered` on the `PurchaseOrderItem` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `quantityReceived` on the `PurchaseOrderItem` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `estimatedPrice` on the `PurchaseOrderItem` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `finalPricePaid` on the `PurchaseOrderItem` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `quantityRequired` on the `RecipeIngredient` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `price` on the `Room` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - A unique constraint covering the columns `[productId,posId,expiryDate]` on the table `Stock` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MovementType" ADD VALUE 'TRANSFER';
ALTER TYPE "MovementType" ADD VALUE 'INVENTORY_ADJUSTMENT';
ALTER TYPE "MovementType" ADD VALUE 'MIXED_BATCH_RECONCILIATION';

-- DropIndex
DROP INDEX "Stock_productId_posId_key";

-- AlterTable
ALTER TABLE "DailyReport" ALTER COLUMN "totalCollected" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "Folio" ALTER COLUMN "totalBill" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "FundRequest" ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "Hotel" ALTER COLUMN "currencyExchangeRate" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "taxeRate" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "dayUseOvertimeRate" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "InventoryDetail" ALTER COLUMN "theoreticalQuantity" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "realQuantity" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "discrepancy" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "discountAmount" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "OrderItem" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "price" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "PosMenu" ALTER COLUMN "salePrice" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "customPrice" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "PosShift" ALTER COLUMN "initialFloat" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "expectedAmount" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "actualAmount" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "defaultPurchasePrice" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "defaultSalePrice" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "PurchaseOrderItem" ALTER COLUMN "quantityOrdered" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "quantityReceived" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "estimatedPrice" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "finalPricePaid" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "RecipeIngredient" ALTER COLUMN "quantityRequired" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "Room" ALTER COLUMN "price" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "Stock" ADD COLUMN     "expiryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "quantity" SET DEFAULT 0,
ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "StockMovement" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(65,30);

-- CreateTable
CREATE TABLE "StockBatch" (
    "id" SERIAL NOT NULL,
    "stockId" INTEGER NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Stock_productId_posId_expiryDate_key" ON "Stock"("productId", "posId", "expiryDate");

-- AddForeignKey
ALTER TABLE "StockBatch" ADD CONSTRAINT "StockBatch_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
