import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Save } from 'lucide-react'
import { useNotaDetail, useNotasMutation } from '@/hooks/useNotas'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { SupabaseStatus } from '@/types/database'

const STATUS_OPTIONS: SupabaseStatus[] = ['Pendente', 'Em Transferência', 'Devolvido', 'Cancelado', 'Vendido']

interface Props { id: string | null; onClose: () => void }

export function NotaDetail({ id, onClose }: Props) {
  const { data: nota, isLoading } = useNotaDetail(id)
  const { updateNota } = useNotasMutation()
  const [obs, setObs] = useState('')

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
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <h3 className="font-heading font-semibold text-[var(--text)]">
                {nota ? `NFD ${nota.nfd}` : 'Carregando...'}
              </h3>
              <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : nota ? (
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {([
                    ['NFD', nota.nfd], ['NF', nota.nf],
                    ['Data', new Date(nota.data + 'T00:00:00').toLocaleDateString('pt-BR')],
                    ['Fornecedor', nota.fornecedor],
                    ['Tipo', nota.tipo], ['Motivo', nota.motivo],
                    ['Quantidade', nota.qtd],
                    ['Valor Unit.', nota.valor_unitario?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })],
                    ['Valor Total', nota.valor_total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })],
                  ] as [string, unknown][]).map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-0.5">{label}</p>
                      <p className="font-medium text-[var(--text)]">{value != null ? String(value) : '—'}</p>
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

                {(nota as Record<string, unknown>).fotos_nf && Array.isArray((nota as Record<string, unknown>).fotos_nf) && ((nota as Record<string, unknown>).fotos_nf as unknown[]).length > 0 && (
                  <div>
                    <p className="text-xs text-[var(--text-muted)] uppercase mb-2">Fotos de Avaria</p>
                    <div className="grid grid-cols-3 gap-2">
                      {((nota as Record<string, unknown>).fotos_nf as Array<{ id: string; url: string; nome: string }>).map(f => (
                        <img key={f.id} src={f.url} alt={f.nome} className="w-full h-20 object-cover rounded-btn" />
                      ))}
                    </div>
                  </div>
                )}

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
