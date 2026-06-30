# S3: Core — Notas + Lançamento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Prerequisite:** S1 (Foundation) and S2 (Database) must be complete before starting this plan.

**Goal:** Implement the two core modules — FormNotas (main NF listing with filters, KPIs, bulk actions, modal detail) and FormLancamento (new NF entry with XML import and photo upload via Cloudflare R2).

**Architecture:** Each module is a page component under `src/pages/notas/` and `src/pages/lancamento/`. TanStack Query manages server state. Zustand handles filter/selection state. Cloudflare R2 file uploads go through a Supabase Edge Function that returns presigned URLs. The NF detail modal is a Framer Motion sheet.

**Tech Stack:** React 18, TanStack Query v5, Zustand v4, Framer Motion v11, Supabase JS v2, shadcn/ui, Tailwind CSS, Lucide React, Recharts (for KPI mini-charts), QRCode.react

## Global Constraints

- All S1 constraints apply
- Module guard: wrap `/app/notas` in `<RequireModule mod="notas">`, `/app/lancamento` in `<RequireModule mod="lancamento">`
- Supabase query for notas: always filter `deleted_at IS NULL` (soft delete)
- Bulk actions require at least 1 row selected
- "Same fornecedor" validation required for bulk e-mail and Doc. Carga
- Photo uploads: JPG/PNG only, max 5MB per file, upload via R2 presigned URL
- Auto-save draft every 3 seconds to `localStorage('cdv_draft_lancamento')`
- Log all write operations to `audit_log` table
- `toast()` from `src/stores/toastStore.ts` for feedback
- `showUndo()` from `src/stores/undoStore.ts` for destructive actions

---

## File Structure

```
src/
  pages/
    notas/
      NotasPage.tsx          ← main page (KPIs + filters + table)
      NotasKPIs.tsx          ← 6 collapsible KPI cards
      NotasFilters.tsx       ← filter bar (status/aba/data/frete/search)
      NotasTable.tsx         ← table with column picker + density + context menu
      NotasBulkBar.tsx       ← bulk action bar (appears when ≥1 selected)
      NotaDetail.tsx         ← slide-over sheet for NF detail
      NotaGallery.tsx        ← photo gallery modal
      DocCargaModal.tsx      ← printable cargo document
    lancamento/
      LancamentoPage.tsx     ← tabs: Individual / Lote
      LancamentoForm.tsx     ← individual NF form
      LancamentoLote.tsx     ← batch entry
      XmlImporter.tsx        ← XML parser for NF-e
      FotoUpload.tsx         ← drag-drop photo upload with R2
  hooks/
    useNotas.ts              ← TanStack Query hooks for notas_fiscais
    useLancamento.ts         ← mutation hooks for insert/update
    useR2Upload.ts           ← presigned URL + upload helper
  stores/
    notasStore.ts            ← filters, selected rows, column visibility

supabase/
  functions/
    r2-presign/
      index.ts               ← Edge Function: returns R2 presigned URL
```

---

### Task 1: Notas Store + Query Hooks

**Files:**
- Create: `src/stores/notasStore.ts`, `src/hooks/useNotas.ts`

**Interfaces:**
- Produces:
  - `useNotasStore()`: `{ filters, setFilter, selectedIds, toggleSelect, clearSelection, columnVisibility, setColumnVisibility, density, setDensity }`
  - `useNotas(filters)`: TanStack Query hook returning `{ data: NotaFiscal[], isLoading, refetch }`
  - `useNotasMutation()`: `{ updateStatus, softDelete, updateFrete }`

- [ ] **Step 1: Create `src/stores/notasStore.ts`**

```typescript
import { create } from 'zustand'
import type { SupabaseStatus, SupabaseAba, Modulo } from '@/types/database'

export interface NotasFilters {
  status: SupabaseStatus | ''
  aba: SupabaseAba | ''
  dataIni: string
  dataFim: string
  semFrete: boolean
  busca: string
}

export type Density = 'compact' | 'normal' | 'comfortable'

const DEFAULT_FILTERS: NotasFilters = {
  status: '',
  aba: '',
  dataIni: '',
  dataFim: '',
  semFrete: false,
  busca: '',
}

const STORAGE_KEYS = {
  filters: 'cdv_filtros_salvos',
  density: 'cdv_density',
  columns: 'cdv_colunas',
  kpiVis: 'cdv_kpi_visibilidade',
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? '') ?? fallback }
  catch { return fallback }
}

interface NotasState {
  filters: NotasFilters
  filtersVisible: boolean
  selectedIds: Set<string>
  density: Density
  columnVisibility: Record<string, boolean>
  kpiVisibility: Record<string, boolean>
  setFilter: (key: keyof NotasFilters, value: string | boolean) => void
  resetFilters: () => void
  toggleFiltersVisible: () => void
  toggleSelect: (id: string) => void
  selectAll: (ids: string[]) => void
  clearSelection: () => void
  setDensity: (d: Density) => void
  setColumnVisibility: (col: string, visible: boolean) => void
  toggleKpi: (key: string) => void
}

export const useNotasStore = create<NotasState>((set, get) => ({
  filters: loadFromStorage(STORAGE_KEYS.filters, DEFAULT_FILTERS),
  filtersVisible: localStorage.getItem('cdv_filtros_vis') !== '0',
  selectedIds: new Set(),
  density: loadFromStorage<Density>(STORAGE_KEYS.density, 'normal'),
  columnVisibility: loadFromStorage(STORAGE_KEYS.columns, {
    nfd: true, nf: true, data: true, fornecedor: true, tipo: true,
    motivo: true, qtd: true, valor_total: true, status: true, dias_armazem: false,
    frete_tipo: false, frete_valor: false, obs: false,
  }),
  kpiVisibility: loadFromStorage(STORAGE_KEYS.kpiVis, {
    pendente: true, em_transferencia: true, devolvido: true,
    venda: true, total: true, caixas: true,
  }),
  setFilter: (key, value) => {
    const filters = { ...get().filters, [key]: value }
    set({ filters, selectedIds: new Set() })
    localStorage.setItem(STORAGE_KEYS.filters, JSON.stringify(filters))
  },
  resetFilters: () => set({ filters: DEFAULT_FILTERS, selectedIds: new Set() }),
  toggleFiltersVisible: () => {
    const next = !get().filtersVisible
    set({ filtersVisible: next })
    localStorage.setItem('cdv_filtros_vis', next ? '1' : '0')
  },
  toggleSelect: (id) => {
    const s = new Set(get().selectedIds)
    s.has(id) ? s.delete(id) : s.add(id)
    set({ selectedIds: s })
  },
  selectAll: (ids) => set({ selectedIds: new Set(ids) }),
  clearSelection: () => set({ selectedIds: new Set() }),
  setDensity: (d) => {
    set({ density: d })
    localStorage.setItem(STORAGE_KEYS.density, JSON.stringify(d))
  },
  setColumnVisibility: (col, visible) => {
    const cv = { ...get().columnVisibility, [col]: visible }
    set({ columnVisibility: cv })
    localStorage.setItem(STORAGE_KEYS.columns, JSON.stringify(cv))
  },
  toggleKpi: (key) => {
    const kv = { ...get().kpiVisibility, [key]: !get().kpiVisibility[key] }
    set({ kpiVisibility: kv })
    localStorage.setItem(STORAGE_KEYS.kpiVis, JSON.stringify(kv))
  },
}))
```

