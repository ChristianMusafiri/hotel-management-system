/*
  Warnings:

  - You are about to drop the column `transfertId` on the `StockMovement` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_transfertId_fkey";

-- AlterTable
ALTER TABLE "StockMovement" DROP COLUMN "transfertId",
ADD COLUMN     "transferId" INTEGER;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
