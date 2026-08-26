create table "FinancialCashClosing" (
  "id" uuid not null,
  "userId" uuid not null,
  "accountId" uuid not null,
  "closedThrough" timestamp(3) not null,
  "ledgerBalance" decimal(12,2) not null,
  "countedBalance" decimal(12,2) not null,
  "difference" decimal(12,2) not null,
  "notes" varchar(1000),
  "responsibleUserId" uuid,
  "createdAt" timestamp(3) not null default current_timestamp,
  constraint "FinancialCashClosing_pkey" primary key ("id")
);
create unique index "FinancialCashClosing_accountId_closedThrough_key" on "FinancialCashClosing"("accountId", "closedThrough");
create index "FinancialCashClosing_userId_accountId_closedThrough_idx" on "FinancialCashClosing"("userId", "accountId", "closedThrough");
alter table "FinancialCashClosing" add constraint "FinancialCashClosing_userId_fkey" foreign key ("userId") references "User"("id") on delete cascade on update cascade;
alter table "FinancialCashClosing" add constraint "FinancialCashClosing_accountId_fkey" foreign key ("accountId") references "FinancialAccount"("id") on delete restrict on update cascade;
