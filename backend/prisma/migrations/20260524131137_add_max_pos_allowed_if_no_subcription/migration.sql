/*
  Warnings:

  - Added the required column `posId` to the `PosShift` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `StockMovement` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'PENDING_ROOMLINK';
ALTER TYPE "OrderStatus" ADD VALUE 'CHARGED_TO_ROOM';

-- AlterTable
ALTER TABLE "Hotel" ADD COLUMN     "maxPosAllowed" INTEGER NOT NULL DEFAULT 2;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "correctedById" INTEGER,
ADD COLUMN     "correctedFromFolioId" INTEGER,
ADD COLUMN     "correctionReason" TEXT;

-- AlterTable
ALTER TABLE "PosShift" ADD COLUMN     "posId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "userId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "PosShift" ADD CONSTRAINT "PosShift_posId_fkey" FOREIGN KEY ("posId") REFERENCES "PointOfSale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
