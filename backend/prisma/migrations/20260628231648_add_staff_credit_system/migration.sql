-- AlterTable
ALTER TABLE "Guest" ADD COLUMN     "validatedAt" TIMESTAMP(3),
ADD COLUMN     "validatedBy" TEXT,
ALTER COLUMN "title" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "staffBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "staffCreditLimit" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3);
