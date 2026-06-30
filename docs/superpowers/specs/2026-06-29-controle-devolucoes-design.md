# Design Spec — Controle de Devoluções v7.0

**Data:** 2026-06-29
**Status:** Aprovado para implementação
**Escopo:** Migração completa do sistema Google Apps Script + Google Sheets para React + Vite + Supabase + Cloudflare R2 + Vercel

---

## 1. Visão Geral

Sistema interno de controle de devoluções de produtos a fornecedores (Britania, Unilever, Fornecedores Variados). A versão atual roda em Google Apps Script com Google Sheets como banco de dados. Esta spec define a migração completa para um stack moderno com todos os 14+ módulos preservados.

**Fornecedores ativos:** Britania · Unilever · Fornecedores Variados

---

## 2. Stack Técnico

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite + TypeScript |
| UI Components | shadcn/ui + Tailwind CSS |
| Animações | Framer Motion |
| Ícones | Lucide React |
| Roteamento | React Router v6 |
| Server state | TanStack Query |
| Client state | Zustand |
| Auth + DB | Supabase (PostgreSQL + RLS + Auth) |
| Storage | Cloudflare R2 |
| E-mail | Resend via Supabase Edge Functions |
| Hosting | Vercel |

Todos os serviços utilizam planos gratuitos: Vercel Hobby, Supabase Free, Cloudflare R2 Free, Resend Free (3.000 e-mails/mês).

---

## 3. Autenticação

- Supabase Auth com **e-mail + senha**
- Sessão persistida via Supabase client
- Usuários sem cargo atribuído são bloqueados após login (redirecionados para tela de acesso negado)
- Admin tem acesso irrestrito a todos os módulos

---

## 4. Schema de Dados (PostgreSQL)

### 4.1 RBAC

```sql
profiles (
  id uuid references auth.users PRIMARY KEY,
  email text,
  nome text,
  avatar_url text,
  created_at timestamptz DEFAULT now()
)

cargos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
)

cargo_modulos (
  cargo_id uuid references cargos,
  modulo text,   -- 'notas'|'lancamento'|'email'|'transferencias'|'relatorios'|'auditoria'|'backup'|'configuracoes'|'dashboard'
  PRIMARY KEY (cargo_id, modulo)
)

usuario_cargos (
  user_id uuid references profiles,
  cargo_id uuid references cargos,
  atribuido_por uuid references profiles,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id)
)
```

### 4.2 Notas Fiscais

```sql
notas_fiscais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nfd text NOT NULL,
  nf text NOT NULL,
  data date NOT NULL,
  fornecedor text NOT NULL,
  aba text NOT NULL CHECK (aba IN ('Britania', 'Unilever', 'Variados')),
  tipo text,
  motivo text,
  descricao text,
  qtd integer DEFAULT 0,
  valor_unitario numeric(12,2) DEFAULT 0,
  valor_total numeric(12,2) GENERATED ALWAYS AS (qtd * valor_unitario) STORED,
  status text NOT NULL DEFAULT 'Pendente'
    CHECK (status IN ('Pendente','Em Transferência','Devolvido','Cancelado','Vendido')),
  obs text,
  responsavel_id uuid references profiles,
  frete_tipo text CHECK (frete_tipo IN ('Tabela','Valor+ICMS','Valor','Cortesia')),
  frete_valor numeric(12,2),
  dias_armazem integer DEFAULT 0,
  anexo_url text,           -- URL pública do R2
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz    -- soft delete para lixeira
)
```

### 4.3 Transferências

```sql
transferencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_fiscal_id uuid references notas_fiscais,
  nfd text,
  nf text,
  tipo text,
  caixas integer,
  valor numeric(12,2),
  num_pedido text,
  agendamento timestamptz,
  status text DEFAULT 'Ativa' CHECK (status IN ('Ativa','Concluída','Cancelada')),
  created_at timestamptz DEFAULT now()
)
```