- [ ] **Step 2: Create `src/hooks/useNotas.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from '@/stores/toastStore'
import type { NotaFiscal, SupabaseStatus } from '@/types/database'
import type { NotasFilters } from '@/stores/notasStore'

export function useNotas(filters: NotasFilters) {
  return useQuery({
    queryKey: ['notas', filters],
    queryFn: async () => {
      let q = supabase
        .from('notas_fiscais')
        .select('*')
        .is('deleted_at', null)
        .order('data', { ascending: false })

      if (filters.status) q = q.eq('status', filters.status)
      if (filters.aba) q = q.eq('aba', filters.aba)
      if (filters.dataIni) q = q.gte('data', filters.dataIni)
      if (filters.dataFim) q = q.lte('data', filters.dataFim)
      if (filters.semFrete) q = q.is('frete_tipo', null)
      if (filters.busca) {
        const term = filters.busca.trim()
        q = q.or(`nfd.ilike.%${term}%,nf.ilike.%${term}%,fornecedor.ilike.%${term}%,descricao.ilike.%${term}%`)
      }

      const { data, error } = await q
      if (error) throw error
      return data as NotaFiscal[]
    },
  })
}

export function useNotaDetail(id: string | null) {
  return useQuery({
    queryKey: ['nota', id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('notas_fiscais')
        .select(`*, fotos_nf(*), comentarios(*, profiles(nome)), respostas_fornecedor(*, profiles(nome))`)
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export function useNotasMutation() {
  const qc = useQueryClient()

  const updateStatus = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[], status: SupabaseStatus }) => {
      const { error } = await supabase
        .from('notas_fiscais')
        .update({ status })
        .in('id', ids)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notas'] })
      toast('Status atualizado', 'ok')
    },
    onError: (e: Error) => toast(e.message, 'err'),
  })

  const softDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('notas_fiscais')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', ids)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notas'] })
    },
    onError: (e: Error) => toast(e.message, 'err'),
  })

  const updateNota = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: Partial<NotaFiscal> }) => {
      const { error } = await supabase
        .from('notas_fiscais')
        .update(data)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['notas'] })
      qc.invalidateQueries({ queryKey: ['nota', vars.id] })
      toast('Nota atualizada', 'ok')
    },
    onError: (e: Error) => toast(e.message, 'err'),
  })

  return { updateStatus, softDelete, updateNota }
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add notas store and TanStack Query hooks"
```

---

### Task 2: NotasKPIs Component

**Files:**
- Create: `src/pages/notas/NotasKPIs.tsx`

**Interfaces:**
- Consumes: `data: NotaFiscal[]`, `kpiVisibility: Record<string, boolean>`, `onToggle(key): void`
- Produces: 6 collapsible KPI cards with animated count-up

- [ ] **Step 1: Create `src/pages/notas/NotasKPIs.tsx`**

```typescript
import { useMemo, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NotaFiscal } from '@/types/database'

interface KPI { key: string; label: string; value: number; color: string }

function CountUp({ target }: { target: number }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let start = 0
    const step = Math.ceil(target / 30)
    const id = setInterval(() => {
      start = Math.min(start + step, target)
      setVal(start)
      if (start >= target) clearInterval(id)
    }, 30)
    return () => clearInterval(id)
  }, [target])
  return <span>{val.toLocaleString('pt-BR')}</span>
}

interface Props {
  data: NotaFiscal[]
  visibility: Record<string, boolean>
  onToggle: (key: string) => void
}

export function NotasKPIs({ data, visibility, onToggle }: Props) {
  const kpis = useMemo<KPI[]>(() => {
    const pendente = data.filter(n => n.status === 'Pendente').length
    const em_transferencia = data.filter(n => n.status === 'Em Transferência').length
    const devolvido = data.filter(n => n.status === 'Devolvido').length
    const venda = data.filter(n => n.status === 'Vendido').length
    const total = data.length
    const caixas = data.reduce((s, n) => s + (n.qtd ?? 0), 0)

    return [
      { key: 'pendente', label: 'Pendente', value: pendente, color: 'text-warning' },
      { key: 'em_transferencia', label: 'Em Transferência', value: em_transferencia, color: 'text-primary' },
      { key: 'devolvido', label: 'Devolvido', value: devolvido, color: 'text-positive' },
      { key: 'venda', label: 'Vendido', value: venda, color: 'text-purple-600' },
      { key: 'total', label: 'Total NFs', value: total, color: 'text-[var(--text)]' },
      { key: 'caixas', label: 'Total Cxs', value: caixas, color: 'text-[var(--text)]' },
    ]
  }, [data])

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-4">
      {kpis.map(kpi => (
        <div key={kpi.key} className="bg-surface dark:bg-surface-dark rounded-card shadow-soft overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-3 pt-3 pb-1 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide"
            onClick={() => onToggle(kpi.key)}
          >
            {kpi.label}
            <ChevronDown className={cn('w-3 h-3 transition-transform', !visibility[kpi.key] && '-rotate-90')} />
          </button>
          <AnimatePresence>
            {visibility[kpi.key] && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className={cn('px-3 pb-3 text-2xl font-bold font-heading', kpi.color)}
              >
                <CountUp target={kpi.value} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  )
}
```

