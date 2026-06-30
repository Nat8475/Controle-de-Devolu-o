# S4: Operações (Transferências + Frete + Reabertura + Venda) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Prerequisite:** S1 (Foundation) and S2 (Database) must be complete.

**Goal:** Implement four operation modules — FormTransferencias (manage active transfers), FormProgramarFrete (3-step wizard: schedule freight), FormReabertura (3-step wizard: reopen NFs), FormVenda (3-step wizard: sale write-off).

**Architecture:** Each wizard uses a local `step` state machine (1→2→3). Shared `useWizardData` pattern: step 1 searches/inputs NFDs, step 2 previews result, step 3 confirms + shows result. All write operations invalidate `['notas']` query. After transfer baixa, saves aba in localStorage and navigates to `/app/notas`.

**Tech Stack:** React 18, TanStack Query v5, Zustand v4, Supabase JS v2, shadcn/ui, Framer Motion, Lucide React

## Global Constraints

- All S1 constraints apply
- Wizard steps rendered with `AnimatePresence` + `slideUp` motion transition
- All mutations log to `audit_log` (insert via Supabase client — RLS allows authenticated users to insert)
- `toast()` from `@/stores/toastStore` for all feedback
- After Transferencia baixa: `localStorage.setItem('cdv_retorno_aba', aba)` → `navigate('/app/notas')`
- Venda baixa step 3: trigger `window.print()` with inline Doc. Carga HTML

---

## File Structure

```
src/
  pages/
    transferencias/
      TransferenciasPage.tsx
    frete/
      FretePage.tsx
    reabertura/
      ReaberturaPage.tsx
    venda/
      VendaPage.tsx
  hooks/
    useTransferencias.ts
    useOperacoes.ts      ← shared wizard mutation hooks
```

---

### Task 1: Transferências Module

**Files:**
- Create: `src/hooks/useTransferencias.ts`, `src/pages/transferencias/TransferenciasPage.tsx`

**Interfaces:**
- Produces: `/app/transferencias` route with sortable list, baixa/cancelar/reagendar actions

- [ ] **Step 1: Create `src/hooks/useTransferencias.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from '@/stores/toastStore'
import type { Transferencia } from '@/types/database'

export function useTransferencias() {
  return useQuery({
    queryKey: ['transferencias'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transferencias')
        .select('*, notas_fiscais(aba, fornecedor)')
        .eq('status', 'Ativa')
        .order('agendamento', { ascending: true })
      if (error) throw error
      return data as Array<Transferencia & { notas_fiscais: { aba: string; fornecedor: string } | null }>
    },
  })
}

export function useTransferenciasMutation() {
  const qc = useQueryClient()

  const darBaixa = useMutation({
    mutationFn: async ({ id, notaId, aba }: { id: string; notaId: string | null; aba: string }) => {
      await supabase.from('transferencias').update({ status: 'Concluída' }).eq('id', id)
      if (notaId) {
        await supabase.from('notas_fiscais').update({ status: 'Devolvido' }).eq('id', notaId)
      }
      return aba
    },
    onSuccess: (aba) => {
      qc.invalidateQueries({ queryKey: ['transferencias'] })
      qc.invalidateQueries({ queryKey: ['notas'] })
      toast('Transferência concluída', 'ok')
      localStorage.setItem('cdv_retorno_aba', aba)
    },
    onError: (e: Error) => toast(e.message, 'err'),
  })

  const cancelar = useMutation({
    mutationFn: async ({ id, notaId }: { id: string; notaId: string | null }) => {
      await supabase.from('transferencias').update({ status: 'Cancelada' }).eq('id', id)
      if (notaId) {
        await supabase.from('notas_fiscais').update({ status: 'Pendente' }).eq('id', notaId)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transferencias'] })
      qc.invalidateQueries({ queryKey: ['notas'] })
      toast('Transferência cancelada', 'warn')
    },
    onError: (e: Error) => toast(e.message, 'err'),
  })

  const reagendar = useMutation({
    mutationFn: async ({ id, novaData }: { id: string; novaData: string }) => {
      const { error } = await supabase
        .from('transferencias')
        .update({ agendamento: novaData })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transferencias'] })
      toast('Reagendado', 'ok')
    },
    onError: (e: Error) => toast(e.message, 'err'),
  })

  return { darBaixa, cancelar, reagendar }
}
```