### 4.4 Fotos e Comentários

```sql
fotos_nf (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_fiscal_id uuid references notas_fiscais,
  url text NOT NULL,        -- URL pública do R2
  r2_key text NOT NULL,     -- chave interna no bucket R2
  nome text,
  ordem integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
)

comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_fiscal_id uuid references notas_fiscais,
  user_id uuid references profiles,
  texto text NOT NULL,
  created_at timestamptz DEFAULT now()
)

respostas_fornecedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_fiscal_id uuid references notas_fiscais,
  user_id uuid references profiles,
  texto text NOT NULL,
  created_at timestamptz DEFAULT now()
)
```

### 4.5 E-mails, Auditoria, Config, Backup

```sql
emails_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_ids uuid[],
  destinatarios text[],
  assunto text,
  corpo_html text,
  status text DEFAULT 'enviado' CHECK (status IN ('enviado','agendado','erro')),
  agendado_para timestamptz,
  enviado_em timestamptz,
  created_by uuid references profiles,
  created_at timestamptz DEFAULT now()
)

audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid references profiles,
  acao text NOT NULL,        -- 'create'|'update'|'delete'|'login'|'export'...
  tabela text,
  registro_id uuid,
  dados_antes jsonb,
  dados_depois jsonb,
  created_at timestamptz DEFAULT now()
)

configs (
  chave text PRIMARY KEY,
  valor jsonb,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid references profiles
)

backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tamanho_bytes bigint,
  r2_key text NOT NULL,
  created_by uuid references profiles,
  created_at timestamptz DEFAULT now()
)
```

### 4.6 Row Level Security

- `notas_fiscais`: SELECT para módulo `notas`; INSERT para `lancamento`; UPDATE para `notas` ou `lancamento`; DELETE bloqueado (soft delete apenas)
- `transferencias`: SELECT/UPDATE para `transferencias`
- `audit_log`: SELECT apenas para `auditoria`; INSERT via service role
- `configs`: SELECT/UPDATE apenas para `configuracoes` e admin
- `backups`: SELECT/INSERT apenas para `backup` e admin
- Admin (flag `is_admin` em `profiles`): bypass total via RLS policy

---

## 5. Cloudflare R2 — Storage

### Estrutura do bucket

```
notas/{aba}/{nfd}/
  ├── anexo-principal.{ext}
  ├── foto-1.jpg
  └── foto-2.jpg
pdfs-exportados/
  └── {timestamp}-{nfds}.pdf
backups/
  └── backup-{timestamp}.json
```

### Upload flow

1. Frontend solicita URL pré-assinada via Edge Function `r2-presign`
2. Edge Function gera URL pré-assinada com TTL de 5 minutos
3. Frontend faz PUT direto ao R2 com a URL
4. Frontend salva a URL pública em `fotos_nf.url` ou `notas_fiscais.anexo_url`

---

## 6. Supabase Edge Functions

| Função | Trigger | Responsabilidade |
|--------|---------|-----------------|
| `send-email` | HTTP POST | Envia e-mail via Resend, grava em `emails_log` |
| `schedule-email` | HTTP POST | Cria agendamento em `emails_log`, dispara no horário via cron |
| `r2-presign` | HTTP POST | Gera URL pré-assinada R2 para upload |
| `generate-pdf` | HTTP POST | Gera PDF de Doc. Carga / Relatório / Exportação, salva no R2 |
| `alert-delays` | Cron diário | Busca NFs com dias_armazem acima do limite → dispara alerta via Resend |

---

## 7. Módulos e Rotas

### Shell (Layout raiz)

```
/app/*
```

Layout: Topbar (título, Ctrl+K, dark mode, avatar) + Sidebar (nav com badges) + `<Outlet />`.
Mobile: sidebar vira bottom navigation com 5 itens principais.
Hotkeys globais: Alt+1–6 para navegação, Ctrl+K para command palette.

