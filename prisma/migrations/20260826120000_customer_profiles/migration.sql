create type "CustomerPersonType" as enum ('INDIVIDUAL', 'LEGAL');
create type "CustomerStatus" as enum ('PENDING_REVIEW', 'APPROVED', 'INACTIVE', 'REJECTED');
alter table "Customer"
  add column "personType" "CustomerPersonType" not null default 'INDIVIDUAL',
  add column "documentNumber" varchar(30), add column "birthOrIncorporationDate" timestamp(3),
  add column "category" varchar(100), add column "professionOrActivity" varchar(200),
  add column "declaredIncome" decimal(12,2), add column "creditLimit" decimal(12,2),
  add column "approvedInterestRate" decimal(7,4), add column "whatsapp" varchar(30),
  add column "zipCode" varchar(12), add column "street" varchar(200), add column "streetNumber" varchar(30),
  add column "addressComplement" varchar(200), add column "neighborhood" varchar(120), add column "city" varchar(120), add column "state" varchar(2),
  add column "classificationId" uuid, add column "status" "CustomerStatus" not null default 'APPROVED',
  add column "approvedAt" timestamp(3), add column "approvedById" uuid;
create table "CustomerClassification" ("id" uuid not null, "userId" uuid not null, "name" varchar(100) not null, "criteria" jsonb, "isActive" boolean not null default true, "createdAt" timestamp(3) not null default current_timestamp, "updatedAt" timestamp(3) not null, constraint "CustomerClassification_pkey" primary key ("id"));
create table "CustomerDocument" ("id" uuid not null, "userId" uuid not null, "customerId" uuid not null, "fileName" varchar(255) not null, "storagePath" varchar(500) not null, "mimeType" varchar(120) not null, "uploadedAt" timestamp(3) not null default current_timestamp, constraint "CustomerDocument_pkey" primary key ("id"));
create table "CustomerConsent" ("id" uuid not null, "userId" uuid not null, "customerId" uuid not null, "purpose" varchar(80) not null, "granted" boolean not null, "source" varchar(80) not null, "grantedAt" timestamp(3) not null default current_timestamp, "revokedAt" timestamp(3), constraint "CustomerConsent_pkey" primary key ("id"));
create unique index "CustomerClassification_userId_name_key" on "CustomerClassification"("userId", "name");
create index "CustomerClassification_userId_isActive_idx" on "CustomerClassification"("userId", "isActive");
create index "CustomerDocument_customerId_uploadedAt_idx" on "CustomerDocument"("customerId", "uploadedAt");
create index "CustomerConsent_customerId_purpose_grantedAt_idx" on "CustomerConsent"("customerId", "purpose", "grantedAt");
create index "Customer_userId_status_classificationId_idx" on "Customer"("userId", "status", "classificationId");
alter table "Customer" add constraint "Customer_classificationId_fkey" foreign key ("classificationId") references "CustomerClassification"("id") on delete set null on update cascade;
alter table "Customer" add constraint "Customer_approvedById_fkey" foreign key ("approvedById") references "User"("id") on delete set null on update cascade;
alter table "CustomerClassification" add constraint "CustomerClassification_userId_fkey" foreign key ("userId") references "User"("id") on delete cascade on update cascade;
alter table "CustomerDocument" add constraint "CustomerDocument_userId_fkey" foreign key ("userId") references "User"("id") on delete cascade on update cascade;
alter table "CustomerDocument" add constraint "CustomerDocument_customerId_fkey" foreign key ("customerId") references "Customer"("id") on delete cascade on update cascade;
alter table "CustomerConsent" add constraint "CustomerConsent_userId_fkey" foreign key ("userId") references "User"("id") on delete cascade on update cascade;
alter table "CustomerConsent" add constraint "CustomerConsent_customerId_fkey" foreign key ("customerId") references "Customer"("id") on delete cascade on update cascade;