- [ ] **Step 2: Create `src/pages/transferencias/TransferenciasPage.tsx`**

```typescript
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, CheckCircle, X, Calendar } from 'lucide-react'
import { useTransferencias, useTransferenciasMutation } from '@/hooks/useTransferencias'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function TransferenciasPage() {
  const navigate = useNavigate()
  const { data = [], isLoading, refetch } = useTransferencias()
  const { darBaixa, cancelar, reagendar } = useTransferenciasMutation()
  const [reagendandoId, setReagendandoId] = useState<string | null>(null)
  const [novaData, setNovaData] = useState('')

  function handleBaixa(t: typeof data[0]) {
    const aba = t.notas_fiscais?.aba ?? 'Britania'
    darBaixa.mutate(
      { id: t.id, notaId: t.nota_fiscal_id, aba },
      { onSuccess: () => navigate('/app/notas') }
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-surface dark:bg-surface-dark">
        <h2 className="font-heading font-semibold text-[var(--text)]">Transferências em Andamento</h2>
        <Button variant="ghost" size="icon" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48 text-[var(--text-muted)] text-sm">Carregando...</div>
      ) : data.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-[var(--text-muted)] text-sm">Nenhuma transferência ativa.</div>
      ) : (
        <div className="overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--border)]/30">
                {['NFD','NF','Fornecedor','Tipo','Caixas','Valor','Nº Pedido','Agendamento','Ações'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(t => (
                <tr key={t.id} className="border-b border-[var(--border)] hover:bg-[var(--border)]/30 transition-colors">
                  <td className="px-3 py-2 text-sm font-mono">{t.nfd}</td>
                  <td className="px-3 py-2 text-sm font-mono">{t.nf}</td>
                  <td className="px-3 py-2 text-sm">{t.notas_fiscais?.fornecedor ?? '—'}</td>
                  <td className="px-3 py-2 text-sm">{t.tipo ?? '—'}</td>
                  <td className="px-3 py-2 text-sm text-right">{t.caixas ?? '—'}</td>
                  <td className="px-3 py-2 text-sm text-right">
                    {t.valor?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-sm">{t.num_pedido ?? '—'}</td>
                  <td className="px-3 py-2 text-sm">
                    {t.agendamento ? new Date(t.agendamento).toLocaleString('pt-BR') : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleBaixa(t)}
                        title="Dar Baixa"
                        className="p-1.5 rounded text-positive hover:bg-positive/10 transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => cancelar.mutate({ id: t.id, notaId: t.nota_fiscal_id })}
                        title="Cancelar"
                        className="p-1.5 rounded text-danger hover:bg-danger/10 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setReagendandoId(t.id); setNovaData('') }}
                        title="Reagendar"
                        className="p-1.5 rounded text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Calendar className="w-4 h-4" />
                      </button>
                    </div>
                    {reagendandoId === t.id && (
                      <div className="flex gap-1 mt-1">
                        <Input type="datetime-local" value={novaData} onChange={e => setNovaData(e.target.value)} className="text-xs py-1 h-7" />
                        <Button size="sm" className="h-7 text-xs bg-primary"
                          onClick={() => { reagendar.mutate({ id: t.id, novaData }); setReagendandoId(null) }}>
                          OK
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Add route to `src/App.tsx`**

```typescript
const TransferenciasPage = lazy(() => import('@/pages/transferencias/TransferenciasPage'))