### Rotas completas

```
/login
/acesso-negado
/app/home                 ← Hub: 6 KPIs, Conquest of Month, Quick Notes
/app/notas                ← Listagem central
/app/lancamento           ← Nova NF (tabs Individual / Lote)
/app/email                ← Envio de e-mail de devolução
/app/transferencias       ← Gestão de transferências
/app/frete                ← Wizard: programar frete
/app/reabertura           ← Wizard: reabrir NFs
/app/venda                ← Wizard: baixa em venda
/app/exportar-pdf         ← Wizard: exportar PDF
/app/dashboard            ← Analytics por fornecedor
/app/relatorios           ← 5 tipos de relatório (máquina de estados)
/app/busca                ← Busca cross-abas
/app/auditoria/:subtela   ← 10 sub-telas via tabs
/app/backup               ← Backup e restauração
/app/configuracoes/:hub   ← 4 hubs com tabs
```

### Módulo: Notas (FormNotas)

- Tabela de NFs com paginação server-side via TanStack Query
- Filtros: status, aba (fornecedor), data início/fim, sem frete, busca fonética — persistidos em Zustand + localStorage
- 6 KPIs colapsáveis com animação countUp — visibilidade persistida
- Column picker, density selector (compacta/normal/confortável)
- Seleção múltipla com bulk bar: Devolução, Venda, Programar Frete, E-mail Dev., Doc. Carga
- Context menu (clique direito) com ações rápidas
- Undo bar deslizante 15s após ações destrutivas
- Modal de detalhe: dados gerais editáveis, comentários, respostas fornecedor, galeria de fotos, etiqueta, QR code
- 20+ atalhos de teclado (F5, Esc, Space, A, D, E, F, Ctrl+D, /, ←→)
- Confirmação de recebimento fornecedor (quando status = Devolvido)

### Módulo: Lançamento (FormLancamento)

- Tabs: Individual / Lote
- Importação de XML de NF-e: parse automático preenche NF, Data, Fornecedor, Valor
- Fornecedor em uppercase automático
- Upload de fotos de avaria: drop zone, preview grid, máx 5MB por foto, upload via R2
- Autocomplete de fornecedores para aba Variados (lista do banco)
- Rascunho auto-save a cada 3 segundos em localStorage
- Detecção de duplicata por NF antes de salvar

### Módulo: E-mail (FormEmailDevolucao)

- Pré-preenchimento via `state` do React Router (NFDs da bulk bar)
- Drop zone para comunicados (PDF/imagens), lista com remoção individual
- Campos Para / CC / BCC com aviso de duplicata
- Preview do e-mail em modal antes de enviar
- Agendar envio (data/hora) via Edge Function `schedule-email`
- Envio via Resend, registro em `emails_log`

### Módulo: Transferências (FormTransferencias)

- Lista de transferências ativas com ordenação configurável
- Colunas visíveis configuráveis (persistidas em localStorage)
- Ações por linha: Dar Baixa, Cancelar, Reagendar
- Bulk: Cancelar Selecionados
- Doc. Carga PDF gerado via Edge Function `generate-pdf`
- Após baixa/cancelamento: navega de volta para `/app/notas` com filtro de aba aplicado

### Módulos Wizard (Frete, Reabertura, Venda, Exportar PDF)

Todos seguem o padrão de 3 passos com máquina de estados interna:

```
Passo 1: Input (busca NF ou chips de NFDs)
Passo 2: Preview (tabela de confirmação)
Passo 3: Resultado (sucesso/erro + ação pós-conclusão)
```

Venda inclui auto-print do Doc. Carga no Passo 3.
Exportar PDF inclui link de download do arquivo gerado no R2.

### Módulo: Dashboard (FormDashboard)

