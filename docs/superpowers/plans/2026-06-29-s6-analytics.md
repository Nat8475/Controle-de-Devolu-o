# S6: Analytics (Dashboard + Relatórios + Busca Global) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Prerequisite:** S1 (Foundation) and S2 (Database) must be complete.

**Goal:** Implement three analytics modules — FormDashboard (live KPIs + Recharts charts), FormRelatorios (filtered tabular reports + CSV export), FormBusca (global search across all tables).

**Architecture:** Dashboard uses TanStack Query with `select` aggregation helpers — no dedicated RPC functions needed for MVP, just client-side aggregation over the `notas_fiscais` result set. Relatorios uses the same query stack with date-range filters and a client-side CSV builder. Busca uses Supabase `or` full-text search across notas + other tables and renders results grouped by entity type.

**Tech Stack:** React 18, TanStack Query v5, Recharts 2, Supabase JS v2, shadcn/ui, Tailwind CSS, Lucide React

## Global Constraints

- All S1 constraints apply
- Module guards: `/app/dashboard` → `<RequireModule mod="dashboard">`, `/app/relatorios` → `<RequireModule mod="relatorios">`, `/app/busca` → `<RequireModule mod="busca">`
- Recharts: use `ResponsiveContainer` wrapping all charts; SSR-safe
- Dashboard auto-refreshes every 5 minutes via `refetchInterval: 300_000`
- CSV export: UTF-8 BOM prepended to support Excel on Windows (`﻿`)
- All monetary values formatted `pt-BR` currency (BRL)
- Dark mode: charts use CSS variable colors via `fill` and `stroke` props

---

## File Structure

```
src/
  pages/
    dashboard/
      DashboardPage.tsx        ← layout + data orchestration
      DashboardKPIs.tsx        ← stat cards (large format)
      DashboardCharts.tsx      ← Recharts grid
    relatorios/
      RelatoriosPage.tsx       ← filters + table + export
    busca/
      BuscaPage.tsx            ← search input + grouped results
  hooks/
    useDashboard.ts            ← aggregation queries
    useRelatorio.ts            ← filtered report query + CSV export
    useBusca.ts                ← global search query
```

---

### Task 1: Dashboard Queries

**Files:**
- Create: `src/hooks/useDashboard.ts`

**Interfaces:**
- Produces:
  - `useDashboardStats(periodo: 'dia' | 'semana' | 'mes' | 'ano' | 'total')` → aggregated counts + values
  - `useDashboardTrend()` → last 12 months counts for line chart
  - `useDashboardByAba()` → grouped by aba for donut chart
  - `useDashboardByStatus()` → grouped by status for bar chart

- [ ] **Step 1: Create `src/hooks/useDashboard.ts`**

