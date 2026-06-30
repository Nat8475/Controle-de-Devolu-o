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
