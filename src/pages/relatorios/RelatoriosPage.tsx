import { useState, useMemo } from 'react'
import { Download, FileBarChart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useNotas } from '@/hooks/useNotas'
import type { SupabaseAba, SupabaseStatus } from '@/types/database'

const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const ABAS: SupabaseAba[] = ['Britania', 'Unilever', 'Variados']
const STATUSES: SupabaseStatus[] = ['Pendente', 'Em Transferência', 'Devolvido', 'Cancelado', 'Vendido']

export default function RelatoriosPage() {
  const [aba, setAba] = useState<SupabaseAba | ''>('')
  const [status, setStatus] = useState<SupabaseStatus | ''>('')
  const [dataIni, setDataIni] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [semFrete, setSemFrete] = useState(false)

  const { data: notas = [], isLoading } = useNotas({ aba, status, dataIni, dataFim, semFrete, busca: fornecedor })

  const summary = useMemo(() => ({
    count: notas.length,
    valor: notas.reduce((s, n) => s + (n.valor_total ?? 0), 0),
    semFreteCt: notas.filter(n => !n.frete_tipo).length,
    mediaValor: notas.length ? notas.reduce((s, n) => s + (n.valor_total ?? 0), 0) / notas.length : 0,
  }), [notas])

  function exportCSV() {
    const header = ['NFD', 'NF', 'Data', 'Fornecedor', 'Aba', 'Tipo', 'Motivo', 'Qtd', 'Valor Unit.', 'Valor Total', 'Status', 'Frete Tipo', 'Frete Valor', 'Obs', 'Criado em']
    const rows = notas.map(n => [
      n.nfd, n.nf,
      new Date(n.data + 'T00:00:00').toLocaleDateString('pt-BR'),
      n.fornecedor, n.aba, n.tipo ?? '', n.motivo ?? '',
      n.qtd, n.valor_unitario, n.valor_total,
      n.status, n.frete_tipo ?? '', n.frete_valor ?? '',
      (n.obs ?? '').replace(/[\r\n,]/g, ' '),
      new Date(n.created_at).toLocaleString('pt-BR'),
    ])
    const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\r\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio-devolucoes-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-bold text-[var(--text)] flex items-center gap-2">
          <FileBarChart className="w-5 h-5" />
          Relatórios
        </h2>
        <Button className="bg-primary gap-2" onClick={exportCSV} disabled={notas.length === 0}>
          <Download className="w-4 h-4" />Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-surface dark:bg-surface-dark border border-[var(--border)] rounded-card p-4">
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">Filtros</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Aba</Label>
            <select
              value={aba}
              onChange={e => setAba(e.target.value as SupabaseAba | '')}
              className="w-full rounded-btn border border-[var(--border)] bg-surface dark:bg-surface-dark text-[var(--text)] text-sm px-3 py-2"
            >
              <option value="">Todas</option>
              {ABAS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as SupabaseStatus | '')}
              className="w-full rounded-btn border border-[var(--border)] bg-surface dark:bg-surface-dark text-[var(--text)] text-sm px-3 py-2"
            >
              <option value="">Todos</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Data início</Label>
            <Input type="date" value={dataIni} onChange={e => setDataIni(e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Data fim</Label>
            <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Fornecedor</Label>
            <Input value={fornecedor} onChange={e => setFornecedor(e.target.value)} placeholder="Buscar por fornecedor..." className="text-sm" />
          </div>
          <div className="flex items-end pb-0.5 gap-2">
            <input
              type="checkbox" id="semFrete"
              checked={semFrete}
              onChange={e => setSemFrete(e.target.checked)}
              className="rounded border-[var(--border)]"
            />
            <label htmlFor="semFrete" className="text-sm text-[var(--text)] cursor-pointer">Sem frete</label>
          </div>
          <div className="flex items-end">
            <Button variant="outline" size="sm" className="text-xs w-full"
              onClick={() => { setAba(''); setStatus(''); setDataIni(''); setDataFim(''); setFornecedor(''); setSemFrete(false) }}>
              Limpar filtros
            </Button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total filtrado', value: summary.count + ' NFs' },
          { label: 'Valor total', value: BRL(summary.valor) },
          { label: 'Valor médio', value: BRL(summary.mediaValor) },
          { label: 'Sem frete', value: summary.semFreteCt + ' NFs' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-surface dark:bg-surface-dark border border-[var(--border)] rounded-card p-3">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-0.5">{label}</p>
            <p className="text-lg font-bold font-heading text-[var(--text)]">{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : notas.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <FileBarChart className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum resultado para os filtros selecionados.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--border)]/30">
                {['NFD', 'NF', 'Data', 'Fornecedor', 'Aba', 'Tipo', 'Motivo', 'Qtd', 'Valor Unit.', 'Valor Total', 'Status', 'Frete'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs uppercase tracking-wide text-[var(--text-muted)] font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {notas.map(n => (
                <tr key={n.id} className="border-b border-[var(--border)] hover:bg-[var(--border)]/20 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-[var(--text)] whitespace-nowrap">{n.nfd}</td>
                  <td className="px-4 py-2.5 text-[var(--text-muted)] whitespace-nowrap">{n.nf}</td>
                  <td className="px-4 py-2.5 text-[var(--text-muted)] whitespace-nowrap">
                    {new Date(n.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--text)] max-w-[180px] truncate">{n.fornecedor}</td>
                  <td className="px-4 py-2.5 text-[var(--text-muted)]">{n.aba}</td>
                  <td className="px-4 py-2.5 text-[var(--text-muted)]">{n.tipo ?? '—'}</td>
                  <td className="px-4 py-2.5 text-[var(--text-muted)] max-w-[120px] truncate">{n.motivo ?? '—'}</td>
                  <td className="px-4 py-2.5 text-[var(--text-muted)] text-right">{n.qtd}</td>
                  <td className="px-4 py-2.5 text-[var(--text-muted)] text-right whitespace-nowrap">{BRL(n.valor_unitario)}</td>
                  <td className="px-4 py-2.5 font-medium text-[var(--text)] text-right whitespace-nowrap">{BRL(n.valor_total)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      n.status === 'Pendente' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                      n.status === 'Em Transferência' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                      n.status === 'Devolvido' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                      n.status === 'Cancelado' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                      'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                    }`}>{n.status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--text-muted)]">{n.frete_tipo ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
