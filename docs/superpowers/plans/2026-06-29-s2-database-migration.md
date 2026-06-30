# S2: Database Schema + Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the complete Supabase PostgreSQL schema with RLS, seed test data, and write a migration script that exports data from Google Sheets and imports it into Supabase.

**Architecture:** SQL migrations in `supabase/migrations/`, applied via Supabase CLI. Migration script is a standalone Node.js script in `scripts/migrate-sheets/`. RLS policies enforce per-module access using a `cargo_modulos` join. The `profiles` table mirrors `auth.users` and includes an `is_admin` flag.

**Tech Stack:** Supabase CLI, PostgreSQL 15, Node.js 18, googleapis npm package, @supabase/supabase-js

## Global Constraints

- All SQL in `supabase/migrations/` with timestamp prefix format `YYYYMMDDHHMMSS_name.sql`
- Supabase project must be created at supabase.com before running migrations
- Migration script env vars in `scripts/migrate-sheets/.env` (not committed)
- Soft delete: `deleted_at timestamptz` on `notas_fiscais` (null = active)
- `valor_total` is a generated column: `qtd * valor_unitario`
- `is_admin` column added to `profiles` table
- All UUIDs use `gen_random_uuid()`
- Tables use `timestamptz DEFAULT now()` for timestamps

---

## File Structure

```
supabase/
  migrations/
    20260629000001_initial_schema.sql
    20260629000002_rls_policies.sql
    20260629000003_functions_triggers.sql
  seed.sql

scripts/
  migrate-sheets/
    package.json
    .env              ← not committed
    .env.example
    index.js          ← orchestrator: runs export → transform → import
    export-sheets.js  ← reads Google Sheets → returns raw arrays
    transform.js      ← maps columns to DB schema
    import-supabase.js ← batch inserts into Supabase
```

---

### Task 1: Supabase CLI Setup + Project Link

**Files:**
- Create: `supabase/` directory structure

**Interfaces:**
- Produces: linked Supabase project, `supabase db push` working

- [ ] **Step 1: Install Supabase CLI**

```bash
npm install -D supabase
```

- [ ] **Step 2: Initialize Supabase in project**

```bash
npx supabase init
```

Expected: Creates `supabase/` directory with config files.

- [ ] **Step 3: Login and link project**

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
```

(Replace `YOUR_PROJECT_REF` with the ref from your Supabase project URL: `https://YOUR_REF.supabase.co`)

- [ ] **Step 4: Commit scaffold**

```bash
git add supabase/
git commit -m "chore: initialize Supabase CLI"
```

---

### Task 2: Initial Schema Migration

**Files:**
- Create: `supabase/migrations/20260629000001_initial_schema.sql`

**Interfaces:**
- Produces: All tables: `profiles`, `cargos`, `cargo_modulos`, `usuario_cargos`, `notas_fiscais`, `transferencias`, `fotos_nf`, `comentarios`, `respostas_fornecedor`, `emails_log`, `audit_log`, `configs`, `backups`

- [ ] **Step 1: Create `supabase/migrations/20260629000001_initial_schema.sql`**

```sql
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
```

- [ ] **Step 2: Apply migration**

```bash
npx supabase db push
```

Expected: Migration applied successfully, all tables created.

- [ ] **Step 3: Commit**

```bash
git add supabase/
git commit -m "feat: initial database schema with all tables"
```

---

### Task 3: RLS Policies

**Files:**
- Create: `supabase/migrations/20260629000002_rls_policies.sql`

**Interfaces:**
- Produces: RLS enabled on all tables, admin bypass, per-module access

- [ ] **Step 1: Create `supabase/migrations/20260629000002_rls_policies.sql`**

```sql
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
```

- [ ] **Step 2: Apply migration**

```bash
npx supabase db push
```

Expected: RLS enabled and all policies created.

- [ ] **Step 3: Verify RLS works**

In Supabase Dashboard → Table Editor → notas_fiscais: try querying as an anonymous user — should return 0 rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: add RLS policies for all tables"
```

---

### Task 4: Seed Data + Test Cargo

**Files:**
- Create: `supabase/seed.sql`

**Interfaces:**
- Produces: One admin cargo, one default "Operador" cargo with standard modules, seed admin user promotion

- [ ] **Step 1: Create `supabase/seed.sql`**

```sql
-- Seed: create default cargos
insert into public.cargos (id, nome) values
  ('00000000-0000-0000-0000-000000000001', 'Operador'),
  ('00000000-0000-0000-0000-000000000002', 'Visualizador')
on conflict (nome) do nothing;

-- Operador: access to core modules
insert into public.cargo_modulos (cargo_id, modulo) values
  ('00000000-0000-0000-0000-000000000001', 'notas'),
  ('00000000-0000-0000-0000-000000000001', 'lancamento'),
  ('00000000-0000-0000-0000-000000000001', 'email'),
  ('00000000-0000-0000-0000-000000000001', 'transferencias'),
  ('00000000-0000-0000-0000-000000000001', 'dashboard'),
  ('00000000-0000-0000-0000-000000000001', 'relatorios')
on conflict do nothing;