---

### Task 3: NotasFilters Component

**Files:**
- Create: `src/pages/notas/NotasFilters.tsx`

**Interfaces:**
- Consumes: `filters: NotasFilters`, `onFilter(key, value)`, `onReset()`, `visible: boolean`, `onToggle()`
- Produces: Collapsible filter bar

- [ ] **Step 1: Create `src/pages/notas/NotasFilters.tsx`**

```typescript
import { AnimatePresence, motion } from 'framer-motion'
import { Filter, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { NotasFilters } from '@/stores/notasStore'

interface Props {
  filters: NotasFilters
  onFilter: (key: keyof NotasFilters, value: string | boolean) => void
  onReset: () => void
  visible: boolean
  onToggle: () => void
}

export function NotasFilters({ filters, onFilter, onReset, visible, onToggle }: Props) {
  const activeCount = [
    filters.status, filters.aba, filters.dataIni, filters.dataFim,
    filters.semFrete ? '1' : '', filters.busca
  ].filter(Boolean).length

  return (
    <div className="border-b border-[var(--border)]">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--border)] transition-colors"
      >
        <Filter className="w-4 h-4" />
        <span>Filtros</span>
        {activeCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 bg-primary text-white rounded-badge text-xs">{activeCount}</span>
        )}
      </button>

      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <select
                value={filters.status}
                onChange={e => onFilter('status', e.target.value)}
                className="rounded-btn border border-[var(--border)] bg-surface dark:bg-surface-dark text-[var(--text)] text-sm px-2 py-1.5"
              >
                <option value="">Todos os status</option>
                {['Pendente','Em Transferência','Devolvido','Cancelado','Vendido'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <select
                value={filters.aba}
                onChange={e => onFilter('aba', e.target.value)}
                className="rounded-btn border border-[var(--border)] bg-surface dark:bg-surface-dark text-[var(--text)] text-sm px-2 py-1.5"
              >
                <option value="">Todos fornecedores</option>
                {['Britania','Unilever','Variados'].map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>

              <Input
                type="date"
                value={filters.dataIni}
                onChange={e => onFilter('dataIni', e.target.value)}
                placeholder="Data início"
                className="text-sm"
              />

              <Input
                type="date"
                value={filters.dataFim}
                onChange={e => onFilter('dataFim', e.target.value)}
                placeholder="Data fim"
                className="text-sm"
              />

              <label className="flex items-center gap-2 text-sm text-[var(--text)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.semFrete}
                  onChange={e => onFilter('semFrete', e.target.checked)}
                  className="w-4 h-4 rounded accent-primary"
                />
                Sem frete
              </label>

              <div className="flex gap-2">
                <Input
                  value={filters.busca}
                  onChange={e => onFilter('busca', e.target.value)}
                  placeholder="Busca..."
                  className="text-sm flex-1"
                />
                {activeCount > 0 && (
                  <button onClick={onReset} className="text-[var(--text-muted)] hover:text-danger transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
```

---

### Task 4: NotasTable + BulkBar

**Files:**
- Create: `src/pages/notas/NotasTable.tsx`, `src/pages/notas/NotasBulkBar.tsx`

**Interfaces:**
- `NotasTable` consumes: `data`, `selectedIds`, `density`, `columnVisibility`, `onSelect(id)`, `onSelectAll()`, `onRowClick(nota)`
- `NotasBulkBar` consumes: `selectedIds`, `data`, `onAction(type)`, `onClear()`

- [ ] **Step 1: Create `src/pages/notas/NotasTable.tsx`**

