-- ============================================================
-- Enable RLS on all tables
-- ============================================================
alter table public.profiles enable row level security;
alter table public.cargos enable row level security;
alter table public.cargo_modulos enable row level security;
alter table public.usuario_cargos enable row level security;
alter table public.notas_fiscais enable row level security;
alter table public.transferencias enable row level security;
alter table public.fotos_nf enable row level security;
alter table public.comentarios enable row level security;
alter table public.respostas_fornecedor enable row level security;
alter table public.emails_log enable row level security;
alter table public.audit_log enable row level security;
alter table public.configs enable row level security;
alter table public.backups enable row level security;

-- ============================================================
-- Helper functions
-- ============================================================
create or replace function public.is_admin()
returns boolean language sql security definer stable as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.has_module(mod text)
returns boolean language sql security definer stable as $$
  select public.is_admin()
    or exists (
      select 1
      from public.usuario_cargos uc
      join public.cargo_modulos cm on cm.cargo_id = uc.cargo_id
      where uc.user_id = auth.uid()
        and cm.modulo = mod
    );
$$;

-- ============================================================
-- PROFILES policies
-- ============================================================
create policy "profiles: read own" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy "profiles: admin full" on public.profiles
  for all using (public.is_admin());

-- ============================================================
-- CARGOS + CARGO_MODULOS + USUARIO_CARGOS (admin only write)
-- ============================================================
create policy "cargos: read all authenticated" on public.cargos
  for select using (auth.uid() is not null);

create policy "cargos: admin write" on public.cargos
  for all using (public.is_admin());

create policy "cargo_modulos: read all authenticated" on public.cargo_modulos
  for select using (auth.uid() is not null);

create policy "cargo_modulos: admin write" on public.cargo_modulos
  for all using (public.is_admin());

create policy "usuario_cargos: read own or admin" on public.usuario_cargos
  for select using (user_id = auth.uid() or public.is_admin());

create policy "usuario_cargos: admin write" on public.usuario_cargos
  for all using (public.is_admin());

-- ============================================================
-- NOTAS_FISCAIS policies
-- ============================================================
create policy "notas: read with module notas" on public.notas_fiscais
  for select using (public.has_module('notas'));

create policy "notas: insert with module lancamento" on public.notas_fiscais
  for insert with check (public.has_module('lancamento'));

create policy "notas: update with module notas or lancamento" on public.notas_fiscais
  for update using (public.has_module('notas') or public.has_module('lancamento'));

-- No delete policy — only soft deletes (set deleted_at)

-- ============================================================
-- TRANSFERENCIAS
-- ============================================================
create policy "transferencias: read" on public.transferencias
  for select using (public.has_module('transferencias'));

create policy "transferencias: write" on public.transferencias
  for all using (public.has_module('transferencias'));

-- ============================================================
-- FOTOS, COMENTÁRIOS, RESPOSTAS
-- ============================================================
create policy "fotos_nf: read" on public.fotos_nf
  for select using (public.has_module('notas'));

create policy "fotos_nf: write" on public.fotos_nf
  for all using (public.has_module('notas') or public.has_module('lancamento'));

create policy "comentarios: read" on public.comentarios
  for select using (public.has_module('notas'));

create policy "comentarios: insert own" on public.comentarios
  for insert with check (public.has_module('notas') and user_id = auth.uid());

create policy "respostas_fornecedor: read" on public.respostas_fornecedor
  for select using (public.has_module('notas'));

create policy "respostas_fornecedor: insert own" on public.respostas_fornecedor
  for insert with check (public.has_module('notas') and user_id = auth.uid());

-- ============================================================
-- EMAILS_LOG
-- ============================================================
create policy "emails_log: read" on public.emails_log
  for select using (public.has_module('email') or public.has_module('auditoria'));

create policy "emails_log: insert" on public.emails_log
  for insert with check (public.has_module('email'));

-- ============================================================
-- AUDIT_LOG
-- ============================================================
create policy "audit_log: read" on public.audit_log
  for select using (public.has_module('auditoria'));

-- audit_log inserts happen via service role (Edge Functions only)

-- ============================================================
-- CONFIGS
-- ============================================================
create policy "configs: read all authenticated" on public.configs
  for select using (auth.uid() is not null);

create policy "configs: write configuracoes" on public.configs
  for all using (public.has_module('configuracoes'));

-- ============================================================
-- BACKUPS
-- ============================================================
create policy "backups: read" on public.backups
  for select using (public.has_module('backup'));

create policy "backups: write" on public.backups
  for all using (public.has_module('backup'));
