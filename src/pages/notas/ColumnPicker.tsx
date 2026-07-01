import { useEffect, useRef, useState } from 'react'
import { Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const COLUMN_LABELS: Record<string, string> = {
  nfd: 'NFD',
  nf: 'NF',
  data: 'Data',
  fornecedor: 'Fornecedor',
  tipo: 'Tipo',
  qtd: 'Qtd',
  valor_total: 'Valor',
  status: 'Status',
  dias_armazem: 'Dias',
}

const COLUMN_ORDER = ['nfd', 'nf', 'data', 'fornecedor', 'tipo', 'qtd', 'valor_total', 'status', 'dias_armazem']

interface Props {
  columnVisibility: Record<string, boolean>
  onChange: (col: string, visible: boolean) => void
}

export function ColumnPicker({ columnVisibility, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-[var(--border)]',
          'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--border)]/40 transition-colors'
        )}
      >
        <Settings2 className="w-3.5 h-3.5" />
        Colunas
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-48 rounded-md border border-[var(--border)] bg-surface dark:bg-surface-dark shadow-lg py-1">
          {COLUMN_ORDER.map(col => (
            <label
              key={col}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--border)]/40 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={!!columnVisibility[col]}
                onChange={e => onChange(col, e.target.checked)}
                className="w-4 h-4 rounded accent-primary"
              />
              {COLUMN_LABELS[col] ?? col}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