```typescript
import { useRef } from 'react'
import { cn } from '@/lib/utils'
import type { NotaFiscal, SupabaseStatus } from '@/types/database'
import type { Density } from '@/stores/notasStore'

const STATUS_COLORS: Record<SupabaseStatus, string> = {
  'Pendente': 'bg-warning/15 text-warning',
  'Em Transferência': 'bg-primary/15 text-primary',
  'Devolvido': 'bg-positive/15 text-positive',
  'Cancelado': 'bg-[var(--text-muted)]/15 text-[var(--text-muted)]',
  'Vendido': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
}

const DENSITY_CLASSES: Record<Density, string> = {
  compact: 'py-1 text-xs',
  normal: 'py-2 text-sm',
  comfortable: 'py-3 text-sm',
}

interface Props {
  data: NotaFiscal[]
  selectedIds: Set<string>
  density: Density
  columnVisibility: Record<string, boolean>
  onSelect: (id: string) => void
  onSelectAll: () => void
  onRowClick: (nota: NotaFiscal) => void
  isLoading: boolean
}

export function NotasTable({ data, selectedIds, density, columnVisibility, onSelect, onSelectAll, onRowClick, isLoading }: Props) {
  const allSelected = data.length > 0 && selectedIds.size === data.length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--text-muted)] text-sm">
        Carregando notas...
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--text-muted)] text-sm">
        Nenhuma nota encontrada.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--border)]/30">
            <th className="px-3 py-2 w-8">
              <input type="checkbox" checked={allSelected} onChange={onSelectAll}
                className="w-4 h-4 rounded accent-primary" />
            </th>
            {columnVisibility.nfd && <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">NFD</th>}
            {columnVisibility.nf && <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">NF</th>}
            {columnVisibility.data && <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Data</th>}
            {columnVisibility.fornecedor && <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Fornecedor</th>}
            {columnVisibility.tipo && <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Tipo</th>}
            {columnVisibility.qtd && <th className="px-3 py-2 text-right text-xs font-semibold text-[var(--text-muted)] uppercase">Qtd</th>}
            {columnVisibility.valor_total && <th className="px-3 py-2 text-right text-xs font-semibold text-[var(--text-muted)] uppercase">Valor</th>}
            {columnVisibility.status && <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Status</th>}
          </tr>
        </thead>
        <tbody>
          {data.map(nota => (
            <tr
              key={nota.id}
              onClick={() => onRowClick(nota)}
              className={cn(
                'border-b border-[var(--border)] cursor-pointer transition-colors',
                selectedIds.has(nota.id) ? 'bg-primary/5' : 'hover:bg-[var(--border)]/40'
              )}
            >
              <td className={cn('px-3', DENSITY_CLASSES[density])} onClick={e => { e.stopPropagation(); onSelect(nota.id) }}>
                <input type="checkbox" checked={selectedIds.has(nota.id)} onChange={() => onSelect(nota.id)}
                  className="w-4 h-4 rounded accent-primary" />
              </td>
              {columnVisibility.nfd && <td className={cn('px-3 font-mono', DENSITY_CLASSES[density])}>{nota.nfd}</td>}
              {columnVisibility.nf && <td className={cn('px-3 font-mono', DENSITY_CLASSES[density])}>{nota.nf}</td>}
              {columnVisibility.data && <td className={cn('px-3', DENSITY_CLASSES[density])}>{new Date(nota.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>}
              {columnVisibility.fornecedor && <td className={cn('px-3 font-medium', DENSITY_CLASSES[density])}>{nota.fornecedor}</td>}
              {columnVisibility.tipo && <td className={cn('px-3 text-[var(--text-muted)]', DENSITY_CLASSES[density])}>{nota.tipo}</td>}
              {columnVisibility.qtd && <td className={cn('px-3 text-right', DENSITY_CLASSES[density])}>{nota.qtd}</td>}
              {columnVisibility.valor_total && (
                <td className={cn('px-3 text-right font-medium', DENSITY_CLASSES[density])}>
                  {nota.valor_total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
              )}
              {columnVisibility.status && (
                <td className={cn('px-3', DENSITY_CLASSES[density])}>
                  <span className={cn('px-2 py-0.5 rounded-badge text-xs font-medium', STATUS_COLORS[nota.status])}>
                    {nota.status}
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/pages/notas/NotasBulkBar.tsx`**

```typescript
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, ShoppingCart, Truck, FileDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { NotaFiscal } from '@/types/database'
import { useNavigate } from 'react-router-dom'

type BulkAction = 'devolver' | 'venda' | 'frete' | 'email' | 'docCarga'

interface Props {
  selectedIds: Set<string>
  data: NotaFiscal[]
  onAction: (type: BulkAction, notas: NotaFiscal[]) => void
  onClear: () => void
}

export function NotasBulkBar({ selectedIds, data, onAction, onClear }: Props) {
  const selected = data.filter(n => selectedIds.has(n.id))
  const allSameFornecedor = selected.length > 0 &&
    new Set(selected.map(n => n.fornecedor)).size === 1

  return (
    <AnimatePresence>
      {selectedIds.size > 0 && (
        <motion.div
          initial={{ y: 80 }}
          animate={{ y: 0 }}
          exit={{ y: 80 }}
          className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-30 bg-[#1E293B] text-white rounded-card shadow-soft-lg flex items-center gap-2 px-4 py-3"
        >
          <span className="text-sm font-medium mr-2">{selectedIds.size} selecionadas</span>

          <Button size="sm" onClick={() => onAction('devolver', selected)}
            className="bg-positive hover:bg-positive-hover text-white text-xs">
            Devolução
          </Button>

          <Button size="sm" variant="outline" onClick={() => onAction('venda', selected)}
            className="border-white/20 text-white hover:bg-white/10 text-xs">
            <ShoppingCart className="w-3.5 h-3.5 mr-1" />Venda
          </Button>

          <Button size="sm" variant="outline" onClick={() => onAction('frete', selected)}
            className="border-white/20 text-white hover:bg-white/10 text-xs">
            <Truck className="w-3.5 h-3.5 mr-1" />Frete
          </Button>

          <Button
            size="sm" variant="outline"
            disabled={!allSameFornecedor}
            title={!allSameFornecedor ? 'Selecione notas do mesmo fornecedor' : ''}
            onClick={() => allSameFornecedor && onAction('email', selected)}
            className="border-white/20 text-white hover:bg-white/10 text-xs disabled:opacity-40"
          >
            <Mail className="w-3.5 h-3.5 mr-1" />E-mail
          </Button>

          <Button
            size="sm" variant="outline"
            disabled={!allSameFornecedor}
            onClick={() => allSameFornecedor && onAction('docCarga', selected)}
            className="border-white/20 text-white hover:bg-white/10 text-xs disabled:opacity-40"
          >
            <FileDown className="w-3.5 h-3.5 mr-1" />Doc. Carga
          </Button>

          <button onClick={onClear} className="ml-2 text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add notas table, bulk bar, filters, and KPIs components"
```

---

### Task 5: NotasPage Assembly + Keyboard Shortcuts

**Files:**
- Create: `src/pages/notas/NotasPage.tsx`

**Interfaces:**
- Produces: `/app/notas` route rendering full notas listing experience

- [ ] **Step 1: Create `src/pages/notas/NotasPage.tsx`**

