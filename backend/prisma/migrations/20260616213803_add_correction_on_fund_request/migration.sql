/*
  Warnings:

  - The values [PENDING_APPROVAL,APPROVED] on the enum `PurchaseStatus` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `hotelId` to the `PurchaseRequest` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FundRequestStatus" AS ENUM ('PENDING_CEO', 'APPROVED', 'DISBURSED', 'REJECTED');

-- AlterEnum
BEGIN;
CREATE TYPE "PurchaseStatus_new" AS ENUM ('PENDING_MGR_REVIEW', 'VERIFIED_REQUISITION', 'IN_FUND_REQUEST', 'READY_FOR_CASH', 'DISBURSED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'REJECTED');
ALTER TABLE "public"."PurchaseRequest" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "PurchaseRequest" ALTER COLUMN "status" TYPE "PurchaseStatus_new" USING ("status"::text::"PurchaseStatus_new");
ALTER TYPE "PurchaseStatus" RENAME TO "PurchaseStatus_old";
ALTER TYPE "PurchaseStatus_new" RENAME TO "PurchaseStatus";
DROP TYPE "public"."PurchaseStatus_old";
ALTER TABLE "PurchaseRequest" ALTER COLUMN "status" SET DEFAULT 'PENDING_MGR_REVIEW';
COMMIT;

-- AlterTable
ALTER TABLE "Hotel" ADD COLUMN     "isBossApprovalRequired" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PurchaseRequest" ADD COLUMN     "fundRequestId" INTEGER,
ADD COLUMN     "hotelId" INTEGER NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'PENDING_MGR_REVIEW';

-- CreateTable
CREATE TABLE "FundRequest" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" "FundRequestStatus" NOT NULL DEFAULT 'PENDING_CEO',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hotelId" INTEGER NOT NULL,

    CONSTRAINT "FundRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FundRequest_code_key" ON "FundRequest"("code");

-- AddForeignKey
ALTER TABLE "FundRequest" ADD CONSTRAINT "FundRequest_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_fundRequestId_fkey" FOREIGN KEY ("fundRequestId") REFERENCES "FundRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
