-- Enable UUID extension (already enabled on Supabase)
create extension if not exists "pgcrypto";

-- ============================================================
-- PROFILES (mirrors auth.users)
-- ============================================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  nome text,
  avatar_url text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- RBAC
-- ============================================================
create table public.cargos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  created_at timestamptz not null default now()
);

create table public.cargo_modulos (
  cargo_id uuid not null references public.cargos(id) on delete cascade,
  modulo text not null check (modulo in (
    'notas','lancamento','email','transferencias',
    'relatorios','auditoria','backup','configuracoes','dashboard'
  )),
  primary key (cargo_id, modulo)
);

create table public.usuario_cargos (
  user_id uuid not null references public.profiles(id) on delete cascade primary key,
  cargo_id uuid not null references public.cargos(id),
  atribuido_por uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- NOTAS FISCAIS
-- ============================================================
create table public.notas_fiscais (
  id uuid primary key default gen_random_uuid(),
  nfd text not null,
  nf text not null,
  data date not null,
  fornecedor text not null,
  aba text not null check (aba in ('Britania','Unilever','Variados')),
  tipo text,
  motivo text,
  descricao text,
  qtd integer not null default 0,
  valor_unitario numeric(12,2) not null default 0,
  valor_total numeric(12,2) generated always as (qtd * valor_unitario) stored,
  status text not null default 'Pendente' check (status in (
    'Pendente','Em Transferência','Devolvido','Cancelado','Vendido'
  )),
  obs text,
  responsavel_id uuid references public.profiles(id),
  frete_tipo text check (frete_tipo in ('Tabela','Valor+ICMS','Valor','Cortesia')),
  frete_valor numeric(12,2),
  dias_armazem integer not null default 0,
  anexo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_notas_fiscais_aba on public.notas_fiscais(aba);
create index idx_notas_fiscais_status on public.notas_fiscais(status);
create index idx_notas_fiscais_data on public.notas_fiscais(data desc);
create index idx_notas_fiscais_deleted on public.notas_fiscais(deleted_at) where deleted_at is null;

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger notas_fiscais_updated_at
  before update on public.notas_fiscais
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- TRANSFERENCIAS
-- ============================================================
create table public.transferencias (
  id uuid primary key default gen_random_uuid(),
  nota_fiscal_id uuid references public.notas_fiscais(id) on delete set null,
  nfd text not null,
  nf text not null,
  tipo text,
  caixas integer,
  valor numeric(12,2),
  num_pedido text,
  agendamento timestamptz,
  status text not null default 'Ativa' check (status in ('Ativa','Concluída','Cancelada')),
  created_at timestamptz not null default now()
);

create index idx_transferencias_status on public.transferencias(status);

-- ============================================================
-- FOTOS E COMENTÁRIOS
-- ============================================================
create table public.fotos_nf (
  id uuid primary key default gen_random_uuid(),
  nota_fiscal_id uuid not null references public.notas_fiscais(id) on delete cascade,
  url text not null,
  r2_key text not null,
  nome text,
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.comentarios (
  id uuid primary key default gen_random_uuid(),
  nota_fiscal_id uuid not null references public.notas_fiscais(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  texto text not null,
  created_at timestamptz not null default now()
);

create table public.respostas_fornecedor (
  id uuid primary key default gen_random_uuid(),
  nota_fiscal_id uuid not null references public.notas_fiscais(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  texto text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- EMAILS, AUDITORIA, CONFIGS, BACKUPS
-- ============================================================
create table public.emails_log (
  id uuid primary key default gen_random_uuid(),
  nota_ids uuid[] not null default '{}',
  destinatarios text[] not null default '{}',
  assunto text,
  corpo_html text,
  status text not null default 'enviado' check (status in ('enviado','agendado','erro')),
  agendado_para timestamptz,
  enviado_em timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  acao text not null,
  tabela text,
  registro_id uuid,
  dados_antes jsonb,
  dados_depois jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_log_created on public.audit_log(created_at desc);

create table public.configs (
  chave text primary key,
  valor jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create table public.backups (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tamanho_bytes bigint,
  r2_key text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