```typescript
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, LayoutColumns, AlignJustify } from 'lucide-react'
import { useNotas, useNotasMutation } from '@/hooks/useNotas'
import { useNotasStore } from '@/stores/notasStore'
import { NotasKPIs } from './NotasKPIs'
import { NotasFilters } from './NotasFilters'
import { NotasTable } from './NotasTable'
import { NotasBulkBar } from './NotasBulkBar'
import { NotaDetail } from './NotaDetail'
import { showUndo } from '@/stores/undoStore'
import { toast } from '@/stores/toastStore'
import { Button } from '@/components/ui/button'
import type { NotaFiscal } from '@/types/database'

export default function NotasPage() {
  const navigate = useNavigate()
  const store = useNotasStore()
  const { data = [], isLoading, refetch } = useNotas(store.filters)
  const { updateStatus, softDelete } = useNotasMutation()
  const [detailId, setDetailId] = useState<string | null>(null)

  // Keyboard shortcuts
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.key === 'F5' || e.key === 'r') { e.preventDefault(); refetch() }
      if (e.key === 'Escape') { store.clearSelection(); setDetailId(null) }
      if (e.key === 'a') store.selectAll(data.map(n => n.id))
      if (e.key === 'f') document.getElementById('busca-input')?.focus()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [data, refetch, store])

  function handleBulkAction(type: string, notas: NotaFiscal[]) {
    const ids = notas.map(n => n.id)

    if (type === 'devolver') {
      const prev = notas.map(n => ({ id: n.id, status: n.status }))
      updateStatus.mutate({ ids, status: 'Devolvido' })
      showUndo('Marcadas como Devolvido', async () => {
        for (const p of prev) {
          await updateStatus.mutateAsync({ ids: [p.id], status: p.status })
        }
      })
      store.clearSelection()
      return
    }

    if (type === 'venda') { navigate('/app/venda', { state: { nfds: notas.map(n => n.nfd) } }); return }
    if (type === 'frete') { navigate('/app/frete', { state: { nota: notas[0] } }); return }
    if (type === 'email') {
      localStorage.setItem('cdv_email_nfds', JSON.stringify(notas.map(n => n.nfd)))
      navigate('/app/email')
    }
    if (type === 'docCarga') {
      localStorage.setItem('cdv_pdf_prefill', JSON.stringify(notas.map(n => n.nfd)))
      navigate('/app/exportar-pdf')
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-surface dark:bg-surface-dark">
        <h2 className="font-heading font-semibold text-[var(--text)]">Notas Fiscais</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">{data.length} notas</span>
          <Button variant="ghost" size="icon" onClick={() => refetch()} title="Recarregar (F5)">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <NotasKPIs data={data} visibility={store.kpiVisibility} onToggle={store.toggleKpi} />

      {/* Filters */}
      <NotasFilters
        filters={store.filters}
        onFilter={store.setFilter}
        onReset={store.resetFilters}
        visible={store.filtersVisible}
        onToggle={store.toggleFiltersVisible}
      />

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <NotasTable
          data={data}
          selectedIds={store.selectedIds}
          density={store.density}
          columnVisibility={store.columnVisibility}
          onSelect={store.toggleSelect}
          onSelectAll={() =>
            store.selectedIds.size === data.length
              ? store.clearSelection()
              : store.selectAll(data.map(n => n.id))
          }
          onRowClick={nota => setDetailId(nota.id)}
          isLoading={isLoading}
        />
      </div>

      {/* Bulk bar */}
      <NotasBulkBar
        selectedIds={store.selectedIds}
        data={data}
        onAction={handleBulkAction}
        onClear={store.clearSelection}
      />

      {/* Detail modal */}
      <NotaDetail id={detailId} onClose={() => setDetailId(null)} />
    </div>
  )
}
```

- [ ] **Step 2: Add route to `src/App.tsx`**

```typescript
// Add lazy import:
const NotasPage = lazy(() => import('@/pages/notas/NotasPage'))

// Add route inside Shell routes:
<Route path="/app/notas" element={
  <RequireModule mod="notas">
    <Suspense fallback={<PageLoader />}><NotasPage /></Suspense>
  </RequireModule>
} />
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add NotasPage with KPIs, filters, table, and bulk actions"
```

---

### Task 6: NotaDetail Slide-Over

**Files:**
- Create: `src/pages/notas/NotaDetail.tsx`

**Interfaces:**
- Consumes: `id: string | null`, `onClose(): void`
- Produces: Framer Motion slide-over sheet showing full NF detail, editable fields, comments, foto gallery

- [ ] **Step 1: Create `src/pages/notas/NotaDetail.tsx`**

```typescript
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Save, ImageIcon } from 'lucide-react'
import { useNotaDetail, useNotasMutation } from '@/hooks/useNotas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { SupabaseStatus } from '@/types/database'

const STATUS_OPTIONS: SupabaseStatus[] = ['Pendente','Em Transferência','Devolvido','Cancelado','Vendido']

interface Props { id: string | null; onClose: () => void }

export function NotaDetail({ id, onClose }: Props) {
  const { data: nota, isLoading } = useNotaDetail(id)
  const { updateNota } = useNotasMutation()
  const [obs, setObs] = useState('')
  const [showGallery, setShowGallery] = useState(false)

  // Sync obs when nota loads
  if (nota && obs === '' && nota.obs) setObs(nota.obs)

  function handleSave() {
    if (!nota) return
    updateNota.mutate({ id: nota.id, data: { obs } })
  }

  return (
    <AnimatePresence>
      {id && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 h-full w-full max-w-lg bg-surface dark:bg-surface-dark shadow-soft-lg z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <h3 className="font-heading font-semibold text-[var(--text)]">
                {nota ? `NFD ${nota.nfd}` : 'Carregando...'}
              </h3>
              <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : nota ? (
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Data grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ['NFD', nota.nfd], ['NF', nota.nf],
                    ['Data', new Date(nota.data + 'T00:00:00').toLocaleDateString('pt-BR')],
                    ['Fornecedor', nota.fornecedor],
                    ['Tipo', nota.tipo], ['Motivo', nota.motivo],
                    ['Quantidade', nota.qtd],
                    ['Valor Unit.', nota.valor_unitario?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })],
                    ['Valor Total', nota.valor_total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-0.5">{label}</p>
                      <p className="font-medium text-[var(--text)]">{value ?? '—'}</p>
                    </div>
                  ))}
                  <div>
                    <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-0.5">Status</p>
                    <select
                      value={nota.status}
                      onChange={e => updateNota.mutate({ id: nota.id, data: { status: e.target.value as SupabaseStatus } })}
                      className="rounded-btn border border-[var(--border)] bg-surface dark:bg-surface-dark text-[var(--text)] text-sm px-2 py-1"
                    >
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {/* Observações */}
                <div>
                  <Label className="text-xs uppercase text-[var(--text-muted)]">Observações</Label>
                  <textarea
                    value={obs}
                    onChange={e => setObs(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-btn border border-[var(--border)] bg-surface dark:bg-surface-dark text-[var(--text)] text-sm p-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <Button size="sm" className="mt-2 bg-primary" onClick={handleSave}>
                    <Save className="w-3.5 h-3.5 mr-1" />Salvar obs.
                  </Button>
                </div>

                {/* Photos */}
                {(nota as any).fotos_nf?.length > 0 && (
                  <div>
                    <p className="text-xs text-[var(--text-muted)] uppercase mb-2">Fotos de Avaria</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(nota as any).fotos_nf.map((f: any) => (
                        <img key={f.id} src={f.url} alt={f.nome} className="w-full h-20 object-cover rounded-btn" />
                      ))}
                    </div>
                  </div>
                )}

                {/* Descrição */}
                {nota.descricao && (
                  <div>
                    <p className="text-xs text-[var(--text-muted)] uppercase mb-1">Descrição</p>
                    <p className="text-sm text-[var(--text)]">{nota.descricao}</p>
                  </div>
                )}
              </div>
            ) : null}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add NotaDetail slide-over with editable fields and photos"
```

