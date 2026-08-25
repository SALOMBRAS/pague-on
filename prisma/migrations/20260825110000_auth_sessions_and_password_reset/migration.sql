alter table "User" add column "phoneNormalized" text;
alter table "User" add column "sessionVersion" integer not null default 0;

create unique index "User_phoneNormalized_key" on "User"("phoneNormalized");

create table "PasswordResetToken" (
  "id" uuid not null,
  "userId" uuid not null,
  "tokenHash" text not null,
  "expiresAt" timestamp(3) not null,
  "usedAt" timestamp(3),
  "createdAt" timestamp(3) not null default current_timestamp,
  constraint "PasswordResetToken_pkey" primary key ("id")
);

create unique index "PasswordResetToken_tokenHash_key" on "PasswordResetToken"("tokenHash");
create index "PasswordResetToken_userId_expiresAt_idx" on "PasswordResetToken"("userId", "expiresAt");
alter table "PasswordResetToken" add constraint "PasswordResetToken_userId_fkey" foreign key ("userId") references "User"("id") on delete cascade on update cascade;