```typescript
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { NotaFiscal, SupabaseStatus, SupabaseAba } from '@/types/database'

type Periodo = 'dia' | 'semana' | 'mes' | 'ano' | 'total'

function periodoStart(p: Periodo): string | null {
  const now = new Date()
  if (p === 'dia') return new Date(now.setHours(0, 0, 0, 0)).toISOString().slice(0, 10)
  if (p === 'semana') {
    const d = new Date(); d.setDate(d.getDate() - d.getDay())
    return d.toISOString().slice(0, 10)
  }
  if (p === 'mes') return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  if (p === 'ano') return `${now.getFullYear()}-01-01`
  return null
}

export interface DashboardStats {
  total: number
  pendente: number
  em_transferencia: number
  devolvido: number
  cancelado: number
  vendido: number
  totalCaixas: number
  totalValor: number
  mediaDias: number
}

export function useDashboardStats(periodo: Periodo) {
  return useQuery({
    queryKey: ['dashboard-stats', periodo],
    refetchInterval: 300_000,
    queryFn: async (): Promise<DashboardStats> => {
      let q = supabase.from('notas_fiscais').select('*').is('deleted_at', null)
      const start = periodoStart(periodo)
      if (start) q = q.gte('data', start)
      const { data = [] } = await q
      const notas = (data ?? []) as NotaFiscal[]

      const count = (s: SupabaseStatus) => notas.filter(n => n.status === s).length

      const dias = notas
        .filter(n => n.status === 'Devolvido' && n.data)
        .map(n => {
          const criado = new Date(n.created_at ?? n.data).getTime()
          const hoje = Date.now()
          return Math.floor((hoje - criado) / 86400000)
        })

      return {
        total: notas.length,
        pendente: count('Pendente'),
        em_transferencia: count('Em Transferência'),
        devolvido: count('Devolvido'),
        cancelado: count('Cancelado'),
        vendido: count('Vendido'),
        totalCaixas: notas.reduce((s, n) => s + (n.qtd ?? 0), 0),
        totalValor: notas.reduce((s, n) => s + (n.valor_total ?? 0), 0),
        mediaDias: dias.length ? Math.round(dias.reduce((a, b) => a + b, 0) / dias.length) : 0,
      }
    },
  })
}

export interface TrendPoint { mes: string; count: number; valor: number }

export function useDashboardTrend() {
  return useQuery({
    queryKey: ['dashboard-trend'],
    refetchInterval: 300_000,
    queryFn: async (): Promise<TrendPoint[]> => {
      const start = new Date()
      start.setMonth(start.getMonth() - 11)
      start.setDate(1)

      const { data = [] } = await supabase
        .from('notas_fiscais')
        .select('data, valor_total')
        .is('deleted_at', null)
        .gte('data', start.toISOString().slice(0, 10))

      const map = new Map<string, TrendPoint>()
      for (let i = 0; i < 12; i++) {
        const d = new Date()
        d.setMonth(d.getMonth() - (11 - i))
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
        map.set(key, { mes: label, count: 0, valor: 0 })
      }

      for (const n of (data ?? []) as { data: string; valor_total: number | null }[]) {
        const key = n.data.slice(0, 7)
        const point = map.get(key)
        if (point) { point.count++; point.valor += n.valor_total ?? 0 }
      }

      return Array.from(map.values())
    },
  })
}

export interface AbaPoint { aba: string; count: number; valor: number }

export function useDashboardByAba() {
  return useQuery({
    queryKey: ['dashboard-by-aba'],
    refetchInterval: 300_000,
    queryFn: async (): Promise<AbaPoint[]> => {
      const { data = [] } = await supabase
        .from('notas_fiscais')
        .select('aba, valor_total')
        .is('deleted_at', null)

      const map = new Map<string, AbaPoint>()
      for (const n of (data ?? []) as { aba: SupabaseAba; valor_total: number | null }[]) {
        const prev = map.get(n.aba) ?? { aba: n.aba, count: 0, valor: 0 }
        map.set(n.aba, { ...prev, count: prev.count + 1, valor: prev.valor + (n.valor_total ?? 0) })
      }
      return Array.from(map.values())
    },
  })
}
```

---

### Task 2: DashboardKPIs + DashboardCharts

**Files:**
- Create: `src/pages/dashboard/DashboardKPIs.tsx`, `src/pages/dashboard/DashboardCharts.tsx`

**Interfaces:**
- `DashboardKPIs` consumes: `stats: DashboardStats`, `isLoading: boolean`
- `DashboardCharts` consumes: `trend: TrendPoint[]`, `byAba: AbaPoint[]`

- [ ] **Step 1: Create `src/pages/dashboard/DashboardKPIs.tsx`**

```typescript
import { TrendingUp, Package, Truck, CheckCircle, AlertCircle, ShoppingCart, DollarSign, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DashboardStats } from '@/hooks/useDashboard'

interface KPICard {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
}

interface Props { stats: DashboardStats; isLoading: boolean }

export function DashboardKPIs({ stats, isLoading }: Props) {
  const fmt = (n: number) => n.toLocaleString('pt-BR')
  const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const cards: KPICard[] = [
    { label: 'Total NFs', value: fmt(stats.total), icon: Package, color: 'text-[var(--text)]', bg: 'bg-[var(--border)]/30' },
    { label: 'Pendentes', value: fmt(stats.pendente), icon: AlertCircle, color: 'text-warning', bg: 'bg-warning/10' },
    { label: 'Em Transferência', value: fmt(stats.em_transferencia), icon: Truck, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Devolvidas', value: fmt(stats.devolvido), icon: CheckCircle, color: 'text-positive', bg: 'bg-positive/10' },
    { label: 'Vendidas', value: fmt(stats.vendido), icon: ShoppingCart, color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/20' },
    { label: 'Total Caixas', value: fmt(stats.totalCaixas), icon: Package, color: 'text-[var(--text)]', bg: 'bg-[var(--border)]/30' },
    { label: 'Valor Total', value: fmtBRL(stats.totalValor), icon: DollarSign, color: 'text-positive', bg: 'bg-positive/10' },
    { label: 'Média (dias)', value: `${stats.mediaDias}d`, icon: Clock, color: 'text-[var(--text-muted)]', bg: 'bg-[var(--border)]/30' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
      {cards.map(card => (
        <div key={card.label} className={cn('rounded-card p-4', card.bg)}>
          <div className="flex items-start justify-between">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">{card.label}</p>
            <card.icon className={cn('w-4 h-4 opacity-60', card.color)} />
          </div>
          <p className={cn('mt-2 text-xl font-bold font-heading', card.color, isLoading && 'opacity-30')}>
            {isLoading ? '—' : card.value}
          </p>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create `src/pages/dashboard/DashboardCharts.tsx`**

```typescript
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts'
import type { TrendPoint, AbaPoint } from '@/hooks/useDashboard'

