import { useState } from 'react'
import { useTransferencias, useTransferenciasMutation } from '@/hooks/useTransferencias'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowRightLeft } from 'lucide-react'

type StatusFilter = 'Ativa' | 'Concluída' | 'Cancelada' | 'todas'

const STATUS_BADGE: Record<string, string> = {
  'Ativa': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-0',
  'Concluída': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-0',
  'Cancelada': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-0',
}

export default function TransferenciasPage() {
  const { data = [], isLoading } = useTransferencias()
  const { updateTransferencia } = useTransferenciasMutation()
  const [filtro, setFiltro] = useState<StatusFilter>('Ativa')

  const filtradas = filtro === 'todas' ? data : data.filter(t => t.status === filtro)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-heading text-xl font-bold text-[var(--text)] flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5" />
          Transferências
        </h2>
        <div className="flex gap-1">
          {(['Ativa', 'Concluída', 'Cancelada', 'todas'] as StatusFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setFiltro(s)}
              className={`text-xs px-3 py-1.5 rounded-btn transition-colors ${
                filtro === s
                  ? 'bg-primary text-white'
                  : 'bg-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {s === 'todas' ? 'Todas' : s}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <ArrowRightLeft className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma transferência {filtro !== 'todas' ? filtro.toLowerCase() : ''}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--border)]/30">
                {['NFD', 'NF', 'Fornecedor', 'Aba', 'Tipo', 'Caixas', 'Valor', 'Pedido', 'Agendamento', 'Data', 'Status', 'Ações'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs uppercase tracking-wide text-[var(--text-muted)] font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map(tf => {
                const nf = tf.notas_fiscais as { nfd: string; nf: string; fornecedor: string; aba: string } | null
                return (
                  <tr key={tf.id} className="border-b border-[var(--border)] hover:bg-[var(--border)]/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-[var(--text)]">{nf?.nfd ?? tf.nfd}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{nf?.nf ?? tf.nf}</td>
                    <td className="px-4 py-3 text-[var(--text)]">{nf?.fornecedor ?? '—'}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{nf?.aba ?? '—'}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{tf.tipo ?? '—'}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{tf.caixas ?? '—'}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">
                      {tf.valor != null ? tf.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{tf.num_pedido ?? '—'}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">
                      {tf.agendamento ? new Date(tf.agendamento + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)] whitespace-nowrap">
                      {new Date(tf.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={STATUS_BADGE[tf.status]}>{tf.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {tf.status === 'Ativa' && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-6 text-xs px-2"
                            onClick={() => updateTransferencia.mutate({ id: tf.id, status: 'Concluída' })}>
                            Concluir
                          </Button>
                          <Button size="sm" variant="outline" className="h-6 text-xs px-2 text-red-600"
                            onClick={() => updateTransferencia.mutate({ id: tf.id, status: 'Cancelada' })}>
                            Cancelar
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