<Route path="/app/transferencias" element={
  <RequireModule mod="transferencias">
    <Suspense fallback={<PageLoader />}><TransferenciasPage /></Suspense>
  </RequireModule>
} />
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add FormTransferencias with baixa/cancelar/reagendar"
```

---

### Task 2: Shared Operações Hooks

**Files:**
- Create: `src/hooks/useOperacoes.ts`

**Interfaces:**
- Produces: `buscarNotasPorNfds(nfds)`, `executarBaixaVenda(ids)`, `executarReabertura(ids)`, `salvarProgramacaoFrete(notaId, freteData)`

- [ ] **Step 1: Create `src/hooks/useOperacoes.ts`**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from '@/stores/toastStore'
import type { NotaFiscal, FreteTipo } from '@/types/database'

export async function buscarNotasPorNfds(nfds: string[]): Promise<NotaFiscal[]> {
  const { data, error } = await supabase
    .from('notas_fiscais')
    .select('*')
    .in('nfd', nfds)
    .is('deleted_at', null)
  if (error) throw error
  return data as NotaFiscal[]
}

export function useBaixaVenda() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('notas_fiscais')
        .update({ status: 'Vendido' })
        .in('id', ids)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notas'] })
      toast('Baixa em venda concluída', 'ok')
    },
    onError: (e: Error) => toast(e.message, 'err'),
  })
}

export function useReabertura() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('notas_fiscais')
        .update({ status: 'Pendente' })
        .in('id', ids)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notas'] })
      toast('NFs reabertas', 'ok')
    },
    onError: (e: Error) => toast(e.message, 'err'),
  })
}

export interface FreteData {
  freteType: FreteTipo
  numPedido: string
  agendamento: string
}

export function useProgramarFrete() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ notaId, frete }: { notaId: string; frete: FreteData }) => {
      const { error: notaErr } = await supabase
        .from('notas_fiscais')
        .update({ frete_tipo: frete.freteType, status: 'Em Transferência' })
        .eq('id', notaId)
      if (notaErr) throw notaErr

      const { data: nota } = await supabase
        .from('notas_fiscais')
        .select('nfd, nf, qtd, valor_total, aba')
        .eq('id', notaId)
        .single()

      if (nota) {
        await supabase.from('transferencias').insert({
          nota_fiscal_id: notaId,
          nfd: nota.nfd, nf: nota.nf,
          caixas: nota.qtd, valor: nota.valor_total,
          num_pedido: frete.numPedido,
          agendamento: frete.agendamento,
          status: 'Ativa',
        })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notas'] })
      qc.invalidateQueries({ queryKey: ['transferencias'] })
      toast('Frete programado', 'ok')
    },
    onError: (e: Error) => toast(e.message, 'err'),
  })
}
```

---

### Task 3: FormProgramarFrete Wizard

**Files:**
- Create: `src/pages/frete/FretePage.tsx`

**Interfaces:**
- Produces: 3-step wizard at `/app/frete`: buscar NF → configurar frete → resultado

- [ ] **Step 1: Create `src/pages/frete/FretePage.tsx`**

