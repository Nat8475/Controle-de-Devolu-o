-- Seed: create default cargos
insert into public.cargos (id, nome) values
  ('00000000-0000-0000-0000-000000000001', 'Operador'),
  ('00000000-0000-0000-0000-000000000002', 'Visualizador')
on conflict (nome) do nothing;

-- Operador: acesso aos módulos principais
insert into public.cargo_modulos (cargo_id, modulo) values
  ('00000000-0000-0000-0000-000000000001', 'notas'),
  ('00000000-0000-0000-0000-000000000001', 'lancamento'),
  ('00000000-0000-0000-0000-000000000001', 'email'),
  ('00000000-0000-0000-0000-000000000001', 'transferencias'),
  ('00000000-0000-0000-0000-000000000001', 'dashboard'),
  ('00000000-0000-0000-0000-000000000001', 'relatorios')
on conflict do nothing;

-- Visualizador: somente leitura
insert into public.cargo_modulos (cargo_id, modulo) values
  ('00000000-0000-0000-0000-000000000002', 'notas'),
  ('00000000-0000-0000-0000-000000000002', 'dashboard')
on conflict do nothing;

-- Configs padrão
insert into public.configs (chave, valor) values
  ('alert_days_threshold', '30'),
  ('email_from_name', '"Controle de Devoluções"'),
  ('dark_mode_default', 'false')
on conflict (chave) do nothing;

-- ============================================================
-- APÓS RODAR ESTE SEED, execute no SQL Editor do Supabase:
-- update public.profiles set is_admin = true where email = 'datandarosa@gmail.com';
-- ============================================================
