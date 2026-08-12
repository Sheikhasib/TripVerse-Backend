-- CreateIndex
CREATE INDEX "bookings_userId_packageId_travelDate_idx" ON "bookings"("userId", "packageId", "travelDate");