- Pill tabs por fornecedor (Britania / Unilever / Variados)
- 5 KPIs: Total Pendente, Total Devolvido, Em Transferência, Média Dias Armazém, Total Geral
- Gráficos com Recharts: Donut (status), Stacked Bar (mensal), Line (3/6/12m selecionável)
- Tabela de NFs recentes com status colorido

### Módulo: Relatórios (FormRelatorios)

Máquina de estados: `SELECAO → CONFIGURAR → PROCESSANDO → RESULTADO → SELECAO`
- 5 tipos: Mensal, Semanal, Diário, Por Fornecedor, Pendentes
- Dropdown dinâmico de fornecedores para relatório por fornecedor
- Resultado exportável em PDF via Edge Function `generate-pdf`

### Módulo: Busca (FormBusca)

- Busca por NF, fornecedor ou descrição em todas as abas simultaneamente
- Resultado clicável que navega para `/app/notas` com filtro aplicado
- Integrado ao Command Palette (Ctrl+K) do shell

### Módulo: Auditoria (FormAuditoria)

10 sub-telas via tabs:

| Sub-tela | Conteúdo |
|----------|---------|
| Histórico | NFs excluídas + histórico completo |
| E-mails | Log de e-mails de `emails_log` |
| Log | Registro de operações de `audit_log` |
| Acesso | Log de logins/acessos |
| Scorecard | Métricas por usuário |
| SLA | Análise de dias médios por status |
| Comparativo | Comparação entre períodos |
| Lixeira | NFs com `deleted_at` não nulo (recuperáveis) |
| Log Export | Histórico de PDFs gerados |
| Seleção | Tela inicial de seleção |

Acesso restrito ao módulo `auditoria` por RLS.

### Módulo: Backup (FormBackup)

- Status card: exibe data/hora do último backup ou aviso de ausência
- Criar backup: serializa `notas_fiscais` + `transferencias` + dados relacionados → JSON → upload para R2 → grava metadados em `backups`
- Restaurar: seleciona backup da lista → confirma → trunca tabelas e reimporta
- Restrito ao módulo `backup`

### Módulo: Configurações (FormConfiguracoes)

4 hubs com tabs, cada um gerenciando uma área:

| Hub | Tabs |
|-----|------|
| E-mails e Comunicação | Destinatários, CC/BCC, Assinaturas, Templates, Webhook |
| Cores e Visual | Cores de status, cores do header |
| Sistema | Diagnóstico, Manutenção (limpeza de cache), Instruções |
| Controle de Acesso | Visão geral, Cargos (criar/editar), Usuários (atribuir cargo) |

Dados armazenados em `configs` (chave-valor JSON). Restrito ao módulo `configuracoes`.

---

## 8. Design System

```
Cores:
  --primary:    #2563EB  (azul — ação principal)
  --positive:   #059669  (verde — sucesso, ação positiva)
  --danger:     #DC2626  (vermelho — erro, destrutivo)
  --warning:    #D97706  (âmbar — aviso)
  --bg:         #F8FAFC  (off-white — fundo da aplicação)
  --surface:    #FFFFFF  (branco — cards, modais)
  --dark-bg:    #0F172A  (dark mode — fundo)
  --dark-surface: #1E293B (dark mode — cards)

Tipografia:
  Poppins (400/600/700) → headings, labels de KPI
  Open Sans (400/500)   → corpo, tabelas, campos

Estilo: Soft UI Evolution
  box-shadow: 0 2px 8px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)
  border-radius: 12px (cards/modais), 8px (botões/inputs), 6px (badges)
  transition: 200ms ease

Botões (6 variantes):
  primary, secondary, danger, ghost, outline, icon
  Todos com efeito ripple via Framer Motion

Toast:
  Posição: bottom-center
  Tipos: ok (verde), err (vermelho), warn (âmbar), info (azul)
  Duração padrão: 3000ms, auto-dismiss com animação

Dark mode:
  Toggle na topbar, persiste em localStorage('cdv_dark_mode')
  Implementado via classe 'dark' no <html> + variáveis CSS

Command Palette (Ctrl+K):
  Busca fuzzy entre todas as rotas e ações disponíveis
  Implementado com cmdk (shadcn/ui Command component)

Animações globais:
  fadeIn, slideUp, slideDown, scaleIn (Framer Motion variants)
  countUp para valores numéricos em KPIs
  Undo bar deslizante (slideUp de baixo)
```

