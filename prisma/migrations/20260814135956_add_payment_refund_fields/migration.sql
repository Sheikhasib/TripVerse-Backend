-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "refundRefId" TEXT,
ADD COLUMN     "refundedAt" TIMESTAMP(3);
