CREATE TYPE "BankTransactionStatus" AS ENUM ('PENDING', 'MATCHED', 'CONFIRMED', 'IGNORED', 'CREATED');

CREATE TABLE "BankStatement" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "fileName" TEXT NOT NULL,
  "accountName" TEXT,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BankStatement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BankTransaction" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "statementId" UUID NOT NULL,
  "externalId" TEXT,
  "fingerprint" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "balance" DECIMAL(12,2),
  "status" "BankTransactionStatus" NOT NULL DEFAULT 'PENDING',
  "matchedDebtId" UUID,
  "matchConfidence" INTEGER,
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BankTransaction_userId_fingerprint_key" ON "BankTransaction"("userId", "fingerprint");
CREATE INDEX "BankStatement_userId_importedAt_idx" ON "BankStatement"("userId", "importedAt");
CREATE INDEX "BankTransaction_userId_statementId_status_idx" ON "BankTransaction"("userId", "statementId", "status");
CREATE INDEX "BankTransaction_matchedDebtId_idx" ON "BankTransaction"("matchedDebtId");

ALTER TABLE "BankStatement" ADD CONSTRAINT "BankStatement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "BankStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_matchedDebtId_fkey" FOREIGN KEY ("matchedDebtId") REFERENCES "Debt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