const COLORS = ['#2563EB', '#059669', '#D97706', '#7C3AED', '#DC2626']

interface Props {
  trend: TrendPoint[]
  byAba: AbaPoint[]
  isLoading: boolean
}

export function DashboardCharts({ trend, byAba, isLoading }: Props) {
  if (isLoading) return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
      {[1,2].map(i => (
        <div key={i} className="bg-[var(--border)]/20 rounded-card h-64 animate-pulse" />
      ))}
    </div>
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
      {/* Trend line chart */}
      <div className="bg-surface dark:bg-surface-dark rounded-card shadow-soft p-4">
        <h3 className="font-heading font-semibold text-sm text-[var(--text)] mb-4">NFs por Mês (12m)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={trend} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #e2e8f0)" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="var(--text-muted-color, #94a3b8)" />
            <YAxis tick={{ fontSize: 11 }} stroke="var(--text-muted-color, #94a3b8)" />
            <Tooltip
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: 12 }}
              formatter={(v: number) => [v, 'NFs']}
            />
            <Line type="monotone" dataKey="count" stroke="#2563EB" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* By Aba donut chart */}
      <div className="bg-surface dark:bg-surface-dark rounded-card shadow-soft p-4">
        <h3 className="font-heading font-semibold text-sm text-[var(--text)] mb-4">Distribuição por Fornecedor</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={byAba}
              dataKey="count"
              nameKey="aba"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={85}
              paddingAngle={3}
            >
              {byAba.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: 12 }}
              formatter={(v: number, _: string, props: { payload?: { aba?: string } }) => [v, props.payload?.aba ?? '']}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Valor por Aba bar chart */}
      <div className="bg-surface dark:bg-surface-dark rounded-card shadow-soft p-4 md:col-span-2">
        <h3 className="font-heading font-semibold text-sm text-[var(--text)] mb-4">Valor Total por Fornecedor (R$)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={byAba} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #e2e8f0)" />
            <XAxis dataKey="aba" tick={{ fontSize: 12 }} stroke="var(--text-muted-color, #94a3b8)" />
            <YAxis tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} stroke="var(--text-muted-color, #94a3b8)" />
            <Tooltip
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: 12 }}
              formatter={(v: number) => [v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 'Valor']}
            />
            <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
              {byAba.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
```

---

### Task 3: DashboardPage Assembly

**Files:**
- Create: `src/pages/dashboard/DashboardPage.tsx`

**Interfaces:**
- Produces: `/app/dashboard` route

- [ ] **Step 1: Create `src/pages/dashboard/DashboardPage.tsx`**

```typescript
import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDashboardStats, useDashboardTrend, useDashboardByAba } from '@/hooks/useDashboard'
import { DashboardKPIs } from './DashboardKPIs'
import { DashboardCharts } from './DashboardCharts'

type Periodo = 'dia' | 'semana' | 'mes' | 'ano' | 'total'

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: 'dia', label: 'Hoje' },
  { value: 'semana', label: 'Esta semana' },
  { value: 'mes', label: 'Este mês' },
  { value: 'ano', label: 'Este ano' },
  { value: 'total', label: 'Todos' },
]

