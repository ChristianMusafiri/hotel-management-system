/*
  Warnings:

  - You are about to drop the column `creditStauts` on the `Guest` table. All the data in the column will be lost.
  - You are about to drop the column `lasReminderAt` on the `Guest` table. All the data in the column will be lost.
  - Added the required column `LastName` to the `Guest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `firstName` to the `Guest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `Guest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Guest" DROP COLUMN "creditStauts",
DROP COLUMN "lasReminderAt",
ADD COLUMN     "LastName" TEXT NOT NULL,
ADD COLUMN     "address" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "creditStatus" "GuestStatus" NOT NULL DEFAULT 'GOOD',
ADD COLUMN     "dateOfExpiry" TIMESTAMP(3),
ADD COLUMN     "dateOfIssue" TIMESTAMP(3),
ADD COLUMN     "dob" TIMESTAMP(3),
ADD COLUMN     "firstName" TEXT NOT NULL,
ADD COLUMN     "lastReminderAt" TIMESTAMP(3),
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "placeOfIssue" TEXT,
ADD COLUMN     "title" TEXT NOT NULL;
