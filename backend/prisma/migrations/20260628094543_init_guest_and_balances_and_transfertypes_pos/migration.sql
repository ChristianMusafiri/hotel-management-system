-- CreateEnum
CREATE TYPE "TransferType" AS ENUM ('STANDARD', 'INTER_POS');

-- CreateEnum
CREATE TYPE "GuestStatus" AS ENUM ('GOOD', 'SUSPENDED', 'DEBTOR', 'VIP');

-- CreateEnum
CREATE TYPE "PortalStatus" AS ENUM ('INACTIVE', 'PENDING_VALIDATION', 'ACTIVE', 'SUSPENDED');

-- AlterTable
ALTER TABLE "Guest" ADD COLUMN     "accountBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "collerctorId" INTEGER,
ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "contractNumber" TEXT,
ADD COLUMN     "creditStauts" "GuestStatus" NOT NULL DEFAULT 'GOOD',
ADD COLUMN     "idCardNumber" TEXT,
ADD COLUMN     "isMatchPerfect" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lasReminderAt" TIMESTAMP(3),
ADD COLUMN     "paymentPromiseDate" TIMESTAMP(3),
ADD COLUMN     "portalStatus" "PortalStatus" NOT NULL DEFAULT 'INACTIVE';

-- AlterTable
ALTER TABLE "StockTransfer" ADD COLUMN     "type" "TransferType" NOT NULL DEFAULT 'STANDARD';
