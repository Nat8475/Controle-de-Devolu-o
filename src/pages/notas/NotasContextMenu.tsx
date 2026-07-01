import { useEffect, useRef } from 'react'
import { Eye, CheckCircle2, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NotaFiscal } from '@/types/database'

interface Props {
  nota: NotaFiscal
  x: number
  y: number
  onClose: () => void
  onVerDetalhes: (nota: NotaFiscal) => void
  onMarcarDevolvido: (nota: NotaFiscal) => void
  onMarcarPendente: (nota: NotaFiscal) => void
}

export function NotasContextMenu({ nota, x, y, onClose, onVerDetalhes, onMarcarDevolvido, onMarcarPendente }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  const menuWidth = 220
  const menuHeight = 150
  const left = Math.min(x, window.innerWidth - menuWidth - 4)
  const top = Math.min(y, window.innerHeight - menuHeight - 4)

  const itemClass = 'flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left text-[var(--text)] hover:bg-[var(--border)]/40 transition-colors'

  return (
    <div
      ref={ref}
      style={{ left, top }}
      className="fixed z-50 w-[220px] rounded-md border border-[var(--border)] bg-surface dark:bg-surface-dark shadow-lg py-1"
    >
      <div className="px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] truncate border-b border-[var(--border)] mb-1">
        {nota.nfd || nota.nf} · {nota.fornecedor}
      </div>
      <button type="button" className={itemClass} onClick={() => { onVerDetalhes(nota); onClose() }}>
        <Eye className="w-3.5 h-3.5" />
        Ver detalhes
      </button>
      <button
        type="button"
        className={cn(itemClass, nota.status === 'Devolvido' && 'opacity-40 pointer-events-none')}
        onClick={() => { onMarcarDevolvido(nota); onClose() }}
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        Marcar como Devolvido
      </button>
      <button
        type="button"
        className={cn(itemClass, nota.status === 'Pendente' && 'opacity-40 pointer-events-none')}
        onClick={() => { onMarcarPendente(nota); onClose() }}
      >
        <RotateCcw className="w-3.5 h-3.5" />
        Marcar como Pendente
      </button>
    </div>
  )
}
