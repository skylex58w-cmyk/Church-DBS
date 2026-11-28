CREATE TABLE "FinanceTransaction" (
  "id" SERIAL NOT NULL,
  "branchId" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "description" TEXT,
  "reference" TEXT,
  "transactionDate" DATE NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "recordedById" INTEGER NOT NULL,
  "approvedById" INTEGER,
  "approvedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinanceTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinanceTransaction_branchId_transactionDate_idx"
  ON "FinanceTransaction"("branchId", "transactionDate");
CREATE INDEX "FinanceTransaction_branchId_status_transactionDate_idx"
  ON "FinanceTransaction"("branchId", "status", "transactionDate");
CREATE INDEX "FinanceTransaction_recordedById_idx"
  ON "FinanceTransaction"("recordedById");
CREATE INDEX "FinanceTransaction_approvedById_idx"
  ON "FinanceTransaction"("approvedById");

ALTER TABLE "FinanceTransaction"
  ADD CONSTRAINT "FinanceTransaction_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction"
  ADD CONSTRAINT "FinanceTransaction_recordedById_fkey"
  FOREIGN KEY ("recordedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction"
  ADD CONSTRAINT "FinanceTransaction_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
