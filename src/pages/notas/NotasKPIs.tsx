import { useMemo, useEffect, useState } from 'react'
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