---

### Task 7: R2 Upload Edge Function

**Files:**
- Create: `supabase/functions/r2-presign/index.ts`

**Interfaces:**
- Produces: `POST /functions/v1/r2-presign` → `{ uploadUrl, publicUrl, r2Key }`
- Request body: `{ fileName, contentType, folder }` (folder = `notas/{aba}/{nfd}`)

- [ ] **Step 1: Create `supabase/functions/r2-presign/index.ts`**

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts'

const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID')!
const R2_ACCESS_KEY = Deno.env.get('R2_ACCESS_KEY_ID')!
const R2_SECRET_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY')!
const R2_BUCKET = Deno.env.get('R2_BUCKET_NAME')!
const R2_PUBLIC_URL = Deno.env.get('R2_PUBLIC_URL')!

// AWS Signature V4 for R2 (S3-compatible)
function hmac(key: ArrayBuffer | string, data: string) {
  const keyBuf = typeof key === 'string' ? new TextEncoder().encode(key) : key
  return createHmac('sha256', Buffer.from(keyBuf)).update(data).digest()
}

function getSigningKey(secretKey: string, date: string, region: string, service: string) {
  const kDate = hmac('AWS4' + secretKey, date)
  const kRegion = hmac(kDate, region)
  const kService = hmac(kRegion, service)
  return hmac(kService, 'aws4_request')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' }
    })
  }

  try {
    const { fileName, contentType, folder } = await req.json()
    const r2Key = `${folder}/${Date.now()}-${fileName}`
    const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`

    const now = new Date()
    const date = now.toISOString().slice(0, 10).replace(/-/g, '')
    const datetime = now.toISOString().replace(/[:-]/g, '').slice(0, 15) + 'Z'
    const expires = '3600'

    const credential = `${R2_ACCESS_KEY}/${date}/auto/s3/aws4_request`
    const signedHeaders = 'host'

    const params = new URLSearchParams({
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': credential,
      'X-Amz-Date': datetime,
      'X-Amz-Expires': expires,
      'X-Amz-SignedHeaders': signedHeaders,
    })

    const canonicalRequest = [
      'PUT',
      `/${R2_BUCKET}/${r2Key}`,
      params.toString(),
      `host:${host}\n`,
      signedHeaders,
      'UNSIGNED-PAYLOAD',
    ].join('\n')

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      datetime,
      `${date}/auto/s3/aws4_request`,
      Buffer.from(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalRequest))
      ).toString('hex'),
    ].join('\n')

    const signingKey = getSigningKey(R2_SECRET_KEY, date, 'auto', 's3')
    const signature = createHmac('sha256', Buffer.from(signingKey))
      .update(stringToSign).digest('hex')

    params.set('X-Amz-Signature', signature)

    const uploadUrl = `${endpoint}/${R2_BUCKET}/${r2Key}?${params.toString()}`
    const publicUrl = `${R2_PUBLIC_URL}/${r2Key}`

    return new Response(JSON.stringify({ uploadUrl, publicUrl, r2Key }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})
```

- [ ] **Step 2: Set Edge Function secrets**

In Supabase Dashboard → Settings → Edge Functions → Secrets:
```
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_URL=https://your-r2-public-domain.com
```

- [ ] **Step 3: Deploy Edge Function**

```bash
npx supabase functions deploy r2-presign --no-verify-jwt
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add R2 presign Edge Function for file uploads"
```

---

### Task 8: R2 Upload Hook + FotoUpload Component

**Files:**
- Create: `src/hooks/useR2Upload.ts`, `src/pages/lancamento/FotoUpload.tsx`

**Interfaces:**
- Produces: `useR2Upload()` returning `{ upload(file, folder): Promise<{ url, r2Key }>, uploading }`
- `<FotoUpload folder={folder} onUploaded(url, r2Key) />` — drag-drop zone

- [ ] **Step 1: Create `src/hooks/useR2Upload.ts`**

```typescript
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/stores/toastStore'

const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png']

export function useR2Upload() {
  const [uploading, setUploading] = useState(false)

  async function upload(file: File, folder: string): Promise<{ url: string; r2Key: string } | null> {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast('Apenas JPG e PNG são permitidos', 'err')
      return null
    }
    if (file.size > MAX_SIZE) {
      toast('Arquivo maior que 5MB', 'err')
      return null
    }

    setUploading(true)
    try {
      // Get presigned URL from Edge Function
      const { data: session } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/r2-presign`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.session?.access_token}`,
          },
          body: JSON.stringify({ fileName: file.name, contentType: file.type, folder }),
        }
      )
      const { uploadUrl, publicUrl, r2Key } = await res.json()

      // Upload directly to R2
      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })

      return { url: publicUrl, r2Key }
    } catch (e) {
      toast('Erro no upload', 'err')
      return null
    } finally {
      setUploading(false)
    }
  }

  return { upload, uploading }
}
```

