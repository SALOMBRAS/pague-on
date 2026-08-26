alter type "Frequency" add value if not exists 'DAILY';

create type "LoanModality" as enum ('INSTALLMENT', 'SIMPLE_INTEREST', 'PRICE', 'RENEWAL');

alter table "Debt"
  add column "principalAmount" decimal(12,2),
  add column "appliedInterestRate" decimal(7,4),
  add column "loanModality" "LoanModality",
  add column "loanTerms" jsonb;

create table "LoanModalityConfiguration" (
  "id" uuid not null,
  "userId" uuid not null,
  "modality" "LoanModality" not null,
  "displayName" varchar(120) not null,
  "formulaVersion" varchar(80) not null,
  "formulaPolicy" varchar(2000) not null,
  "termsTemplate" varchar(12000),
  "skipSundays" boolean not null default false,
  "holidayDates" jsonb,
  "legalReviewReference" varchar(250) not null,
  "isActive" boolean not null default true,
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null,
  constraint "LoanModalityConfiguration_pkey" primary key ("id")
);
create unique index "LoanModalityConfiguration_userId_modality_key" on "LoanModalityConfiguration"("userId", "modality");
create index "LoanModalityConfiguration_userId_isActive_idx" on "LoanModalityConfiguration"("userId", "isActive");
alter table "LoanModalityConfiguration" add constraint "LoanModalityConfiguration_userId_fkey" foreign key ("userId") references "User"("id") on delete cascade on update cascade;

create table "LoanContract" (
  "id" uuid not null,
  "userId" uuid not null,
  "debtId" uuid not null,
  "customerId" uuid not null,
  "configurationId" uuid not null,
  "contractNumber" varchar(80) not null,
  "modality" "LoanModality" not null,
  "termsSnapshot" jsonb not null,
  "documentHtml" varchar(30000) not null,
  "consentedAt" timestamp(3) not null,
  "renewalOfDebtId" uuid,
  "createdAt" timestamp(3) not null default current_timestamp,
  constraint "LoanContract_pkey" primary key ("id")
);
create unique index "LoanContract_debtId_key" on "LoanContract"("debtId");
create unique index "LoanContract_userId_contractNumber_key" on "LoanContract"("userId", "contractNumber");
create index "LoanContract_userId_customerId_createdAt_idx" on "LoanContract"("userId", "customerId", "createdAt");
create index "LoanContract_renewalOfDebtId_idx" on "LoanContract"("renewalOfDebtId");
alter table "LoanContract" add constraint "LoanContract_userId_fkey" foreign key ("userId") references "User"("id") on delete cascade on update cascade;
alter table "LoanContract" add constraint "LoanContract_debtId_fkey" foreign key ("debtId") references "Debt"("id") on delete cascade on update cascade;
alter table "LoanContract" add constraint "LoanContract_customerId_fkey" foreign key ("customerId") references "Customer"("id") on delete restrict on update cascade;
alter table "LoanContract" add constraint "LoanContract_configurationId_fkey" foreign key ("configurationId") references "LoanModalityConfiguration"("id") on delete restrict on update cascade;
