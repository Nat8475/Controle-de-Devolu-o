-- ============================================================
-- AUDIT LOG TRIGGERS
-- Popula audit_log automaticamente para tabelas-chave
-- ============================================================

create or replace function public.fn_audit_log()
returns trigger language plpgsql security definer as $$
begin
  insert into public.audit_log (user_id, acao, tabela, registro_id, dados_antes, dados_depois)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    coalesce(new.id, old.id),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

-- notas_fiscais
create trigger audit_notas_fiscais
  after insert or update or delete on public.notas_fiscais
  for each row execute function public.fn_audit_log();

-- transferencias
create trigger audit_transferencias
  after insert or update or delete on public.transferencias
  for each row execute function public.fn_audit_log();

-- configs
create trigger audit_configs
  after update on public.configs
  for each row execute function public.fn_audit_log();

-- usuario_cargos
create trigger audit_usuario_cargos
  after insert or delete on public.usuario_cargos
  for each row execute function public.fn_audit_log();
