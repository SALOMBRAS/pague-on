create table "AuditLog" (
  "id" uuid not null,
  "workspaceOwnerId" uuid,
  "actorId" uuid,
  "eventType" varchar(80) not null,
  "actorEmailHash" varchar(64),
  "targetId" uuid,
  "targetType" varchar(80),
  "targetEmailHash" varchar(64),
  "payload" jsonb,
  "ipAddress" varchar(64),
  "userAgent" varchar(512),
  "legalHold" boolean not null default false,
  "createdAt" timestamp(3) not null default current_timestamp,
  constraint "AuditLog_pkey" primary key ("id")
);
create index "AuditLog_workspaceOwnerId_createdAt_idx" on "AuditLog"("workspaceOwnerId", "createdAt");
create index "AuditLog_actorId_createdAt_idx" on "AuditLog"("actorId", "createdAt");
create index "AuditLog_legalHold_createdAt_idx" on "AuditLog"("legalHold", "createdAt");
alter table "AuditLog" add constraint "AuditLog_actorId_fkey" foreign key ("actorId") references "User"("id") on delete set null on update cascade;
alter table "AuditLog" add constraint "AuditLog_workspaceOwnerId_fkey" foreign key ("workspaceOwnerId") references "User"("id") on delete set null on update cascade;
