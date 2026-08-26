-- Enforce append-only no AuditLog.
-- O serviço de auditoria só faz INSERT; imutabilidade é garantida no banco
-- por um trigger que aborta qualquer UPDATE ou DELETE, inclusive nos registros
-- em legal hold (que ficam assim imutáveis por construção).

create or replace function _audit_prevent_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'AuditLog is append-only: mutation of audit rows is forbidden';
end;
$$;

drop trigger if exists audit_log_no_update on "AuditLog";
create trigger audit_log_no_update
  before update or delete on "AuditLog"
  for each row
  execute function _audit_prevent_mutation();