-- Visualizador: read-only notas + dashboard
insert into public.cargo_modulos (cargo_id, modulo) values
  ('00000000-0000-0000-0000-000000000002', 'notas'),
  ('00000000-0000-0000-0000-000000000002', 'dashboard')
on conflict do nothing;

-- Default configs
insert into public.configs (chave, valor) values
  ('alert_days_threshold', '30'),
  ('email_from_name', '"Controle de Devoluções"'),
  ('dark_mode_default', 'false')
on conflict (chave) do nothing;
```

- [ ] **Step 2: Apply seed**

```bash
npx supabase db reset --linked
```

Or manually in Supabase SQL Editor: paste and run `seed.sql`.

- [ ] **Step 3: Promote your user to admin**

In Supabase SQL Editor:

```sql
update public.profiles
set is_admin = true
where email = 'datandarosa@gmail.com';
```

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: add seed data with default cargos and configs"
```

---

### Task 5: Migration Script Setup

**Files:**
- Create: `scripts/migrate-sheets/package.json`, `scripts/migrate-sheets/.env.example`, `scripts/migrate-sheets/index.js`

**Interfaces:**
- Produces: `node scripts/migrate-sheets/index.js` runs the full migration

- [ ] **Step 1: Create `scripts/migrate-sheets/package.json`**

```json
{
  "name": "migrate-sheets",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "migrate": "node index.js"
  },
  "dependencies": {
    "googleapis": "^144.0.0",
    "@supabase/supabase-js": "^2.0.0",
    "dotenv": "^16.0.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
cd scripts/migrate-sheets && npm install && cd ../..
```

- [ ] **Step 3: Create `scripts/migrate-sheets/.env.example`**

```
SUPABASE_URL=https://YOUR_REF.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here
GOOGLE_SHEETS_ID=your_google_sheets_id_here
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
```

- [ ] **Step 4: Create `.env` from example (not committed)**

```bash
cp scripts/migrate-sheets/.env.example scripts/migrate-sheets/.env
```

Fill in real values in `.env`.

- [ ] **Step 5: Add to `.gitignore`**

Add to `.gitignore` (create if not exists):
```
scripts/migrate-sheets/.env
scripts/migrate-sheets/node_modules/
.env.local
.env
```

- [ ] **Step 6: Commit**

```bash
git add scripts/ .gitignore
git commit -m "chore: add migration script scaffold"
```

---

### Task 6: Google Sheets Export Script

**Files:**
- Create: `scripts/migrate-sheets/export-sheets.js`

**Interfaces:**
- Produces: `exportSheets()` returning `{ britania: Row[][], unilever: Row[][], variados: Row[][] }`
- Each `Row` is `string[]` (raw Sheets values)

- [ ] **Step 1: Create `scripts/migrate-sheets/export-sheets.js`**

```javascript
import { google } from 'googleapis'
import 'dotenv/config'

const RANGES = {
  britania: 'Britania!A2:T',
  unilever: 'Unilever!A2:T',
  variados: 'Fornecedores Variados!A2:T',
}

export async function exportSheets() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })

  const sheets = google.sheets({ version: 'v4', auth })
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID

  const results = {}
  for (const [aba, range] of Object.entries(RANGES)) {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range })
    results[aba] = res.data.values ?? []
    console.log(`Exported ${results[aba].length} rows from ${aba}`)
  }

  return results
}
```

---

### Task 7: Transform Script

**Files:**
- Create: `scripts/migrate-sheets/transform.js`

**Interfaces:**
- Consumes: `{ britania: Row[][], unilever: Row[][], variados: Row[][] }` from `exportSheets()`
- Produces: `NotaFiscalInsert[]` ready for Supabase insert

- [ ] **Step 1: Create `scripts/migrate-sheets/transform.js`**

