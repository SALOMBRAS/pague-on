-- Hardening do auto-cadastro de clientes:
--   * attempts: contador de tentativas inválidas por token (limite de uso).
--   * revokedAt: revogação administrativa (invalida o token imediatamente).
alter table "CustomerRegistrationInvite"
  add column "attempts" integer not null default 0,
  add column "revokedAt" timestamp(3);