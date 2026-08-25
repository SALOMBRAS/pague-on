create type "FinancialAccountType" as enum ('CASH', 'BANK', 'DIGITAL_WALLET', 'OTHER');
create type "FinancialMovementType" as enum ('OPENING_BALANCE', 'LOAN_DISBURSEMENT', 'PAYMENT_RECEIVED', 'EXPENSE_PAID', 'ADJUSTMENT');
create table "FinancialAccount" (
  "id" uuid not null, "userId" uuid not null, "name" varchar(120) not null,
  "type" "FinancialAccountType" not null default 'CASH', "openingBalance" decimal(12,2) not null default 0,
  "isActive" boolean not null default true, "includeInAvailability" boolean not null default true,
  "createdAt" timestamp(3) not null default current_timestamp, "updatedAt" timestamp(3) not null,
  constraint "FinancialAccount_pkey" primary key ("id")
);
create table "FinancialMovement" (
  "id" uuid not null, "userId" uuid not null, "accountId" uuid not null,
  "type" "FinancialMovementType" not null, "amount" decimal(12,2) not null, "occurredAt" timestamp(3) not null,
  "referenceId" varchar(120), "description" varchar(500), "principal" decimal(12,2) not null default 0,
  "interest" decimal(12,2) not null default 0, "penalty" decimal(12,2) not null default 0,
  "createdAt" timestamp(3) not null default current_timestamp, constraint "FinancialMovement_pkey" primary key ("id")
);
create unique index "FinancialMovement_userId_referenceId_key" on "FinancialMovement"("userId", "referenceId");
create index "FinancialAccount_userId_isActive_includeInAvailability_idx" on "FinancialAccount"("userId", "isActive", "includeInAvailability");
create index "FinancialMovement_userId_occurredAt_idx" on "FinancialMovement"("userId", "occurredAt");
create index "FinancialMovement_accountId_occurredAt_idx" on "FinancialMovement"("accountId", "occurredAt");
alter table "FinancialAccount" add constraint "FinancialAccount_userId_fkey" foreign key ("userId") references "User"("id") on delete cascade on update cascade;
alter table "FinancialMovement" add constraint "FinancialMovement_userId_fkey" foreign key ("userId") references "User"("id") on delete cascade on update cascade;
alter table "FinancialMovement" add constraint "FinancialMovement_accountId_fkey" foreign key ("accountId") references "FinancialAccount"("id") on delete restrict on update cascade;
