/*
  Warnings:

  - A unique constraint covering the columns `[hotelId,code]` on the table `FundRequest` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[hotelId,reference]` on the table `PurchaseRequest` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[hotelId,username]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[hotelId,email]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "FundRequest_code_key";

-- DropIndex
DROP INDEX "Guest_email_key";

-- DropIndex
DROP INDEX "Order_orderNumber_key";

-- DropIndex
DROP INDEX "PaymentMethod_name_key";

-- DropIndex
DROP INDEX "PurchaseRequest_reference_key";

-- DropIndex
DROP INDEX "StockTransfer_reference_key";

-- DropIndex
DROP INDEX "User_email_key";

-- DropIndex
DROP INDEX "User_username_key";

-- CreateIndex
CREATE UNIQUE INDEX "FundRequest_hotelId_code_key" ON "FundRequest"("hotelId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequest_hotelId_reference_key" ON "PurchaseRequest"("hotelId", "reference");

-- CreateIndex
CREATE INDEX "StockTransfer_hotelId_reference_idx" ON "StockTransfer"("hotelId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "User_hotelId_username_key" ON "User"("hotelId", "username");

-- CreateIndex
CREATE UNIQUE INDEX "User_hotelId_email_key" ON "User"("hotelId", "email");