---

## 9. Migração Google Sheets → Supabase

### Script de migração (`scripts/migrate-sheets/`)

```
index.js           ← orquestra as 3 etapas
export-sheets.js   ← Google Sheets API v4 → lê abas Britania, Unilever, Variados → JSON
transform.js       ← normaliza colunas (mapa col1→nfd, col2→nf, ...) → valida dados
import-supabase.js ← batch insert em notas_fiscais (lotes de 500 linhas)
```

**Pré-requisitos:**
- Credenciais de Service Account Google (JSON)
- `SUPABASE_URL` e `SUPABASE_SERVICE_KEY` em `.env`
- ID da planilha Google Sheets em `.env`

**Campos mapeados:**

| Col Sheets | Campo Supabase |
|-----------|----------------|
| NFD (1) | nfd |
| NF (2) | nf |
| Data (3) | data |
| Fornecedor (4) | fornecedor |
| Tipo (5) | tipo |
| Motivo (6) | motivo |
| Descrição (7) | descricao |
| Qtd (8) | qtd |
| Valor Unitário (9) | valor_unitario |
| Status (11) | status |
| Obs (15) | obs |
| Resp (16) | responsavel_id (match por nome → profiles) |
| Anexo (17) | anexo_url |
| DiasArmaz (18) | dias_armazem |
| FreteTipo (19) | frete_tipo |
| FreteValor (20) | frete_valor |
| aba da planilha | aba |

**Dados não migrados (descartados por incompatibilidade):**
- `chkPend`, `chkDev`, `chkVenda` (cols 12–14) — substituídos pelo campo `status`
- URLs do Google Drive (`Anexo` col 17) — arquivos precisam ser re-uploaded manualmente ao R2 se necessário

---

## 10. Decomposição em Sub-projetos para Implementação Paralela

### Fase 1 (Paralelos — Fundação)

| Sub-projeto | Conteúdo |
|-------------|---------|
| **S1** Foundation | Scaffold Vite + React + TypeScript + Tailwind + shadcn/ui, design system tokens, componentes base (Button, Toast, Modal, CommandPalette), shell (Topbar + Sidebar + Outlet), roteamento, Supabase client, auth (login/logout/sessão), guard de rotas por módulo RBAC |
| **S2** Database | Schema SQL completo, migrations, RLS policies, seed de dados de teste, script de migração Google Sheets → Supabase |

### Fase 2 (Paralelos — dependem de S1 + S2 finalizados)

| Sub-projeto | Módulos incluídos |
|-------------|------------------|
| **S3** Core | `/app/notas` (FormNotas completo), `/app/lancamento` (FormLancamento com XML + fotos) |
| **S4** Operações | `/app/transferencias`, `/app/frete`, `/app/reabertura`, `/app/venda` |
| **S5** Comunicação | `/app/email` (FormEmailDevolucao + Resend), `/app/exportar-pdf` (Edge Function generate-pdf + R2) |
| **S6** Analytics | `/app/dashboard` (Recharts), `/app/relatorios`, `/app/busca` |
| **S7** Admin | `/app/auditoria` (10 sub-telas), `/app/backup`, `/app/configuracoes` (4 hubs) |

---

## 11. Variáveis de Ambiente

```env
# Supabase
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Supabase Edge Functions (server-side only)
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=

# Script de migração
GOOGLE_SHEETS_ID=
GOOGLE_SERVICE_ACCOUNT_JSON=
```

---

*Spec aprovada em 2026-06-29. Implementação via writing-plans → agentes paralelos.*