```javascript
// Column mapping (0-indexed, matching DOCUMENTACAO.md cols 1-20 → 0-19):
// 0=NFD, 1=NF, 2=Data, 3=Fornecedor, 4=Tipo, 5=Motivo, 6=Descricao,
// 7=Qtd, 8=ValorUnitario, 9=ValorTotal(skip), 10=Status,
// 11-13=checkboxes(skip), 14=Obs, 15=Resp(skip), 16=AnexoURL,
// 17=DiasArmaz, 18=FreteTipo, 19=FreteValor

const ABA_MAP = { britania: 'Britania', unilever: 'Unilever', variados: 'Variados' }
const STATUS_MAP = {
  'pendente': 'Pendente',
  'em transferência': 'Em Transferência',
  'em transferencia': 'Em Transferência',
  'devolvido': 'Devolvido',
  'cancelado': 'Cancelado',
  'vendido': 'Vendido',
}
const FRETE_MAP = {
  'tabela': 'Tabela',
  'valor+icms': 'Valor+ICMS',
  'valor': 'Valor',
  'cortesia': 'Cortesia',
}

function parseDate(raw) {
  if (!raw) return null
  // Try DD/MM/YYYY
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (match) return `${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`
  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0,10)
  return null
}

function parseNumber(raw) {
  if (!raw) return 0
  const cleaned = raw.toString().replace(/[R$\s.]/g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

function mapStatus(raw) {
  if (!raw) return 'Pendente'
  return STATUS_MAP[raw.trim().toLowerCase()] ?? 'Pendente'
}

function mapFrete(raw) {
  if (!raw) return null
  return FRETE_MAP[raw.trim().toLowerCase()] ?? null
}

export function transform(rawData) {
  const rows = []

  for (const [abaKey, data] of Object.entries(rawData)) {
    const aba = ABA_MAP[abaKey]

    for (const row of data) {
      const nfd = row[0]?.trim()
      const nf = row[1]?.trim()
      if (!nfd && !nf) continue // skip empty rows

      const data_str = parseDate(row[2])
      if (!data_str) continue // skip rows without valid date

      rows.push({
        nfd: nfd || '',
        nf: nf || '',
        data: data_str,
        fornecedor: (row[3] ?? '').trim().toUpperCase(),
        aba,
        tipo: row[4]?.trim() || null,
        motivo: row[5]?.trim() || null,
        descricao: row[6]?.trim() || null,
        qtd: parseInt(row[7] ?? '0', 10) || 0,
        valor_unitario: parseNumber(row[8]),
        status: mapStatus(row[10]),
        obs: row[14]?.trim() || null,
        // row[15] = Resp — skip, no matching user IDs
        anexo_url: row[16]?.trim() || null,
        dias_armazem: parseInt(row[17] ?? '0', 10) || 0,
        frete_tipo: mapFrete(row[18]),
        frete_valor: row[19] ? parseNumber(row[19]) : null,
      })
    }
  }

  console.log(`Transformed ${rows.length} total rows`)
  return rows
}
```

---

### Task 8: Supabase Import Script

**Files:**
- Create: `scripts/migrate-sheets/import-supabase.js`

**Interfaces:**
- Consumes: `NotaFiscalInsert[]` from `transform()`
- Produces: All rows inserted in `notas_fiscais`, logs success/failure counts

- [ ] **Step 1: Create `scripts/migrate-sheets/import-supabase.js`**

```javascript
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const BATCH_SIZE = 500

export async function importToSupabase(rows) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY // service role bypasses RLS
  )

  let inserted = 0
  let errors = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error } = await supabase
      .from('notas_fiscais')
      .insert(batch)

    if (error) {
      console.error(`Batch ${i / BATCH_SIZE + 1} error:`, error.message)
      errors += batch.length
    } else {
      inserted += batch.length
      console.log(`Inserted batch ${i / BATCH_SIZE + 1} (${batch.length} rows)`)
    }
  }

  console.log(`\nMigration complete: ${inserted} inserted, ${errors} failed`)
  return { inserted, errors }
}
```

---

### Task 9: Migration Orchestrator

**Files:**
- Create: `scripts/migrate-sheets/index.js`

**Interfaces:**
- Produces: `node scripts/migrate-sheets/index.js` runs full migration pipeline

- [ ] **Step 1: Create `scripts/migrate-sheets/index.js`**

```javascript
import { exportSheets } from './export-sheets.js'
import { transform } from './transform.js'
import { importToSupabase } from './import-supabase.js'

console.log('=== Controle de Devoluções — Migration Script ===\n')

try {
  console.log('Step 1: Exporting from Google Sheets...')
  const rawData = await exportSheets()

  console.log('\nStep 2: Transforming data...')
  const rows = transform(rawData)

  if (rows.length === 0) {
    console.log('No rows to import. Check Google Sheets ID and permissions.')
    process.exit(0)
  }

  console.log(`\nStep 3: Importing ${rows.length} rows to Supabase...`)
  const { inserted, errors } = await importToSupabase(rows)

  if (errors > 0) {
    console.log(`\n⚠ Migration completed with ${errors} errors. Check logs above.`)
    process.exit(1)
  } else {
    console.log(`\n✓ Migration successful: ${inserted} rows imported.`)
  }
} catch (err) {
  console.error('Migration failed:', err)
  process.exit(1)
}
```

- [ ] **Step 2: Test with dry run (no real data)**

```bash
cd scripts/migrate-sheets
node -e "import('./transform.js').then(m => console.log(m.transform({ britania: [], unilever: [], variados: [] })))"
```

Expected: `Transformed 0 total rows` and empty array `[]`.

- [ ] **Step 3: Run full migration (requires real credentials)**

```bash
cd scripts/migrate-sheets
node index.js
```

Expected output:
```
=== Controle de Devoluções — Migration Script ===

Step 1: Exporting from Google Sheets...
Exported N rows from britania
Exported N rows from unilever
Exported N rows from variados

Step 2: Transforming data...
Transformed N total rows

Step 3: Importing N rows to Supabase...
Inserted batch 1 (500 rows)
...

✓ Migration successful: N rows imported.
```

- [ ] **Step 4: Verify in Supabase**

```bash
# In Supabase SQL Editor:
select count(*), aba from notas_fiscais group by aba;
```

Expected: Row counts matching original sheet rows.

- [ ] **Step 5: Final commit**

```bash
cd ../..
git add scripts/
git commit -m "feat: S2 complete — schema, RLS, seed, migration script"
```
