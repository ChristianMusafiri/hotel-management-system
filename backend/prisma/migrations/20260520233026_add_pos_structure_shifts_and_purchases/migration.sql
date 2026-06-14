/*
  Warnings:

  - You are about to drop the column `location` on the `DailyReport` table. All the data in the column will be lost.
  - You are about to drop the column `salePrice` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `Stock` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[productId,posId]` on the table `Stock` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `posId` to the `DailyReport` table without a default value. This is not possible if the table is not empty.
  - Added the required column `posId` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shiftId` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `defaultPurchasePrice` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `defaultSalePrice` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `itemCategory` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `itemMeasure` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `itemUnit` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('OPEN', 'CLOSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MovementType" ADD VALUE 'INTERNAL_PRODUCTION';
ALTER TYPE "MovementType" ADD VALUE 'INTERNAL_STAFF';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'PRINTED';
ALTER TYPE "OrderStatus" ADD VALUE 'LOSS';

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_orderId_fkey";

-- DropIndex
DROP INDEX "DailyReport_date_location_idx";

-- DropIndex
DROP INDEX "Stock_productId_location_key";

-- AlterTable
ALTER TABLE "DailyReport" DROP COLUMN "location",
ADD COLUMN     "posId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Hotel" ADD COLUMN     "isMultiShiftEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "posId" INTEGER NOT NULL,
ADD COLUMN     "shiftId" INTEGER NOT NULL,
ADD COLUMN     "tableName" TEXT,
ALTER COLUMN "totalAmount" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "salePrice",
ADD COLUMN     "defaultPurchasePrice" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "defaultSalePrice" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "image" TEXT,
ADD COLUMN     "isService" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "itemCategory" TEXT NOT NULL,
ADD COLUMN     "itemFamily" TEXT,
ADD COLUMN     "itemGroup" TEXT,
ADD COLUMN     "itemMeasure" TEXT NOT NULL,
ADD COLUMN     "itemOrigin" TEXT,
ADD COLUMN     "itemSupplier" TEXT,
ADD COLUMN     "itemUnit" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Stock" DROP COLUMN "location",
ADD COLUMN     "posId" INTEGER;

-- CreateTable
CREATE TABLE "PointOfSale" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'STANDARD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PointOfSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosMenu" (
    "posId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "salePrice" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PosMenu_pkey" PRIMARY KEY ("posId","productId")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "description" TEXT,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
    "id" SERIAL NOT NULL,
    "recipeId" INTEGER NOT NULL,
    "ingredientId" INTEGER NOT NULL,
    "quantityRequired" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhysicalInventory" (
    "id" SERIAL NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedBy" TEXT NOT NULL,
    "posLocation" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "PhysicalInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryDetail" (
    "id" SERIAL NOT NULL,
    "inventoryId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "theoreticalQuantity" DOUBLE PRECISION NOT NULL,
    "realQuantity" DOUBLE PRECISION NOT NULL,
    "discrepancy" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "InventoryDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosShift" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "initialFloat" DOUBLE PRECISION NOT NULL,
    "expectedAmount" DOUBLE PRECISION,
    "actualAmount" DOUBLE PRECISION,
    "status" "ShiftStatus" NOT NULL DEFAULT 'OPEN',
    "dailyReportId" INTEGER,

    CONSTRAINT "PosShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequest" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedById" INTEGER NOT NULL,
    "posId" INTEGER,

    CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantityOrdered" DOUBLE PRECISION NOT NULL,
    "quantityReceived" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimatedPrice" DOUBLE PRECISION NOT NULL,
    "finalPricePaid" DOUBLE PRECISION,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityGateLog" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedBy" TEXT NOT NULL,
    "gateNotes" TEXT NOT NULL,

    CONSTRAINT "SecurityGateLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PointOfSale_name_key" ON "PointOfSale"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_productId_key" ON "Recipe"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequest_reference_key" ON "PurchaseRequest"("reference");

-- CreateIndex
CREATE INDEX "DailyReport_date_posId_idx" ON "DailyReport"("date", "posId");

-- CreateIndex
CREATE UNIQUE INDEX "Stock_productId_posId_key" ON "Stock"("productId", "posId");

-- AddForeignKey
ALTER TABLE "PosMenu" ADD CONSTRAINT "PosMenu_posId_fkey" FOREIGN KEY ("posId") REFERENCES "PointOfSale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosMenu" ADD CONSTRAINT "PosMenu_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_posId_fkey" FOREIGN KEY ("posId") REFERENCES "PointOfSale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryDetail" ADD CONSTRAINT "InventoryDetail_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "PhysicalInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_posId_fkey" FOREIGN KEY ("posId") REFERENCES "PointOfSale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "PosShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosShift" ADD CONSTRAINT "PosShift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosShift" ADD CONSTRAINT "PosShift_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "DailyReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_posId_fkey" FOREIGN KEY ("posId") REFERENCES "PointOfSale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityGateLog" ADD CONSTRAINT "SecurityGateLog_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PurchaseRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_posId_fkey" FOREIGN KEY ("posId") REFERENCES "PointOfSale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