```typescript
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { useProgramarFrete } from '@/hooks/useOperacoes'
import type { NotaFiscal, FreteTipo } from '@/types/database'

type Step = 1 | 2 | 3

const FRETE_TIPOS: FreteTipo[] = ['Tabela', 'Valor+ICMS', 'Valor', 'Cortesia']

export default function FretePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const programarFrete = useProgramarFrete()

  const [step, setStep] = useState<Step>(1)
  const [nfBusca, setNfBusca] = useState((location.state as any)?.nota?.nf ?? '')
  const [nota, setNota] = useState<NotaFiscal | null>((location.state as any)?.nota ?? null)
  const [searching, setSearching] = useState(false)
  const [freteType, setFreteType] = useState<FreteTipo>('Tabela')
  const [numPedido, setNumPedido] = useState('')
  const [agendamento, setAgendamento] = useState('')
  const [error, setError] = useState('')

  async function buscarNF() {
    if (!nfBusca.trim()) return
    setSearching(true)
    setError('')
    const { data, error } = await supabase
      .from('notas_fiscais')
      .select('*')
      .eq('nf', nfBusca.trim())
      .is('deleted_at', null)
      .single()
    setSearching(false)
    if (error || !data) { setError('NF não encontrada'); return }
    setNota(data as NotaFiscal)
    setStep(2)
  }

  async function confirmar() {
    if (!nota || !numPedido.trim() || !agendamento) return
    await programarFrete.mutateAsync({
      notaId: nota.id,
      frete: { freteType, numPedido, agendamento },
    })
    setStep(3)
  }

  const slideProps = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.2 },
  }

  return (
    <div className="p-6 max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="font-heading text-xl font-bold text-[var(--text)]">Programar Frete</h2>
        <span className="ml-auto text-sm text-[var(--text-muted)]">Passo {step} de 3</span>
      </div>

      <div className="flex gap-2 mb-8">
        {([1,2,3] as Step[]).map(s => (
          <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${step >= s ? 'bg-primary' : 'bg-[var(--border)]'}`} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="s1" {...slideProps} className="space-y-4">
            <p className="text-sm text-[var(--text-muted)]">Digite o número da NF para buscar</p>
            <div className="flex gap-2">
              <Input value={nfBusca} onChange={e => setNfBusca(e.target.value)}
                placeholder="Número da NF" onKeyDown={e => e.key === 'Enter' && buscarNF()} />
              <Button className="bg-primary" onClick={buscarNF} disabled={searching}>
                {searching ? 'Buscando...' : 'Buscar'}
              </Button>
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
          </motion.div>
        )}

        {step === 2 && nota && (
          <motion.div key="s2" {...slideProps} className="space-y-4">
            <div className="bg-[var(--border)]/30 rounded-card p-4 text-sm space-y-1">
              <p><strong>NFD:</strong> {nota.nfd} — <strong>NF:</strong> {nota.nf}</p>
              <p><strong>Fornecedor:</strong> {nota.fornecedor}</p>
              <p><strong>Status atual:</strong> {nota.status}</p>
              <p><strong>Valor:</strong> {nota.valor_total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </div>

            <div className="space-y-1">
              <Label>Tipo de Frete</Label>
              <select value={freteType} onChange={e => setFreteType(e.target.value as FreteTipo)}
                className="w-full rounded-btn border border-[var(--border)] bg-surface dark:bg-surface-dark text-[var(--text)] px-3 py-2 text-sm">
                {FRETE_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <Label>Nº do Pedido *</Label>
              <Input value={numPedido} onChange={e => setNumPedido(e.target.value)} placeholder="Ex: PED-2026-001" />
            </div>

            <div className="space-y-1">
              <Label>Data/Hora de Agendamento *</Label>
              <Input type="datetime-local" value={agendamento} onChange={e => setAgendamento(e.target.value)} />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
              <Button className="bg-primary flex-1" onClick={confirmar}
                disabled={!numPedido.trim() || !agendamento || programarFrete.isPending}>
                {programarFrete.isPending ? 'Salvando...' : 'Confirmar Frete'}
              </Button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="s3" {...slideProps} className="text-center py-8 space-y-4">
            <CheckCircle className="w-16 h-16 text-positive mx-auto" />
            <h3 className="font-heading font-bold text-xl text-[var(--text)]">Frete Programado!</h3>
            <p className="text-sm text-[var(--text-muted)]">
              NF {nota?.nf} agora está <strong>Em Transferência</strong>.
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => { setStep(1); setNota(null); setNfBusca('') }}>
                Programar outro
              </Button>
              <Button className="bg-primary" onClick={() => navigate('/app/transferencias')}>
                Ver Transferências
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
```

- [ ] **Step 2: Add route**

```typescript
const FretePage = lazy(() => import('@/pages/frete/FretePage'))
<Route path="/app/frete" element={<Suspense fallback={<PageLoader />}><FretePage /></Suspense>} />
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add FormProgramarFrete 3-step wizard"
```

---

### Task 4: FormReabertura Wizard

**Files:**
- Create: `src/pages/reabertura/ReaberturaPage.tsx`

**Interfaces:**
- Produces: 3-step wizard: chips NFDs → preview → confirm reopen

- [ ] **Step 1: Create `src/pages/reabertura/ReaberturaPage.tsx`**

```typescript
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X, CheckCircle, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { buscarNotasPorNfds, useReabertura } from '@/hooks/useOperacoes'
import type { NotaFiscal } from '@/types/database'

type Step = 1 | 2 | 3

export default function ReaberturaPage() {
  const navigate = useNavigate()
  const reabertura = useReabertura()
  const [step, setStep] = useState<Step>(1)
  const [input, setInput] = useState('')
  const [chips, setChips] = useState<string[]>([])
  const [notas, setNotas] = useState<NotaFiscal[]>([])
  const [loading, setLoading] = useState(false)

  function addChip(val: string) {
    const trimmed = val.trim()
    if (trimmed && !chips.includes(trimmed)) setChips(p => [...p, trimmed])
    setInput('')
  }

  function handleInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addChip(input) }
    if (e.key === 'Backspace' && !input) setChips(p => p.slice(0, -1))
  }

  async function buscar() {
    if (chips.length === 0) return
    setLoading(true)
    const data = await buscarNotasPorNfds(chips)
    setNotas(data.filter(n => n.status === 'Devolvido' || n.status === 'Vendido'))
    setLoading(false)
    setStep(2)
  }

  async function confirmar() {
    await reabertura.mutateAsync(notas.map(n => n.id))
    setStep(3)
  }

  const slide = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -20 }, transition: { duration: 0.2 } }

  return (
    <div className="p-6 max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="font-heading text-xl font-bold text-[var(--text)]">Reabertura de NFs</h2>
        <span className="ml-auto text-sm text-[var(--text-muted)]">Passo {step} de 3</span>
      </div>

      <div className="flex gap-2 mb-8">
        {([1,2,3] as Step[]).map(s => (
          <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${step >= s ? 'bg-primary' : 'bg-[var(--border)]'}`} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="s1" {...slide} className="space-y-4">
            <p className="text-sm text-[var(--text-muted)]">Digite os NFDs das notas a reabrir (Enter ou vírgula para adicionar)</p>
            <div className="flex flex-wrap gap-2 p-3 border border-[var(--border)] rounded-card min-h-[56px]">
              {chips.map(c => (
                <span key={c} className="flex items-center gap-1 bg-primary/10 text-primary rounded-badge px-2 py-0.5 text-sm">
                  {c}
                  <button onClick={() => setChips(p => p.filter(x => x !== c))}><X className="w-3 h-3" /></button>
                </span>
              ))}
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleInputKey}
                onBlur={() => input && addChip(input)}
                placeholder={chips.length === 0 ? 'NFD-001, NFD-002...' : ''}
                className="border-0 shadow-none p-0 h-auto flex-1 min-w-[120px] focus-visible:ring-0"
              />
            </div>
            <Button className="bg-primary w-full" onClick={buscar} disabled={chips.length === 0 || loading}>
              {loading ? 'Buscando...' : 'Buscar NFs'}
            </Button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="s2" {...slide} className="space-y-4">
            <p className="text-sm text-[var(--text-muted)]">{notas.length} NFs encontradas para reabertura:</p>
            {notas.length === 0 ? (
              <p className="text-danger text-sm">Nenhuma NF concluída (Devolvido/Vendido) encontrada para os NFDs informados.</p>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    {['NFD','Fornecedor','Status Atual'].map(h => (
                      <th key={h} className="px-2 py-1.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {notas.map(n => (
                    <tr key={n.id} className="border-b border-[var(--border)]">
                      <td className="px-2 py-1.5 font-mono">{n.nfd}</td>
                      <td className="px-2 py-1.5">{n.fornecedor}</td>
                      <td className="px-2 py-1.5">
                        <span className="text-xs bg-[var(--border)]/50 px-2 py-0.5 rounded-badge">{n.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
              <Button className="bg-primary flex-1" onClick={confirmar}
                disabled={notas.length === 0 || reabertura.isPending}>
                {reabertura.isPending ? 'Reabrindo...' : `Reabrir ${notas.length} NF${notas.length !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="s3" {...slide} className="text-center py-8 space-y-4">
            <CheckCircle className="w-16 h-16 text-positive mx-auto" />
            <h3 className="font-heading font-bold text-xl text-[var(--text)]">NFs Reabertas!</h3>
            <p className="text-sm text-[var(--text-muted)]">{notas.length} NF(s) voltaram para status <strong>Pendente</strong>.</p>
            <Button className="bg-primary" onClick={() => navigate('/app/notas')}>Ver Notas</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
```

- [ ] **Step 2: Add route**

```typescript
const ReaberturaPage = lazy(() => import('@/pages/reabertura/ReaberturaPage'))
<Route path="/app/reabertura" element={<Suspense fallback={<PageLoader />}><ReaberturaPage /></Suspense>} />
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add FormReabertura 3-step wizard with chips input"
```

---

### Task 5: FormVenda Wizard

**Files:**
- Create: `src/pages/venda/VendaPage.tsx`

**Interfaces:**
- Produces: 3-step wizard at `/app/venda`: chips NFDs → preview com valores → baixa + auto-print Doc. Carga

- [ ] **Step 1: Create `src/pages/venda/VendaPage.tsx`**

```typescript
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X, CheckCircle, Printer, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { buscarNotasPorNfds, useBaixaVenda } from '@/hooks/useOperacoes'
import type { NotaFiscal } from '@/types/database'

type Step = 1 | 2 | 3

function gerarDocCargaHtml(notas: NotaFiscal[]): string {
  const rows = notas.map(n =>
    `<tr><td>${n.nfd}</td><td>${n.nf}</td><td>${n.fornecedor}</td><td>${n.qtd}</td><td>R$ ${n.valor_total?.toFixed(2)}</td></tr>`
  ).join('')
  const total = notas.reduce((s, n) => s + (n.valor_total ?? 0), 0)
  return `<!DOCTYPE html><html><head><title>Doc. Carga</title><style>
    body{font-family:sans-serif;padding:20px} table{width:100%;border-collapse:collapse}
    th,td{border:1px solid #ccc;padding:6px;text-align:left}
    th{background:#f1f5f9;font-size:12px;text-transform:uppercase}
    h2{margin-bottom:16px}
  </style></head><body>
    <h2>Documento de Carga — Baixa em Venda</h2>
    <p>Data: ${new Date().toLocaleDateString('pt-BR')}</p>
    <table><thead><tr><th>NFD</th><th>NF</th><th>Fornecedor</th><th>Qtd</th><th>Valor</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <p style="margin-top:16px;font-weight:bold">Total: R$ ${total.toFixed(2)}</p>
    <div style="margin-top:48px">
      <p>_____________________________</p><p>Assinatura</p>
    </div>
  </body></html>`
}

export default function VendaPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const baixaVenda = useBaixaVenda()

  const initialNfds = (location.state as any)?.nfds ?? []
  const [step, setStep] = useState<Step>(initialNfds.length > 0 ? 1 : 1)
  const [input, setInput] = useState('')
  const [chips, setChips] = useState<string[]>(initialNfds)
  const [notas, setNotas] = useState<NotaFiscal[]>([])
  const [loading, setLoading] = useState(false)

  function addChip(val: string) {
    const trimmed = val.trim()
    if (trimmed && !chips.includes(trimmed)) setChips(p => [...p, trimmed])
    setInput('')
  }

  function handleInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addChip(input) }
    if (e.key === 'Backspace' && !input) setChips(p => p.slice(0, -1))
  }

  async function buscar() {
    if (chips.length === 0) return
    setLoading(true)
    const data = await buscarNotasPorNfds(chips)
    setNotas(data)
    setLoading(false)
    setStep(2)
  }

  async function confirmar() {
    await baixaVenda.mutateAsync(notas.map(n => n.id))
    // Auto-print
    const html = gerarDocCargaHtml(notas)
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
      win.print()
    }
    setStep(3)
  }

  const slide = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -20 }, transition: { duration: 0.2 } }

  const totalValor = notas.reduce((s, n) => s + (n.valor_total ?? 0), 0)

  return (
    <div className="p-6 max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="font-heading text-xl font-bold text-[var(--text)]">Baixa em Venda</h2>
        <span className="ml-auto text-sm text-[var(--text-muted)]">Passo {step} de 3</span>
      </div>

      <div className="flex gap-2 mb-8">
        {([1,2,3] as Step[]).map(s => (
          <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${step >= s ? 'bg-primary' : 'bg-[var(--border)]'}`} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="s1" {...slide} className="space-y-4">
            <p className="text-sm text-[var(--text-muted)]">Informe os NFDs para baixa em venda</p>
            <div className="flex flex-wrap gap-2 p-3 border border-[var(--border)] rounded-card min-h-[56px]">
              {chips.map(c => (
                <span key={c} className="flex items-center gap-1 bg-primary/10 text-primary rounded-badge px-2 py-0.5 text-sm">
                  {c}<button onClick={() => setChips(p => p.filter(x => x !== c))}><X className="w-3 h-3" /></button>
                </span>
              ))}
              <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleInputKey}
                onBlur={() => input && addChip(input)}
                placeholder={chips.length === 0 ? 'NFD-001, NFD-002...' : ''}
                className="border-0 shadow-none p-0 h-auto flex-1 min-w-[120px] focus-visible:ring-0" />
            </div>
            <Button className="bg-primary w-full" onClick={buscar} disabled={chips.length === 0 || loading}>
              {loading ? 'Buscando...' : 'Buscar NFs'}
            </Button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="s2" {...slide} className="space-y-4">
            <p className="text-sm text-[var(--text-muted)]">{notas.length} NFs para baixa em venda</p>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {['NFD','Fornecedor','Qtd','Valor'].map(h => (
                    <th key={h} className="px-2 py-1.5 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {notas.map(n => (
                  <tr key={n.id} className="border-b border-[var(--border)]">
                    <td className="px-2 py-1.5 font-mono">{n.nfd}</td>
                    <td className="px-2 py-1.5">{n.fornecedor}</td>
                    <td className="px-2 py-1.5 text-right">{n.qtd}</td>
                    <td className="px-2 py-1.5 text-right">
                      {n.valor_total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold">
                  <td colSpan={3} className="px-2 py-2 text-right text-xs uppercase">Total</td>
                  <td className="px-2 py-2 text-right text-sm">
                    {totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                </tr>
              </tfoot>
            </table>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
              <Button className="bg-positive flex-1" onClick={confirmar} disabled={notas.length === 0 || baixaVenda.isPending}>
                <Printer className="w-4 h-4 mr-1" />
                {baixaVenda.isPending ? 'Processando...' : 'Confirmar e Imprimir'}
              </Button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="s3" {...slide} className="text-center py-8 space-y-4">
            <CheckCircle className="w-16 h-16 text-positive mx-auto" />
            <h3 className="font-heading font-bold text-xl text-[var(--text)]">Baixa Concluída!</h3>
            <p className="text-sm text-[var(--text-muted)]">
              {notas.length} NF(s) marcadas como <strong>Vendido</strong>. Doc. Carga enviado para impressão.
            </p>
            <Button className="bg-primary" onClick={() => navigate('/app/notas')}>Ver Notas</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
```

- [ ] **Step 2: Add route**

```typescript
const VendaPage = lazy(() => import('@/pages/venda/VendaPage'))
<Route path="/app/venda" element={<Suspense fallback={<PageLoader />}><VendaPage /></Suspense>} />
```

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: S4 complete — Transferencias, Frete, Reabertura, Venda wizards"
```
