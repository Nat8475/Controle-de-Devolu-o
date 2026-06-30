import { motion, AnimatePresence } from 'framer-motion'
import { Mail, ShoppingCart, Truck, FileDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { NotaFiscal } from '@/types/database'

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
