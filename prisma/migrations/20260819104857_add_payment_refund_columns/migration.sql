/*
  Warnings:

  - You are about to drop the column `refundedAt` on the `payments` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "payments" DROP COLUMN "refundedAt",
ADD COLUMN     "refundCompletedAt" TIMESTAMP(3),
ADD COLUMN     "refundInitiatedAt" TIMESTAMP(3);
