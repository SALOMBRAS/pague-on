-- Financial settings are append-only versions. Existing contracts already carry
-- termsSnapshot; new contracts will reference the resolved version in JSON.
create type "FinancialHolidayType" as enum ('NATIONAL', 'STATE', 'MUNICIPAL', 'CUSTOM');

create table "FinancialSettingsVersion" (
  "id" uuid not null default gen_random_uuid(),
  "userId" uuid not null,
  "version" integer not null,
  "settings" jsonb not null,
  "reason" varchar(500) not null,
  "createdById" uuid not null,
  "createdAt" timestamp(3) not null default current_timestamp,
  constraint "FinancialSettingsVersion_pkey" primary key ("id"),
  constraint "FinancialSettingsVersion_userId_fkey" foreign key ("userId") references "User"("id") on delete cascade on update cascade,
  constraint "FinancialSettingsVersion_createdById_fkey" foreign key ("createdById") references "User"("id") on delete restrict on update cascade
);
create unique index "FinancialSettingsVersion_userId_version_key" on "FinancialSettingsVersion"("userId", "version");
create index "FinancialSettingsVersion_userId_createdAt_idx" on "FinancialSettingsVersion"("userId", "createdAt");

create table "FinancialHoliday" (
  "id" uuid not null default gen_random_uuid(),
  "userId" uuid not null,
  "date" timestamp(3) not null,
  "type" "FinancialHolidayType" not null,
  "name" varchar(160) not null,
  "region" varchar(120),
  "isActive" boolean not null default true,
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null,
  constraint "FinancialHoliday_pkey" primary key ("id"),
  constraint "FinancialHoliday_userId_fkey" foreign key ("userId") references "User"("id") on delete cascade on update cascade
);
create unique index "FinancialHoliday_userId_date_type_name_key" on "FinancialHoliday"("userId", "date", "type", "name");
create index "FinancialHoliday_userId_date_isActive_idx" on "FinancialHoliday"("userId", "date", "isActive");
