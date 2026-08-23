ALTER TYPE "DebtCategory" ADD VALUE IF NOT EXISTS 'TRANSPORT';
ALTER TYPE "DebtCategory" ADD VALUE IF NOT EXISTS 'UTILITIES';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RULE_APPLIED';

CREATE TYPE "RuleTriggerLogic" AS ENUM ('ALL', 'ANY');
CREATE TYPE "RuleTriggerType" AS ENUM ('DESCRIPTION_CONTAINS', 'DESCRIPTION_STARTS_WITH', 'DESCRIPTION_IS', 'AMOUNT_EXACTLY', 'AMOUNT_GREATER_THAN', 'AMOUNT_LESS_THAN', 'COUNTERPARTY_IS', 'COUNTERPARTY_CONTAINS', 'CATEGORY_IS', 'TYPE_IS');
CREATE TYPE "RuleOperator" AS ENUM ('EQUALS', 'CONTAINS', 'STARTS_WITH', 'GREATER_THAN', 'LESS_THAN');
CREATE TYPE "RuleActionType" AS ENUM ('SET_CATEGORY', 'SET_TYPE', 'SET_PAYMENT_TYPE', 'ADD_TAG', 'SET_REMINDER', 'SEND_NOTIFICATION', 'SET_COUNTERPARTY');

ALTER TABLE "Debt" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "Rule" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "triggerLogic" "RuleTriggerLogic" NOT NULL DEFAULT 'ALL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Rule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Rule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "RuleTrigger" (
  "id" UUID NOT NULL,
  "ruleId" UUID NOT NULL,
  "type" "RuleTriggerType" NOT NULL,
  "value" TEXT NOT NULL,
  "operator" "RuleOperator" NOT NULL DEFAULT 'EQUALS',
  CONSTRAINT "RuleTrigger_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RuleTrigger_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "RuleAction" (
  "id" UUID NOT NULL,
  "ruleId" UUID NOT NULL,
  "type" "RuleActionType" NOT NULL,
  "value" TEXT NOT NULL,
  CONSTRAINT "RuleAction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RuleAction_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "RuleExecution" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "ruleId" UUID NOT NULL,
  "debtId" UUID,
  "actionsApplied" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RuleExecution_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RuleExecution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RuleExecution_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RuleExecution_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Rule_userId_isActive_order_idx" ON "Rule"("userId", "isActive", "order");
CREATE INDEX "RuleTrigger_ruleId_idx" ON "RuleTrigger"("ruleId");
CREATE INDEX "RuleAction_ruleId_idx" ON "RuleAction"("ruleId");
CREATE INDEX "RuleExecution_userId_createdAt_idx" ON "RuleExecution"("userId", "createdAt");
CREATE INDEX "RuleExecution_debtId_idx" ON "RuleExecution"("debtId");