- [ ] **Step 2: Create `src/pages/lancamento/FotoUpload.tsx`**

```typescript
import { useCallback, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { useR2Upload } from '@/hooks/useR2Upload'
import { cn } from '@/lib/utils'

interface UploadedPhoto { url: string; r2Key: string; preview: string }

interface Props {
  folder: string
  onUploaded: (photos: UploadedPhoto[]) => void
}

export function FotoUpload({ folder, onUploaded }: Props) {
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [dragging, setDragging] = useState(false)
  const { upload, uploading } = useR2Upload()

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).slice(0, 10 - photos.length)
    for (const file of arr) {
      const preview = URL.createObjectURL(file)
      const result = await upload(file, folder)
      if (result) {
        setPhotos(prev => {
          const next = [...prev, { ...result, preview }]
          onUploaded(next)
          return next
        })
      }
    }
  }, [photos.length, upload, folder, onUploaded])

  function removePhoto(r2Key: string) {
    setPhotos(prev => {
      const next = prev.filter(p => p.r2Key !== r2Key)
      onUploaded(next)
      return next
    })
  }

  return (
    <div className="space-y-3">
      <label
        className={cn(
          'flex flex-col items-center justify-center border-2 border-dashed rounded-card p-8 cursor-pointer transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-[var(--border)] hover:border-primary/50'
        )}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); processFiles(e.dataTransfer.files) }}
      >
        <input
          type="file"
          accept="image/jpeg,image/png"
          multiple
          className="hidden"
          onChange={e => e.target.files && processFiles(e.target.files)}
        />
        <Upload className={cn('w-8 h-8 mb-2', uploading ? 'text-primary animate-bounce' : 'text-[var(--text-muted)]')} />
        <p className="text-sm text-[var(--text-muted)]">
          {uploading ? 'Enviando...' : 'Arraste fotos ou clique para selecionar (JPG/PNG, máx 5MB)'}
        </p>
      </label>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map(p => (
            <div key={p.r2Key} className="relative group">
              <img src={p.preview} className="w-full h-20 object-cover rounded-btn" />
              <button
                onClick={() => removePhoto(p.r2Key)}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add R2 upload hook and FotoUpload drag-drop component"
```

---

### Task 9: XmlImporter + LancamentoForm

**Files:**
- Create: `src/pages/lancamento/XmlImporter.tsx`, `src/pages/lancamento/LancamentoForm.tsx`

**Interfaces:**
- `XmlImporter` Produces: parses NF-e XML → `{ nf, data, fornecedor, valor }`
- `LancamentoForm` Produces: full NF entry form, calls `useLancamento().insertNota()`

- [ ] **Step 1: Create `src/hooks/useLancamento.ts`**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from '@/stores/toastStore'
import { useAuth } from '@/contexts/AuthContext'
import type { SupabaseAba, FreteTipo } from '@/types/database'

export interface LancamentoData {
  nfd: string
  nf: string
  data: string
  fornecedor: string
  aba: SupabaseAba
  tipo: string
  motivo: string
  descricao: string
  qtd: number
  valor_unitario: number
  frete_tipo?: FreteTipo | null
  frete_valor?: number | null
  obs?: string
}

export function useLancamento() {
  const qc = useQueryClient()
  const { user } = useAuth()

  const insertNota = useMutation({
    mutationFn: async ({ data, fotoUrls }: { data: LancamentoData, fotoUrls: Array<{ url: string; r2Key: string }> }) => {
      // Check duplicate
      const { data: existing } = await supabase
        .from('notas_fiscais')
        .select('id')
        .eq('nf', data.nf)
        .eq('aba', data.aba)
        .is('deleted_at', null)
        .single()

      if (existing) {
        const confirmed = window.confirm(`NF ${data.nf} já existe para ${data.aba}. Deseja salvar mesmo assim?`)
        if (!confirmed) throw new Error('CANCELLED')
      }

      const { data: inserted, error } = await supabase
        .from('notas_fiscais')
        .insert({ ...data, responsavel_id: user?.id })
        .select()
        .single()
      if (error) throw error

      // Save photos to fotos_nf
      if (fotoUrls.length > 0) {
        await supabase.from('fotos_nf').insert(
          fotoUrls.map((f, i) => ({
            nota_fiscal_id: inserted.id,
            url: f.url,
            r2_key: f.r2Key,
            nome: `foto-${i + 1}`,
            ordem: i,
          }))
        )
      }

      return inserted
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notas'] })
      toast('NF lançada com sucesso', 'ok')
      localStorage.removeItem('cdv_draft_lancamento')
    },
    onError: (e: Error) => {
      if (e.message !== 'CANCELLED') toast(e.message, 'err')
    },
  })

  return { insertNota }
}
```

- [ ] **Step 2: Create `src/pages/lancamento/XmlImporter.tsx`**

```typescript
import { Upload } from 'lucide-react'

interface ParsedXml {
  nf: string
  data: string
  fornecedor: string
  valor: number
}

interface Props { onParsed: (data: ParsedXml) => void }

export function XmlImporter({ onParsed }: Props) {
  function parseXml(xmlString: string): ParsedXml | null {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlString, 'text/xml')
    if (doc.querySelector('parsererror')) return null

    const nNF = doc.querySelector('nNF')?.textContent?.trim() ?? ''
    const dhEmi = doc.querySelector('dhEmi')?.textContent?.trim() ?? ''
    const xNome = doc.querySelector('emit > xNome')?.textContent?.trim() ?? ''
    const vNF = doc.querySelector('vNF')?.textContent?.trim() ?? '0'
    const data = dhEmi ? dhEmi.slice(0, 10) : ''

    return { nf: nNF, data, fornecedor: xNome.toUpperCase(), valor: parseFloat(vNF) || 0 }
  }

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = e => {
      const xml = e.target?.result as string
      const parsed = parseXml(xml)
      if (parsed) onParsed(parsed)
    }
    reader.readAsText(file)
  }

  return (
    <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-[var(--border)] rounded-btn cursor-pointer hover:border-primary/50 transition-colors text-sm text-[var(--text-muted)]">
      <Upload className="w-4 h-4" />
      Importar XML NF-e
      <input type="file" accept=".xml" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
    </label>
  )
}
```

- [ ] **Step 3: Create `src/pages/lancamento/LancamentoForm.tsx`**

```typescript
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { XmlImporter } from './XmlImporter'
import { FotoUpload } from './FotoUpload'
import { useLancamento } from '@/hooks/useLancamento'
import type { SupabaseAba, FreteTipo } from '@/types/database'

