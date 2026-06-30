/*
  Warnings:

  - The values [REQUISITION] on the enum `MovementType` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'DISPATCHED', 'RECEIVED', 'CORRECTION_PENDING', 'CANCELLED');

-- AlterEnum
BEGIN;
CREATE TYPE "MovementType_new" AS ENUM ('SALE', 'TRANSFER', 'RETURN_AFTER_CANCEL', 'PURCHASE', 'INTERNAL_PRODUCTION', 'INTERNAL_STAFF', 'LOSS', 'INVENTORY_ADJUSTMENT', 'MIXED_BATCH_RECONCILIATION');
ALTER TABLE "StockMovement" ALTER COLUMN "type" TYPE "MovementType_new" USING ("type"::text::"MovementType_new");
ALTER TYPE "MovementType" RENAME TO "MovementType_old";
ALTER TYPE "MovementType_new" RENAME TO "MovementType";
DROP TYPE "public"."MovementType_old";
COMMIT;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "costPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "transfertId" INTEGER;

-- CreateTable
CREATE TABLE "StockTransfer" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "productId" INTEGER NOT NULL,
    "quantityRequested" DECIMAL(65,30) NOT NULL,
    "quantityDispatched" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "fromPosId" INTEGER,
    "toPosId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "dispatchedById" INTEGER,
    "receivedById" INTEGER,
    "isCorrectionApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedByAdminId" INTEGER,
    "approvedByStoreId" INTEGER,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "hotelId" INTEGER NOT NULL,

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockTransfer_reference_key" ON "StockTransfer"("reference");

-- CreateIndex
CREATE INDEX "StockTransfer_hotelId_status_idx" ON "StockTransfer"("hotelId", "status");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_transfertId_fkey" FOREIGN KEY ("transfertId") REFERENCES "StockTransfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
