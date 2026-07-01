import { useEffect, useMemo, useState } from 'react'
import { ArrowUp, ArrowDown, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotasMutation } from '@/hooks/useNotas'
import { useConfigs } from '@/hooks/useAdmin'
import { useNotasStore } from '@/stores/notasStore'
import type { NotaFiscal, SupabaseStatus } from '@/types/database'
import type { Density } from '@/stores/notasStore'
import { ColumnPicker } from './ColumnPicker'
import { NotasContextMenu } from './NotasContextMenu'

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

const DEFAULT_ALERTA_DIAS = 30
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200]
const STATUS_COM_ALERTA: SupabaseStatus[] = ['Pendente', 'Em Transferência']

type SortKey = 'nfd' | 'nf' | 'data' | 'fornecedor' | 'qtd' | 'valor_total' | 'dias_armazem'
type SortDir = 'asc' | 'desc'

interface ColumnDef {
  key: SortKey
  label: string
  align?: 'left' | 'right'
}

const SORTABLE_COLUMNS: ColumnDef[] = [
  { key: 'nfd', label: 'NFD' },
  { key: 'nf', label: 'NF' },
  { key: 'data', label: 'Data' },
  { key: 'fornecedor', label: 'Fornecedor' },
  { key: 'qtd', label: 'Qtd', align: 'right' },
  { key: 'valor_total', label: 'Valor', align: 'right' },
  { key: 'dias_armazem', label: 'Dias', align: 'right' },
]

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

/**
 * Lê o limite de dias para alerta de atraso na tabela `configs` (chave/valor).
 * A chave `alert_days_threshold` já existe e é usada em ConfiguracoesPage.tsx;
 * mantemos um fallback fixo (30) caso a config não esteja cadastrada ainda.
 */
function useAlertaDiasLimite() {
  const { data } = useConfigs()

  return useMemo(() => {
    if (!data) return DEFAULT_ALERTA_DIAS
    const candidatos = ['alert_days_threshold', 'limite_dias_alerta', 'alerta_dias']
    const entry = data.find(c => candidatos.includes(c.chave))
    if (!entry) return DEFAULT_ALERTA_DIAS
    const n = Number(entry.valor)
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_ALERTA_DIAS
  }, [data])
}

interface CtxMenuState {
  nota: NotaFiscal
  x: number
  y: number
}

