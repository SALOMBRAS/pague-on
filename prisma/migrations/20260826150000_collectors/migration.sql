create type "CommissionType" as enum ('PERCENTAGE', 'FIXED');
create type "CommissionBase" as enum ('PRINCIPAL', 'INTEREST', 'PENALTY', 'TOTAL');
create type "CollectorContactType" as enum ('CALL', 'WHATSAPP', 'SMS', 'VISIT', 'PAYMENT_PROMISE', 'NOTE');
create type "CollectorCommissionStatus" as enum ('ACTIVE', 'REVERSED');

create table "CollectorProfile" (
  "id" uuid not null default gen_random_uuid(),
  "userId" uuid not null,
  "documentNumber" varchar(40),
  "whatsapp" varchar(30),
  "isActive" boolean not null default true,
  "commissionType" "CommissionType" not null default 'PERCENTAGE',
  "commissionRate" decimal(7,4) not null default 0,
  "commissionBase" "CommissionBase" not null default 'TOTAL',
  "permissions" jsonb,
  "notes" varchar(2000),
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null,
  constraint "CollectorProfile_pkey" primary key ("id"),
  constraint "CollectorProfile_userId_key" unique ("userId"),
  constraint "CollectorProfile_userId_fkey" foreign key ("userId") references "User"("id") on delete cascade on update cascade
);
create index "CollectorProfile_isActive_idx" on "CollectorProfile"("isActive");

create table "CollectorContact" (
  "id" uuid not null default gen_random_uuid(),
  "userId" uuid not null,
  "collectorId" uuid not null,
  "customerId" uuid not null,
  "debtId" uuid,
  "installmentId" uuid,
  "type" "CollectorContactType" not null,
  "note" varchar(2000),
  "promisedDate" timestamp(3),
  "promisedAmount" decimal(12,2),
  "completedAt" timestamp(3),
  "createdAt" timestamp(3) not null default current_timestamp,
  constraint "CollectorContact_pkey" primary key ("id"),
  constraint "CollectorContact_collectorId_fkey" foreign key ("collectorId") references "User"("id") on delete restrict on update cascade,
  constraint "CollectorContact_customerId_fkey" foreign key ("customerId") references "Customer"("id") on delete cascade on update cascade,
  constraint "CollectorContact_debtId_fkey" foreign key ("debtId") references "Debt"("id") on delete set null on update cascade,
  constraint "CollectorContact_installmentId_fkey" foreign key ("installmentId") references "Installment"("id") on delete set null on update cascade
);
create index "CollectorContact_userId_collectorId_createdAt_idx" on "CollectorContact"("userId", "collectorId", "createdAt");
create index "CollectorContact_customerId_createdAt_idx" on "CollectorContact"("customerId", "createdAt");
create index "CollectorContact_promisedDate_idx" on "CollectorContact"("promisedDate");

create table "CollectorCommission" (
  "id" uuid not null default gen_random_uuid(),
  "userId" uuid not null,
  "collectorId" uuid not null,
  "customerId" uuid not null,
  "debtId" uuid not null,
  "installmentId" uuid,
  "paymentAmount" decimal(12,2) not null,
  "baseAmount" decimal(12,2) not null,
  "commissionAmount" decimal(12,2) not null,
  "commissionType" "CommissionType" not null,
  "commissionRate" decimal(7,4) not null,
  "commissionBase" "CommissionBase" not null,
  "status" "CollectorCommissionStatus" not null default 'ACTIVE',
  "reversedAt" timestamp(3),
  "reversalReason" varchar(500),
  "createdAt" timestamp(3) not null default current_timestamp,
  constraint "CollectorCommission_pkey" primary key ("id"),
  constraint "CollectorCommission_collectorId_fkey" foreign key ("collectorId") references "User"("id") on delete restrict on update cascade,
  constraint "CollectorCommission_customerId_fkey" foreign key ("customerId") references "Customer"("id") on delete restrict on update cascade,
  constraint "CollectorCommission_debtId_fkey" foreign key ("debtId") references "Debt"("id") on delete restrict on update cascade,
  constraint "CollectorCommission_installmentId_fkey" foreign key ("installmentId") references "Installment"("id") on delete restrict on update cascade
);
create index "CollectorCommission_userId_collectorId_createdAt_idx" on "CollectorCommission"("userId", "collectorId", "createdAt");
create index "CollectorCommission_installmentId_status_idx" on "CollectorCommission"("installmentId", "status");
create index "CollectorCommission_customerId_debtId_idx" on "CollectorCommission"("customerId", "debtId");