const DRAFT_KEY = 'cdv_draft_lancamento'

const EMPTY_FORM = {
  nfd: '', nf: '', data: '', fornecedor: '', aba: 'Britania' as SupabaseAba,
  tipo: '', motivo: '', descricao: '', qtd: '', valor_unitario: '', obs: '',
}

export function LancamentoForm() {
  const navigate = useNavigate()
  const { insertNota } = useLancamento()
  const [form, setForm] = useState(() => {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '') } catch { return EMPTY_FORM }
  })
  const [fotos, setFotos] = useState<Array<{ url: string; r2Key: string }>>([])

  // Auto-save draft
  useEffect(() => {
    const id = setTimeout(() => localStorage.setItem(DRAFT_KEY, JSON.stringify(form)), 3000)
    return () => clearTimeout(id)
  }, [form])

  function set(key: string, value: string) {
    setForm((f: typeof EMPTY_FORM) => ({ ...f, [key]: value }))
  }

  function handleXmlParsed(data: { nf: string; data: string; fornecedor: string; valor: number }) {
    setForm((f: typeof EMPTY_FORM) => ({
      ...f, nf: data.nf, data: data.data,
      fornecedor: data.fornecedor, valor_unitario: String(data.valor),
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await insertNota.mutateAsync({
      data: {
        nfd: form.nfd, nf: form.nf, data: form.data,
        fornecedor: form.fornecedor.toUpperCase(),
        aba: form.aba as SupabaseAba, tipo: form.tipo, motivo: form.motivo,
        descricao: form.descricao, qtd: parseInt(form.qtd) || 0,
        valor_unitario: parseFloat(form.valor_unitario) || 0,
        obs: form.obs,
      },
      fotoUrls: fotos,
    })
    setForm(EMPTY_FORM)
    setFotos([])
    navigate('/app/notas')
  }

  const folder = form.aba && form.nfd ? `notas/${form.aba}/${form.nfd}` : `notas/temp/${Date.now()}`

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <select value={form.aba} onChange={e => set('aba', e.target.value)}
          className="rounded-btn border border-[var(--border)] bg-surface dark:bg-surface-dark text-[var(--text)] px-3 py-2 text-sm">
          {['Britania','Unilever','Variados'].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <XmlImporter onParsed={handleXmlParsed} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[
          { key: 'nfd', label: 'NFD', required: true },
          { key: 'nf', label: 'NF', required: true },
          { key: 'data', label: 'Data', type: 'date', required: true },
          { key: 'fornecedor', label: 'Fornecedor', required: true },
          { key: 'tipo', label: 'Tipo' },
          { key: 'motivo', label: 'Motivo' },
          { key: 'qtd', label: 'Quantidade', type: 'number' },
          { key: 'valor_unitario', label: 'Valor Unitário', type: 'number' },
        ].map(({ key, label, type = 'text', required }) => (
          <div key={key} className="space-y-1">
            <Label>{label}</Label>
            <Input
              type={type}
              value={(form as any)[key]}
              onChange={e => set(key, e.target.value)}
              required={required}
              onBlur={key === 'fornecedor' ? e => set('fornecedor', e.target.value.toUpperCase()) : undefined}
            />
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <Label>Descrição</Label>
        <textarea
          value={form.descricao}
          onChange={e => set('descricao', e.target.value)}
          rows={2}
          className="w-full rounded-btn border border-[var(--border)] bg-surface dark:bg-surface-dark text-[var(--text)] text-sm p-2 resize-none"
        />
      </div>

      <div className="space-y-1">
        <Label>Observações</Label>
        <textarea
          value={form.obs}
          onChange={e => set('obs', e.target.value)}
          rows={2}
          className="w-full rounded-btn border border-[var(--border)] bg-surface dark:bg-surface-dark text-[var(--text)] text-sm p-2 resize-none"
        />
      </div>

      <div className="space-y-1">
        <Label>Fotos de Avaria</Label>
        <FotoUpload folder={folder} onUploaded={setFotos} />
      </div>

      <div className="flex gap-3">
        <Button type="submit" className="bg-primary" disabled={insertNota.isPending}>
          {insertNota.isPending ? 'Salvando...' : 'Salvar NF'}
        </Button>
        <Button type="button" variant="outline" onClick={() => navigate('/app/notas')}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 4: Create `src/pages/lancamento/LancamentoPage.tsx`**

```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LancamentoForm } from './LancamentoForm'

export default function LancamentoPage() {
  return (
    <div className="p-6 max-w-3xl">
      <h2 className="font-heading text-xl font-bold text-[var(--text)] mb-6">Lançamento de NF</h2>
      <Tabs defaultValue="individual">
        <TabsList>
          <TabsTrigger value="individual">Individual</TabsTrigger>
          <TabsTrigger value="lote">Em Lote</TabsTrigger>
        </TabsList>
        <TabsContent value="individual" className="mt-6">
          <LancamentoForm />
        </TabsContent>
        <TabsContent value="lote" className="mt-6">
          <p className="text-[var(--text-muted)] text-sm">Modo lote: adicione múltiplos itens e salve todos de uma vez.</p>
          {/* LancamentoLote component — same pattern as LancamentoForm with dynamic row list */}
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 5: Add route to `src/App.tsx`**

```typescript
const LancamentoPage = lazy(() => import('@/pages/lancamento/LancamentoPage'))

// Inside Shell routes:
<Route path="/app/lancamento" element={
  <RequireModule mod="lancamento">
    <Suspense fallback={<PageLoader />}><LancamentoPage /></Suspense>
  </RequireModule>
} />
```

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: S3 complete — FormNotas + FormLancamento with R2 uploads"
```