export function NotasTable({ data, selectedIds, density, columnVisibility, onSelect, onSelectAll, onRowClick, isLoading }: Props) {
  const { updateStatus } = useNotasMutation()
  const setColumnVisibility = useNotasStore(s => s.setColumnVisibility)
  const alertaDiasLimite = useAlertaDiasLimite()

  const [sortBy, setSortBy] = useState<SortKey>('data')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null)

  function handleSort(key: SortKey) {
    if (sortBy === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortDir('asc')
    }
  }

  const sorted = useMemo(() => {
    const arr = [...data]
    arr.sort((a, b) => {
      const av = a[sortBy]
      const bv = b[sortBy]
      let cmp = 0
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv
      } else {
        cmp = String(av ?? '').localeCompare(String(bv ?? ''), 'pt-BR')
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [data, sortBy, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))

  // Garante que a página atual permaneça válida quando os dados/filtros/pageSize mudam.
  useEffect(() => {
    setPage(p => Math.min(p, Math.max(1, Math.ceil(sorted.length / pageSize))))
  }, [sorted.length, pageSize])

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, page, pageSize])

  const allSelected = data.length > 0 && selectedIds.size === data.length

  function handleContextMenu(e: React.MouseEvent, nota: NotaFiscal) {
    e.preventDefault()
    setCtxMenu({ nota, x: e.clientX, y: e.clientY })
  }

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
    <div className="flex flex-col">
      <div className="flex items-center justify-end px-3 py-2 gap-2">
        <ColumnPicker columnVisibility={columnVisibility} onChange={setColumnVisibility} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--border)]/30">
              <th className="px-3 py-2 w-8">
                <input type="checkbox" checked={allSelected} onChange={onSelectAll}
                  className="w-4 h-4 rounded accent-primary" />
              </th>
              {SORTABLE_COLUMNS.map(col => (
                columnVisibility[col.key] && (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={cn(
                      'px-3 py-2 text-xs font-semibold text-[var(--text-muted)] uppercase select-none cursor-pointer hover:text-[var(--text)] transition-colors',
                      col.align === 'right' ? 'text-right' : 'text-left'
                    )}
                  >
                    <span className={cn('inline-flex items-center gap-1', col.align === 'right' && 'flex-row-reverse')}>
                      {col.label}
                      {sortBy === col.key && (
                        sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      )}
                    </span>
                  </th>
                )
              ))}
              {columnVisibility.tipo && <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Tipo</th>}
              {columnVisibility.status && <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Status</th>}
            </tr>
          </thead>
          <tbody>
            {paginated.map(nota => {
              const atrasada = STATUS_COM_ALERTA.includes(nota.status) && nota.dias_armazem > alertaDiasLimite
              return (
                <tr
                  key={nota.id}
                  onClick={() => onRowClick(nota)}
                  onContextMenu={e => handleContextMenu(e, nota)}
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
                  {columnVisibility.qtd && <td className={cn('px-3 text-right', DENSITY_CLASSES[density])}>{nota.qtd}</td>}
                  {columnVisibility.valor_total && (
                    <td className={cn('px-3 text-right font-medium', DENSITY_CLASSES[density])}>
                      {nota.valor_total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                  )}
                  {columnVisibility.dias_armazem && (
                    <td className={cn('px-3 text-right', DENSITY_CLASSES[density])}>
                      <span className={cn('inline-flex items-center gap-1 justify-end', atrasada && 'text-destructive font-semibold')}>
                        {atrasada && <AlertTriangle className="w-3.5 h-3.5" />}
                        {nota.dias_armazem}
                      </span>
                    </td>
                  )}
                  {columnVisibility.tipo && <td className={cn('px-3 text-[var(--text-muted)]', DENSITY_CLASSES[density])}>{nota.tipo}</td>}
                  {columnVisibility.status && (
                    <td className={cn('px-3', DENSITY_CLASSES[density])}>
                      <span className={cn('px-2 py-0.5 rounded-badge text-xs font-medium', STATUS_COLORS[nota.status])}>
                        {nota.status}
                      </span>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-3 py-2 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
        <div className="flex items-center gap-2">
          <span>
            {sorted.length === 0 ? 0 : (page - 1) * pageSize + 1}
            {'–'}
            {Math.min(page * pageSize, sorted.length)} de {sorted.length}
          </span>
          <select
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
            className="ml-2 px-1.5 py-1 rounded border border-[var(--border)] bg-transparent text-xs"
          >
            {PAGE_SIZE_OPTIONS.map(size => (
              <option key={size} value={size}>{size} / página</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <button type="button" disabled={page <= 1} onClick={() => setPage(1)}
            className="p-1 rounded hover:bg-[var(--border)]/40 disabled:opacity-30 disabled:pointer-events-none">
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button type="button" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}
            className="p-1 rounded hover:bg-[var(--border)]/40 disabled:opacity-30 disabled:pointer-events-none">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-2">Página {page} de {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className="p-1 rounded hover:bg-[var(--border)]/40 disabled:opacity-30 disabled:pointer-events-none">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage(totalPages)}
            className="p-1 rounded hover:bg-[var(--border)]/40 disabled:opacity-30 disabled:pointer-events-none">
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {ctxMenu && (
        <NotasContextMenu
          nota={ctxMenu.nota}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          onVerDetalhes={onRowClick}
          onMarcarDevolvido={n => updateStatus.mutate({ ids: [n.id], status: 'Devolvido' })}
          onMarcarPendente={n => updateStatus.mutate({ ids: [n.id], status: 'Pendente' })}
        />
      )}
    </div>
  )
}
