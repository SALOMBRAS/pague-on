CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO');
CREATE TYPE "DebtType" AS ENUM ('RECEIVABLE', 'PAYABLE');
CREATE TYPE "PaymentType" AS ENUM ('SINGLE', 'INSTALLMENT', 'RECURRING');
CREATE TYPE "DebtCategory" AS ENUM ('PRODUCT', 'SERVICE', 'LOAN', 'RENT', 'SUBSCRIPTION', 'TRANSPORT', 'UTILITIES', 'OTHER');
CREATE TYPE "DebtStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'PARTIAL', 'CANCELLED');
CREATE TYPE "Frequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE');
CREATE TYPE "InterestType" AS ENUM ('NONE', 'SIMPLE', 'COMPOUND', 'DAILY', 'FIXED_FEE');
CREATE TYPE "ReminderType" AS ENUM ('PUSH', 'WHATSAPP', 'SMS');
CREATE TYPE "ReminderStatus" AS ENUM ('SCHEDULED', 'SENT', 'FAILED', 'CANCELLED');
CREATE TYPE "NotificationType" AS ENUM ('DEBT_DUE', 'DEBT_OVERDUE', 'PAYMENT_RECEIVED', 'STOCK_LOW', 'BUDGET_ALERT', 'BUDGET_EXCEEDED', 'GOAL_REACHED', 'WEEKLY_DIGEST', 'MONTHLY_DIGEST', 'RULE_APPLIED', 'SYSTEM');
CREATE TYPE "RuleTriggerLogic" AS ENUM ('ALL', 'ANY');
CREATE TYPE "RuleTriggerType" AS ENUM ('DESCRIPTION_CONTAINS', 'DESCRIPTION_STARTS_WITH', 'DESCRIPTION_IS', 'AMOUNT_EXACTLY', 'AMOUNT_GREATER_THAN', 'AMOUNT_LESS_THAN', 'COUNTERPARTY_IS', 'COUNTERPARTY_CONTAINS', 'CATEGORY_IS', 'TYPE_IS');
CREATE TYPE "RuleOperator" AS ENUM ('EQUALS', 'CONTAINS', 'STARTS_WITH', 'GREATER_THAN', 'LESS_THAN');
CREATE TYPE "RuleActionType" AS ENUM ('SET_CATEGORY', 'SET_TYPE', 'SET_PAYMENT_TYPE', 'ADD_TAG', 'SET_REMINDER', 'SEND_NOTIFICATION', 'SET_COUNTERPARTY');
CREATE TYPE "SecurityChallengeType" AS ENUM ('REGISTRATION', 'AUTHENTICATION');
CREATE TYPE "AssetType" AS ENUM ('CASH', 'INVESTMENT_STOCK', 'INVESTMENT_CRYPTO', 'INVESTMENT_FIXED', 'PROPERTY', 'VEHICLE', 'OTHER');
CREATE TYPE "BankTransactionStatus" AS ENUM ('PENDING', 'MATCHED', 'CONFIRMED', 'IGNORED', 'CREATED');
CREATE TYPE "SaleStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'CANCELLED');