export default function DashboardPage() {
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const stats = useDashboardStats(periodo)
  const trend = useDashboardTrend()
  const byAba = useDashboardByAba()

  function refetchAll() {
    stats.refetch()
    trend.refetch()
    byAba.refetch()
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-surface dark:bg-surface-dark">
        <h2 className="font-heading font-semibold text-[var(--text)]">Dashboard</h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-btn overflow-hidden border border-[var(--border)]">
            {PERIODOS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriodo(p.value)}
                className={`px-2.5 py-1 text-xs transition-colors ${
                  periodo === p.value
                    ? 'bg-primary text-white'
                    : 'text-[var(--text-muted)] hover:bg-[var(--border)]/50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="icon" onClick={refetchAll} title="Recarregar">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <DashboardKPIs stats={stats.data ?? {
        total: 0, pendente: 0, em_transferencia: 0, devolvido: 0, cancelado: 0,
        vendido: 0, totalCaixas: 0, totalValor: 0, mediaDias: 0,
      }} isLoading={stats.isLoading} />

      {/* Charts */}
      <DashboardCharts
        trend={trend.data ?? []}
        byAba={byAba.data ?? []}
        isLoading={trend.isLoading || byAba.isLoading}
      />
    </div>
  )
}
```

- [ ] **Step 2: Add route**

```typescript
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'))
<Route path="/app/dashboard" element={
  <RequireModule mod="dashboard">
    <Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>
  </RequireModule>
} />
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add FormDashboard with KPIs and Recharts analytics"
```

---

### Task 4: Relatórios Module

**Files:**
- Create: `src/hooks/useRelatorio.ts`, `src/pages/relatorios/RelatoriosPage.tsx`

**Interfaces:**
- Produces: `/app/relatorios` — filtered table with CSV export

- [ ] **Step 1: Create `src/hooks/useRelatorio.ts`**

```typescript
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { NotaFiscal, SupabaseStatus, SupabaseAba } from '@/types/database'

export interface RelatorioFilters {
  aba: SupabaseAba | ''
  status: SupabaseStatus | ''
  dataIni: string
  dataFim: string
}

export function useRelatorio(filters: RelatorioFilters) {
  return useQuery({
    queryKey: ['relatorio', filters],
    queryFn: async () => {
      let q = supabase.from('notas_fiscais').select('*').is('deleted_at', null)
      if (filters.aba) q = q.eq('aba', filters.aba)
      if (filters.status) q = q.eq('status', filters.status)
      if (filters.dataIni) q = q.gte('data', filters.dataIni)
      if (filters.dataFim) q = q.lte('data', filters.dataFim)
      q = q.order('data', { ascending: false })
      const { data, error } = await q
      if (error) throw error
      return data as NotaFiscal[]
    },
  })
}

export function exportCSV(data: NotaFiscal[], filename = 'relatorio') {
  const headers = ['NFD','NF','Data','Fornecedor','Aba','Tipo','Motivo','Descrição','Qtd','Valor Unit.','Valor Total','Status','Frete Tipo','Frete Valor','Observações']
  const rows = data.map(n => [
    n.nfd, n.nf, n.data, n.fornecedor, n.aba, n.tipo ?? '', n.motivo ?? '',
    n.descricao ?? '', n.qtd ?? '', n.valor_unitario ?? '', n.valor_total ?? '',
    n.status, n.frete_tipo ?? '', n.frete_valor ?? '', (n.obs ?? '').replace(/\n/g, ' '),
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))

  const csv = '﻿' + [headers.join(';'), ...rows].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 2: Create `src/pages/relatorios/RelatoriosPage.tsx`**

```typescript
import { useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRelatorio, exportCSV } from '@/hooks/useRelatorio'
import type { RelatorioFilters } from '@/hooks/useRelatorio'
import type { SupabaseAba, SupabaseStatus } from '@/types/database'

const EMPTY: RelatorioFilters = { aba: '', status: '', dataIni: '', dataFim: '' }

export default function RelatoriosPage() {
  const [filters, setFilters] = useState<RelatorioFilters>(EMPTY)
  const [applied, setApplied] = useState<RelatorioFilters>(EMPTY)
  const { data = [], isLoading } = useRelatorio(applied)

  function set(key: keyof RelatorioFilters, value: string) {
    setFilters(f => ({ ...f, [key]: value }))
  }

  const totalCaixas = data.reduce((s, n) => s + (n.qtd ?? 0), 0)
  const totalValor = data.reduce((s, n) => s + (n.valor_total ?? 0), 0)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-surface dark:bg-surface-dark">
        <h2 className="font-heading font-semibold text-[var(--text)]">Relatórios</h2>
        <Button variant="outline" size="sm" onClick={() => exportCSV(data)} disabled={data.length === 0}>
          <Download className="w-4 h-4 mr-1.5" />Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="p-4 border-b border-[var(--border)] grid grid-cols-2 sm:grid-cols-5 gap-3">
        <select value={filters.aba} onChange={e => set('aba', e.target.value)}
          className="rounded-btn border border-[var(--border)] bg-surface dark:bg-surface-dark text-[var(--text)] text-sm px-2 py-1.5">
          <option value="">Todos fornecedores</option>
          {['Britania','Unilever','Variados'].map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        <select value={filters.status} onChange={e => set('status', e.target.value)}
          className="rounded-btn border border-[var(--border)] bg-surface dark:bg-surface-dark text-[var(--text)] text-sm px-2 py-1.5">
          <option value="">Todos os status</option>
          {['Pendente','Em Transferência','Devolvido','Cancelado','Vendido'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <Input type="date" value={filters.dataIni} onChange={e => set('dataIni', e.target.value)} className="text-sm" placeholder="Data início" />
        <Input type="date" value={filters.dataFim} onChange={e => set('dataFim', e.target.value)} className="text-sm" placeholder="Data fim" />

        <div className="flex gap-2">
          <Button size="sm" className="bg-primary flex-1" onClick={() => setApplied({ ...filters })}>
            Gerar
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setFilters(EMPTY); setApplied(EMPTY) }}>
            Limpar
          </Button>
        </div>
      </div>

      {/* Summary */}
      {data.length > 0 && (
        <div className="px-4 py-2 bg-[var(--border)]/20 border-b border-[var(--border)] flex gap-6 text-sm">
          <span className="text-[var(--text-muted)]"><strong className="text-[var(--text)]">{data.length}</strong> NFs</span>
          <span className="text-[var(--text-muted)]"><strong className="text-[var(--text)]">{totalCaixas.toLocaleString('pt-BR')}</strong> caixas</span>
          <span className="text-[var(--text-muted)]"><strong className="text-positive">{totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></span>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-[var(--text-muted)] text-sm">Gerando relatório...</div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-[var(--text-muted)]">
            <FileText className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">Aplique os filtros e clique em Gerar para ver o relatório.</p>
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--border)]/30">
                {['NFD','NF','Data','Fornecedor','Tipo','Motivo','Qtd','Valor Total','Status'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-muted)] uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(n => (
                <tr key={n.id} className="border-b border-[var(--border)] hover:bg-[var(--border)]/30">
                  <td className="px-3 py-1.5 font-mono">{n.nfd}</td>
                  <td className="px-3 py-1.5 font-mono">{n.nf}</td>
                  <td className="px-3 py-1.5">{new Date(n.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                  <td className="px-3 py-1.5">{n.fornecedor}</td>
                  <td className="px-3 py-1.5 text-[var(--text-muted)]">{n.tipo ?? '—'}</td>
                  <td className="px-3 py-1.5 text-[var(--text-muted)]">{n.motivo ?? '—'}</td>
                  <td className="px-3 py-1.5 text-right">{n.qtd}</td>
                  <td className="px-3 py-1.5 text-right font-medium">
                    {n.valor_total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="px-3 py-1.5">
                    <span className="text-xs bg-[var(--border)]/50 px-2 py-0.5 rounded-badge">{n.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add route**

```typescript
const RelatoriosPage = lazy(() => import('@/pages/relatorios/RelatoriosPage'))
<Route path="/app/relatorios" element={
  <RequireModule mod="relatorios">
    <Suspense fallback={<PageLoader />}><RelatoriosPage /></Suspense>
  </RequireModule>
} />
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add FormRelatorios with filters and CSV export"
```

---

### Task 5: Busca Global Module

**Files:**
- Create: `src/hooks/useBusca.ts`, `src/pages/busca/BuscaPage.tsx`

**Interfaces:**
- Produces: `/app/busca` — debounced search across notas, comentários, transferências

- [ ] **Step 1: Create `src/hooks/useBusca.ts`**

```typescript
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { NotaFiscal } from '@/types/database'

export interface BuscaResults {
  notas: NotaFiscal[]
}

export function useBusca(termo: string) {
  return useQuery({
    queryKey: ['busca', termo],
    enabled: termo.trim().length >= 2,
    staleTime: 30_000,
    queryFn: async (): Promise<BuscaResults> => {
      const t = termo.trim()

      const { data: notas } = await supabase
        .from('notas_fiscais')
        .select('*')
        .is('deleted_at', null)
        .or(`nfd.ilike.%${t}%,nf.ilike.%${t}%,fornecedor.ilike.%${t}%,descricao.ilike.%${t}%,obs.ilike.%${t}%,motivo.ilike.%${t}%`)
        .limit(50)
        .order('data', { ascending: false })

      return { notas: (notas ?? []) as NotaFiscal[] }
    },
  })
}
```

- [ ] **Step 2: Create `src/pages/busca/BuscaPage.tsx`**

```typescript
import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Package } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useBusca } from '@/hooks/useBusca'
import { cn } from '@/lib/utils'

function useDebounce(value: string, delay = 350) {
  const [dv, setDv] = useState(value)
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout>>()
  const update = useCallback((v: string) => {
    clearTimeout(timer)
    const t = setTimeout(() => setDv(v), delay)
    setTimer(t)
  }, [delay])
  return [dv, update] as const
}

export default function BuscaPage() {
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [debounced, setDebounced] = useDebounce('')
  const { data, isLoading } = useBusca(debounced)

  function handleChange(v: string) {
    setInput(v)
    setDebounced(v)
  }

  const notas = data?.notas ?? []
  const hasResults = notas.length > 0
  const isSearching = debounced.trim().length >= 2

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="font-heading text-xl font-bold text-[var(--text)] mb-6">Busca Global</h2>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
        <Input
          value={input}
          onChange={e => handleChange(e.target.value)}
          placeholder="NFD, NF, fornecedor, descrição, motivo..."
          className="pl-10 text-base"
          autoFocus
        />
      </div>

      {!isSearching && (
        <p className="text-[var(--text-muted)] text-sm">Digite ao menos 2 caracteres para buscar.</p>
      )}

      {isSearching && isLoading && (
        <p className="text-[var(--text-muted)] text-sm">Buscando...</p>
      )}

      {isSearching && !isLoading && !hasResults && (
        <p className="text-[var(--text-muted)] text-sm">Nenhum resultado para "<strong>{debounced}</strong>".</p>
      )}

      {hasResults && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-primary" />
            <h3 className="font-medium text-sm text-[var(--text)]">Notas Fiscais ({notas.length})</h3>
          </div>
          <div className="space-y-2">
            {notas.map(n => (
              <button
                key={n.id}
                className="w-full text-left bg-surface dark:bg-surface-dark rounded-card p-3 border border-[var(--border)] hover:border-primary/40 hover:shadow-soft transition-all"
                onClick={() => navigate('/app/notas', { state: { openId: n.id } })}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-medium text-[var(--text)]">{n.nfd}</span>
                  <span className={cn('text-xs px-2 py-0.5 rounded-badge', {
                    'bg-warning/15 text-warning': n.status === 'Pendente',
                    'bg-primary/15 text-primary': n.status === 'Em Transferência',
                    'bg-positive/15 text-positive': n.status === 'Devolvido',
                    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300': n.status === 'Vendido',
                    'bg-[var(--border)]/50 text-[var(--text-muted)]': n.status === 'Cancelado',
                  })}>
                    {n.status}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {n.fornecedor} — NF {n.nf} — {new Date(n.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                </p>
                {n.descricao && (
                  <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-1">{n.descricao}</p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Add route**

```typescript
const BuscaPage = lazy(() => import('@/pages/busca/BuscaPage'))
<Route path="/app/busca" element={
  <RequireModule mod="busca">
    <Suspense fallback={<PageLoader />}><BuscaPage /></Suspense>
  </RequireModule>
} />
```

- [ ] **Step 4: Install Recharts**

```bash
npm install recharts
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: S6 complete — Dashboard, Relatórios, and Busca Global"
```
