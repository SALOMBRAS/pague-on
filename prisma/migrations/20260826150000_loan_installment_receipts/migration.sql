create table "InstallmentPayment" (
  "id" uuid not null,
  "userId" uuid not null,
  "installmentId" uuid not null,
  "receiptNumber" varchar(80) not null,
  "idempotencyKey" varchar(120) not null,
  "amount" decimal(12,2) not null,
  "principalAmount" decimal(12,2) not null default 0,
  "interestAmount" decimal(12,2) not null default 0,
  "penaltyAmount" decimal(12,2) not null default 0,
  "discountAmount" decimal(12,2) not null default 0,
  "paymentMethod" varchar(40) not null,
  "proofUrl" varchar(500),
  "promiseDate" timestamp(3),
  "notes" varchar(2000),
  "discountReason" varchar(500),
  "renewalReason" varchar(500),
  "receiptHtml" varchar(16000) not null,
  "isReversed" boolean not null default false,
  "reversedAt" timestamp(3),
  "reversalReason" varchar(500),
  "createdById" uuid not null,
  "createdAt" timestamp(3) not null default current_timestamp,
  constraint "InstallmentPayment_pkey" primary key ("id")
);
create unique index "InstallmentPayment_userId_receiptNumber_key" on "InstallmentPayment"("userId", "receiptNumber");
create unique index "InstallmentPayment_userId_idempotencyKey_key" on "InstallmentPayment"("userId", "idempotencyKey");
create index "InstallmentPayment_installmentId_createdAt_idx" on "InstallmentPayment"("installmentId", "createdAt");
alter table "InstallmentPayment" add constraint "InstallmentPayment_userId_fkey" foreign key ("userId") references "User"("id") on delete cascade on update cascade;
alter table "InstallmentPayment" add constraint "InstallmentPayment_installmentId_fkey" foreign key ("installmentId") references "Installment"("id") on delete restrict on update cascade;
alter table "InstallmentPayment" add constraint "InstallmentPayment_createdById_fkey" foreign key ("createdById") references "User"("id") on delete restrict on update cascade;

create table "InstallmentPaymentAllocation" (
  "id" uuid not null,
  "paymentId" uuid not null,
  "accountId" uuid not null,
  "movementId" uuid not null,
  "amount" decimal(12,2) not null,
  "createdAt" timestamp(3) not null default current_timestamp,
  constraint "InstallmentPaymentAllocation_pkey" primary key ("id")
);
create unique index "InstallmentPaymentAllocation_paymentId_accountId_key" on "InstallmentPaymentAllocation"("paymentId", "accountId");
create unique index "InstallmentPaymentAllocation_movementId_key" on "InstallmentPaymentAllocation"("movementId");
create index "InstallmentPaymentAllocation_accountId_createdAt_idx" on "InstallmentPaymentAllocation"("accountId", "createdAt");
alter table "InstallmentPaymentAllocation" add constraint "InstallmentPaymentAllocation_paymentId_fkey" foreign key ("paymentId") references "InstallmentPayment"("id") on delete cascade on update cascade;
alter table "InstallmentPaymentAllocation" add constraint "InstallmentPaymentAllocation_accountId_fkey" foreign key ("accountId") references "FinancialAccount"("id") on delete restrict on update cascade;
