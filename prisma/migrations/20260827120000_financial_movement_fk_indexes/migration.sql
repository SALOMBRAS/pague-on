-- Índices em FKs de filtro frequentes no financialMovement:
-- filtros por responsável (responsibleUserId) e cobrador (collectorId) no
-- extrato/relatórios faziam seq scan na tabela que mais cresce.
create index "FinancialMovement_userId_responsibleUserId_occurredAt_idx"
  on "FinancialMovement"("userId", "responsibleUserId", "occurredAt");
create index "FinancialMovement_userId_collectorId_occurredAt_idx"
  on "FinancialMovement"("userId", "collectorId", "occurredAt");