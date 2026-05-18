-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID', 'PARTIALLY_PAID');

-- AlterTable
ALTER TABLE "Folio" ADD COLUMN     "isOverTimeWaived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "overtimeWaivedBy" TEXT,
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
ADD COLUMN     "reasonForWaive" TEXT,
ADD COLUMN     "waivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Hotel" ADD COLUMN     "dayUseGracePeriodMins" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "dayUseOvertimeRate" DOUBLE PRECISION NOT NULL DEFAULT 8,
ADD COLUMN     "isOvertimeDayuseFeeEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedBy" TEXT NOT NULL,
    "folioId" INTEGER,
    "paymentMethodId" INTEGER NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_folioId_idx" ON "Payment"("folioId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
