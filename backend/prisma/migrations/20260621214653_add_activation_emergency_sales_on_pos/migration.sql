-- AlterTable
ALTER TABLE "PointOfSale" ADD COLUMN     "allowEmergencySales" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emergencyActivatedAt" TIMESTAMP(3),
ADD COLUMN     "emergencyActivatedBy" INTEGER;
