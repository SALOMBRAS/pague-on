alter type "FinancialAccountType" add value if not exists 'PAYMENT_ACCOUNT';
alter type "FinancialAccountType" add value if not exists 'LOAN_CAPITAL';

alter table "FinancialAccount"
  add column "institution" varchar(160),
  add column "notes" varchar(1000);

alter table "FinancialMovement"
  add column "category" varchar(80),
  add column "origin" varchar(80),
  add column "paymentMethod" varchar(40),
  add column "customerId" uuid,
  add column "debtId" uuid,
  add column "collectorId" uuid,
  add column "responsibleUserId" uuid,
  add column "operationId" uuid,
  add column "reversalOfId" uuid,
  add column "isConfirmed" boolean not null default true;

create index "FinancialMovement_customerId_occurredAt_idx" on "FinancialMovement"("customerId", "occurredAt");
create index "FinancialMovement_debtId_occurredAt_idx" on "FinancialMovement"("debtId", "occurredAt");
create index "FinancialMovement_operationId_idx" on "FinancialMovement"("operationId");

alter table "FinancialMovement" add constraint "FinancialMovement_customerId_fkey" foreign key ("customerId") references "Customer"("id") on delete set null on update cascade;
alter table "FinancialMovement" add constraint "FinancialMovement_debtId_fkey" foreign key ("debtId") references "Debt"("id") on delete set null on update cascade;
alter table "FinancialMovement" add constraint "FinancialMovement_collectorId_fkey" foreign key ("collectorId") references "User"("id") on delete set null on update cascade;
alter table "FinancialMovement" add constraint "FinancialMovement_responsibleUserId_fkey" foreign key ("responsibleUserId") references "User"("id") on delete set null on update cascade;
alter table "FinancialMovement" add constraint "FinancialMovement_reversalOfId_fkey" foreign key ("reversalOfId") references "FinancialMovement"("id") on delete restrict on update cascade;
