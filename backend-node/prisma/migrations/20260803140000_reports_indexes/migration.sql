-- CreateIndex
CREATE INDEX "Rental_actualReturnDate_idx" ON "Rental"("actualReturnDate");

-- CreateIndex
CREATE INDEX "FinancialTransaction_status_type_createdAt_idx" ON "FinancialTransaction"("status", "type", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_completedAt_idx" ON "Payment"("completedAt");

-- CreateIndex
CREATE INDEX "Payment_status_completedAt_idx" ON "Payment"("status", "completedAt");
