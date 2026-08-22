-- CreateEnum
CREATE TYPE "RefundReasonCategory" AS ENUM ('MEDICAL_EMERGENCY', 'BEREAVEMENT', 'VISA_REJECTION', 'FORCE_MAJEURE', 'CHANGE_OF_PLANS');

-- CreateEnum
CREATE TYPE "RefundRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REFUNDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'REFUND_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'REFUND_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'REFUND_REJECTED';

-- CreateTable
CREATE TABLE "refund_requests" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "RefundReasonCategory" NOT NULL,
    "reason" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "daysBeforeTravel" INTEGER NOT NULL,
    "suggestedPercentage" INTEGER NOT NULL,
    "status" "RefundRequestStatus" NOT NULL DEFAULT 'PENDING',
    "approvedPercentage" INTEGER,
    "refundAmount" DECIMAL(10,2),
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refund_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "refund_requests_bookingId_idx" ON "refund_requests"("bookingId");

-- CreateIndex
CREATE INDEX "refund_requests_userId_idx" ON "refund_requests"("userId");

-- CreateIndex
CREATE INDEX "refund_requests_status_createdAt_idx" ON "refund_requests"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