CREATE TABLE "User" (
  "id" UUID NOT NULL, "name" TEXT NOT NULL, "email" TEXT NOT NULL, "password" TEXT NOT NULL, "avatar" TEXT, "phone" TEXT,
  "plan" "Plan" NOT NULL DEFAULT 'FREE', "currency" TEXT NOT NULL DEFAULT 'BRL', "theme" TEXT NOT NULL DEFAULT 'dark', "notificationEnabled" BOOLEAN NOT NULL DEFAULT true, "reminderDefaultTime" INTEGER DEFAULT 1440,
  "dueReminderDays" INTEGER NOT NULL DEFAULT 3, "budgetAlerts" BOOLEAN NOT NULL DEFAULT true, "stockAlerts" BOOLEAN NOT NULL DEFAULT true, "weeklyDigest" BOOLEAN NOT NULL DEFAULT true, "monthlyDigest" BOOLEAN NOT NULL DEFAULT false, "notificationSound" TEXT NOT NULL DEFAULT 'DEFAULT',
  "defaultMessage" TEXT, "duplicateSensitivity" INTEGER NOT NULL DEFAULT 70, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Product" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "name" TEXT NOT NULL, "category" TEXT, "costPrice" DECIMAL(12,2) NOT NULL, "sellingPrice" DECIMAL(12,2) NOT NULL, "profitMargin" DECIMAL(7,2) NOT NULL, "stockQuantity" INTEGER NOT NULL DEFAULT 0, "minStockAlert" INTEGER DEFAULT 5,
  "image" TEXT, "description" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Customer" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "name" TEXT NOT NULL, "nickname" TEXT, "phone" TEXT, "email" TEXT, "cpfCnpj" TEXT, "address" TEXT, "avatar" TEXT, "notes" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Sale" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "customerId" UUID, "totalAmount" DECIMAL(12,2) NOT NULL, "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0, "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "interestRate" DECIMAL(7,4) NOT NULL DEFAULT 0, "interestType" "InterestType" NOT NULL DEFAULT 'NONE', "paymentType" "PaymentType" NOT NULL DEFAULT 'SINGLE', "totalInstallments" INTEGER, "installmentAmount" DECIMAL(12,2), "frequency" "Frequency", "firstDueDate" TIMESTAMP(3), "remainingAmount" DECIMAL(12,2) NOT NULL DEFAULT 0, "totalInterest" DECIMAL(12,2) NOT NULL DEFAULT 0, "description" TEXT,
  "status" "SaleStatus" NOT NULL DEFAULT 'PENDING', "notes" TEXT, "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Debt" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "type" "DebtType" NOT NULL, "paymentType" "PaymentType" NOT NULL, "description" TEXT NOT NULL, "category" "DebtCategory" NOT NULL, "counterparty" TEXT NOT NULL, "counterpartyPhone" TEXT, "customerId" UUID, "saleId" UUID,
  "totalAmount" DECIMAL(12,2) NOT NULL, "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL', "originalAmount" DECIMAL(12,2), "exchangeRate" DECIMAL(16,8) NOT NULL DEFAULT 1, "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0, "installmentAmount" DECIMAL(12,2), "totalInstallments" INTEGER, "paidInstallments" INTEGER NOT NULL DEFAULT 0, "frequency" "Frequency", "startDate" TIMESTAMP(3) NOT NULL, "dueDate" TIMESTAMP(3) NOT NULL, "endDate" TIMESTAMP(3), "repeatCount" INTEGER, "status" "DebtStatus" NOT NULL DEFAULT 'PENDING', "isActive" BOOLEAN NOT NULL DEFAULT true, "paidAt" TIMESTAMP(3), "productId" UUID, "quantity" INTEGER, "tags" TEXT[] DEFAULT ARRAY[]::TEXT[], "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Installment" (
  "id" UUID NOT NULL, "debtId" UUID NOT NULL, "number" INTEGER NOT NULL, "amount" DECIMAL(12,2) NOT NULL, "interestAmount" DECIMAL(12,2) NOT NULL DEFAULT 0, "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0, "dueDate" TIMESTAMP(3) NOT NULL, "paidAt" TIMESTAMP(3), "paidAmount" DECIMAL(12,2), "paymentMethod" TEXT, "note" TEXT, "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING', "daysOverdue" INTEGER NOT NULL DEFAULT 0, "interestRateAtCreation" DECIMAL(7,4) NOT NULL DEFAULT 0, "lastReminderSent" TIMESTAMP(3), "reminderCount" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Installment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "RecurringPayment" (
  "id" UUID NOT NULL, "debtId" UUID NOT NULL, "period" TEXT NOT NULL, "dueDate" TIMESTAMP(3) NOT NULL, "paidAt" TIMESTAMP(3), "amount" DECIMAL(12,2), "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecurringPayment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SaleItem" (
  "id" UUID NOT NULL, "saleId" UUID NOT NULL, "productId" UUID NOT NULL, "name" TEXT NOT NULL, "quantity" INTEGER NOT NULL, "unitPrice" DECIMAL(12,2) NOT NULL, "unitCost" DECIMAL(12,2) NOT NULL, "total" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Purchase" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "productId" UUID NOT NULL, "quantity" INTEGER NOT NULL, "unitCost" DECIMAL(12,2) NOT NULL, "totalCost" DECIMAL(12,2) NOT NULL, "supplier" TEXT, "date" TIMESTAMP(3) NOT NULL, "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Reminder" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "debtId" UUID, "type" "ReminderType" NOT NULL DEFAULT 'PUSH', "scheduledAt" TIMESTAMP(3) NOT NULL, "sentAt" TIMESTAMP(3), "message" TEXT, "status" "ReminderStatus" NOT NULL DEFAULT 'SCHEDULED', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Notification" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "title" TEXT NOT NULL, "body" TEXT NOT NULL, "type" "NotificationType" NOT NULL, "read" BOOLEAN NOT NULL DEFAULT false, "data" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PushSubscription" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "endpoint" TEXT NOT NULL, "p256dh" TEXT NOT NULL, "auth" TEXT NOT NULL, "expirationTime" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CashFlow" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "date" DATE NOT NULL, "totalIn" DECIMAL(12,2) NOT NULL DEFAULT 0, "totalOut" DECIMAL(12,2) NOT NULL DEFAULT 0, "balance" DECIMAL(12,2) NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashFlow_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Rule" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "name" TEXT NOT NULL, "order" INTEGER NOT NULL DEFAULT 0, "isActive" BOOLEAN NOT NULL DEFAULT true, "triggerLogic" "RuleTriggerLogic" NOT NULL DEFAULT 'ALL', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Rule_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "RuleTrigger" ("id" UUID NOT NULL, "ruleId" UUID NOT NULL, "type" "RuleTriggerType" NOT NULL, "value" TEXT NOT NULL, "operator" "RuleOperator" NOT NULL DEFAULT 'EQUALS', CONSTRAINT "RuleTrigger_pkey" PRIMARY KEY ("id"));
CREATE TABLE "RuleAction" ("id" UUID NOT NULL, "ruleId" UUID NOT NULL, "type" "RuleActionType" NOT NULL, "value" TEXT NOT NULL, CONSTRAINT "RuleAction_pkey" PRIMARY KEY ("id"));
CREATE TABLE "RuleExecution" ("id" UUID NOT NULL, "userId" UUID NOT NULL, "ruleId" UUID NOT NULL, "debtId" UUID, "actionsApplied" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "RuleExecution_pkey" PRIMARY KEY ("id"));
CREATE TABLE "UserSecurity" ("id" UUID NOT NULL, "userId" UUID NOT NULL, "biometricEnabled" BOOLEAN NOT NULL DEFAULT false, "pinHash" TEXT, "pinSalt" TEXT, "lockTimeout" INTEGER NOT NULL DEFAULT 5, "hideValues" BOOLEAN NOT NULL DEFAULT false, "pinAttempts" INTEGER NOT NULL DEFAULT 0, "pinLockedUntil" TIMESTAMP(3), "webauthnChallenge" TEXT, "challengeType" "SecurityChallengeType", "challengeExpiresAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "UserSecurity_pkey" PRIMARY KEY ("id"));
CREATE TABLE "WebAuthnCredential" ("id" UUID NOT NULL, "userId" UUID NOT NULL, "credentialId" TEXT NOT NULL, "publicKey" BYTEA NOT NULL, "counter" BIGINT NOT NULL DEFAULT 0, "transports" TEXT[] DEFAULT ARRAY[]::TEXT[], "deviceType" TEXT, "backedUp" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lastUsedAt" TIMESTAMP(3), CONSTRAINT "WebAuthnCredential_pkey" PRIMARY KEY ("id"));
CREATE TABLE "BackupSnapshot" ("id" UUID NOT NULL, "userId" UUID NOT NULL, "version" TEXT NOT NULL, "exportedAt" TIMESTAMP(3) NOT NULL, "sizeBytes" INTEGER NOT NULL, "iv" TEXT NOT NULL, "authTag" TEXT NOT NULL, "ciphertext" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "BackupSnapshot_pkey" PRIMARY KEY ("id"));
CREATE TABLE "Asset" ("id" UUID NOT NULL, "userId" UUID NOT NULL, "name" TEXT NOT NULL, "type" "AssetType" NOT NULL, "value" DECIMAL(12,2) NOT NULL, "currency" TEXT NOT NULL DEFAULT 'BRL', "isLiquid" BOOLEAN NOT NULL DEFAULT true, "description" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Asset_pkey" PRIMARY KEY ("id"));
CREATE TABLE "NetWorthSnapshot" ("id" UUID NOT NULL, "userId" UUID NOT NULL, "date" DATE NOT NULL, "netWorth" DECIMAL(12,2) NOT NULL, "totalAssets" DECIMAL(12,2) NOT NULL, "liabilities" DECIMAL(12,2) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "NetWorthSnapshot_pkey" PRIMARY KEY ("id"));
CREATE TABLE "BankStatement" ("id" UUID NOT NULL, "userId" UUID NOT NULL, "fileName" TEXT NOT NULL, "accountName" TEXT, "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "BankStatement_pkey" PRIMARY KEY ("id"));
CREATE TABLE "BankTransaction" ("id" UUID NOT NULL, "userId" UUID NOT NULL, "statementId" UUID NOT NULL, "externalId" TEXT, "fingerprint" TEXT NOT NULL, "date" DATE NOT NULL, "description" TEXT NOT NULL, "amount" DECIMAL(12,2) NOT NULL, "balance" DECIMAL(12,2), "status" "BankTransactionStatus" NOT NULL DEFAULT 'PENDING', "matchedDebtId" UUID, "matchConfidence" INTEGER, "confirmedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id"));
CREATE TABLE "Budget" ("id" UUID NOT NULL, "userId" UUID NOT NULL, "category" "DebtCategory" NOT NULL, "month" INTEGER NOT NULL, "year" INTEGER NOT NULL, "limitAmount" DECIMAL(12,2) NOT NULL, "spentAmount" DECIMAL(12,2) NOT NULL DEFAULT 0, "rollover" BOOLEAN NOT NULL DEFAULT false, "alertAt" INTEGER NOT NULL DEFAULT 80, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Budget_pkey" PRIMARY KEY ("id"));
CREATE TABLE "Currency" ("code" VARCHAR(3) NOT NULL, "name" TEXT NOT NULL, "symbol" TEXT NOT NULL, "rateToBRL" DECIMAL(16,8) NOT NULL DEFAULT 1, "updatedAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Currency_pkey" PRIMARY KEY ("code"));

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Debt_saleId_key" ON "Debt"("saleId");
CREATE INDEX "Debt_userId_status_dueDate_idx" ON "Debt"("userId", "status", "dueDate");
CREATE INDEX "Debt_productId_idx" ON "Debt"("productId");
CREATE INDEX "Debt_customerId_idx" ON "Debt"("customerId");
CREATE UNIQUE INDEX "Installment_debtId_number_key" ON "Installment"("debtId", "number");
CREATE INDEX "Installment_debtId_status_dueDate_idx" ON "Installment"("debtId", "status", "dueDate");
CREATE UNIQUE INDEX "RecurringPayment_debtId_period_key" ON "RecurringPayment"("debtId", "period");
CREATE INDEX "RecurringPayment_debtId_status_dueDate_idx" ON "RecurringPayment"("debtId", "status", "dueDate");
CREATE INDEX "Product_userId_isActive_idx" ON "Product"("userId", "isActive");
CREATE INDEX "Customer_userId_isActive_name_idx" ON "Customer"("userId", "isActive", "name");
CREATE INDEX "Sale_userId_soldAt_idx" ON "Sale"("userId", "soldAt"); CREATE INDEX "Sale_customerId_idx" ON "Sale"("customerId");
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId"); CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");
CREATE INDEX "Purchase_userId_date_idx" ON "Purchase"("userId", "date"); CREATE INDEX "Purchase_productId_idx" ON "Purchase"("productId");
CREATE INDEX "Reminder_userId_status_scheduledAt_idx" ON "Reminder"("userId", "status", "scheduledAt");
CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint"); CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");
CREATE UNIQUE INDEX "CashFlow_userId_date_key" ON "CashFlow"("userId", "date"); CREATE INDEX "CashFlow_userId_date_idx" ON "CashFlow"("userId", "date");
CREATE INDEX "Rule_userId_isActive_order_idx" ON "Rule"("userId", "isActive", "order"); CREATE INDEX "RuleTrigger_ruleId_idx" ON "RuleTrigger"("ruleId"); CREATE INDEX "RuleAction_ruleId_idx" ON "RuleAction"("ruleId"); CREATE INDEX "RuleExecution_userId_createdAt_idx" ON "RuleExecution"("userId", "createdAt"); CREATE INDEX "RuleExecution_debtId_idx" ON "RuleExecution"("debtId");
CREATE UNIQUE INDEX "UserSecurity_userId_key" ON "UserSecurity"("userId"); CREATE UNIQUE INDEX "WebAuthnCredential_credentialId_key" ON "WebAuthnCredential"("credentialId"); CREATE INDEX "WebAuthnCredential_userId_idx" ON "WebAuthnCredential"("userId"); CREATE INDEX "BackupSnapshot_userId_createdAt_idx" ON "BackupSnapshot"("userId", "createdAt");
CREATE UNIQUE INDEX "NetWorthSnapshot_userId_date_key" ON "NetWorthSnapshot"("userId", "date"); CREATE INDEX "NetWorthSnapshot_userId_date_idx" ON "NetWorthSnapshot"("userId", "date"); CREATE INDEX "Asset_userId_type_idx" ON "Asset"("userId", "type");
CREATE INDEX "BankStatement_userId_importedAt_idx" ON "BankStatement"("userId", "importedAt"); CREATE UNIQUE INDEX "BankTransaction_userId_fingerprint_key" ON "BankTransaction"("userId", "fingerprint"); CREATE INDEX "BankTransaction_userId_statementId_status_idx" ON "BankTransaction"("userId", "statementId", "status"); CREATE INDEX "BankTransaction_matchedDebtId_idx" ON "BankTransaction"("matchedDebtId");
CREATE UNIQUE INDEX "Budget_userId_category_month_year_key" ON "Budget"("userId", "category", "month", "year"); CREATE INDEX "Budget_userId_year_month_idx" ON "Budget"("userId", "year", "month");

ALTER TABLE "Product" ADD CONSTRAINT "Product_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringPayment" ADD CONSTRAINT "RecurringPayment_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashFlow" ADD CONSTRAINT "CashFlow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RuleTrigger" ADD CONSTRAINT "RuleTrigger_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RuleAction" ADD CONSTRAINT "RuleAction_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RuleExecution" ADD CONSTRAINT "RuleExecution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RuleExecution" ADD CONSTRAINT "RuleExecution_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RuleExecution" ADD CONSTRAINT "RuleExecution_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserSecurity" ADD CONSTRAINT "UserSecurity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebAuthnCredential" ADD CONSTRAINT "WebAuthnCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BackupSnapshot" ADD CONSTRAINT "BackupSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NetWorthSnapshot" ADD CONSTRAINT "NetWorthSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankStatement" ADD CONSTRAINT "BankStatement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "BankStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_matchedDebtId_fkey" FOREIGN KEY ("matchedDebtId") REFERENCES "Debt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
