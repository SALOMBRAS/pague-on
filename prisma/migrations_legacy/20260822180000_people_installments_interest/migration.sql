ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PARTIAL';
CREATE TYPE "InterestType" AS ENUM ('NONE', 'SIMPLE', 'COMPOUND', 'DAILY', 'FIXED_FEE');

ALTER TABLE "Customer" ADD COLUMN "nickname" TEXT;
ALTER TABLE "Customer" ADD COLUMN "cpfCnpj" TEXT;
ALTER TABLE "Customer" ADD COLUMN "address" TEXT;
ALTER TABLE "Customer" ADD COLUMN "avatar" TEXT;

ALTER TABLE "Sale" ADD COLUMN "interestRate" DECIMAL(7,4) NOT NULL DEFAULT 0;
ALTER TABLE "Sale" ADD COLUMN "interestType" "InterestType" NOT NULL DEFAULT 'NONE';
ALTER TABLE "Sale" ADD COLUMN "paymentType" "PaymentType" NOT NULL DEFAULT 'SINGLE';
ALTER TABLE "Sale" ADD COLUMN "totalInstallments" INTEGER;
ALTER TABLE "Sale" ADD COLUMN "installmentAmount" DECIMAL(12,2);
ALTER TABLE "Sale" ADD COLUMN "frequency" "Frequency";
ALTER TABLE "Sale" ADD COLUMN "firstDueDate" TIMESTAMP(3);
ALTER TABLE "Sale" ADD COLUMN "remainingAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Sale" ADD COLUMN "totalInterest" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Sale" ADD COLUMN "description" TEXT;
UPDATE "Sale" SET "remainingAmount" = GREATEST("totalAmount" - "paidAmount", 0);

ALTER TABLE "Installment" ADD COLUMN "interestAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Installment" ADD COLUMN "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Installment" ADD COLUMN "note" TEXT;
ALTER TABLE "Installment" ADD COLUMN "daysOverdue" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Installment" ADD COLUMN "interestRateAtCreation" DECIMAL(7,4) NOT NULL DEFAULT 0;
ALTER TABLE "Installment" ADD COLUMN "lastReminderSent" TIMESTAMP(3);
ALTER TABLE "Installment" ADD COLUMN "reminderCount" INTEGER NOT NULL DEFAULT 0;
UPDATE "Installment" SET "totalAmount" = "amount";
