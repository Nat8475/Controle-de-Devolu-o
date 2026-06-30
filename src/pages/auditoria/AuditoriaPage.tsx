import { useState } from 'react'
import { ClipboardList, ChevronDown, ChevronRight } from 'lucide-react'
import { useAuditLog } from '@/hooks/useAdmin'

export default function AuditoriaPage() {
  const { data: logs = [], isLoading } = useAuditLog(200)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busca, setBusca] = useState('')

  const filtered = busca
    ? logs.filter(l =>
        l.acao.toLowerCase().includes(busca.toLowerCase()) ||
        (l.tabela ?? '').toLowerCase().includes(busca.toLowerCase()) ||
        (l.profiles?.nome ?? '').toLowerCase().includes(busca.toLowerCase())
      )
    : logs

  return (
    <div className="p-6 space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-bold text-[var(--text)] flex items-center gap-2">
          <ClipboardList className="w-5 h-5" />
          Auditoria
        </h2>
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar ação, tabela, usuário..."
          className="rounded-btn border border-[var(--border)] bg-surface dark:bg-surface-dark text-[var(--text)] text-sm px-3 py-2 w-64 focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum registro de auditoria.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map(log => {
            const isOpen = expanded === log.id
            const hasDiff = log.dados_antes !== null || log.dados_depois !== null
            return (
              <div key={log.id} className="border border-[var(--border)] rounded-btn bg-surface dark:bg-surface-dark overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--border)]/20 transition-colors"
                  onClick={() => hasDiff && setExpanded(isOpen ? null : log.id)}
                >
                  {hasDiff
                    ? (isOpen ? <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />)
                    : <span className="w-3.5" />
                  }
                  <span className="text-xs font-mono font-semibold text-primary min-w-[120px]">{log.acao}</span>
                  <span className="text-xs text-[var(--text-muted)] min-w-[100px]">{log.tabela ?? '—'}</span>
                  <span className="text-xs text-[var(--text)] flex-1 truncate">{log.profiles?.nome ?? log.profiles?.email ?? 'Sistema'}</span>
                  <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </button>
                {isOpen && hasDiff && (
                  <div className="border-t border-[var(--border)] px-4 py-3 grid grid-cols-2 gap-4">
                    {log.dados_antes && (
                      <div>
                        <p className="text-xs text-[var(--text-muted)] uppercase mb-1">Antes</p>
                        <pre className="text-xs bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 rounded-btn p-2 overflow-auto max-h-40">
                          {JSON.stringify(log.dados_antes, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.dados_depois && (
                      <div>
                        <p className="text-xs text-[var(--text-muted)] uppercase mb-1">Depois</p>
                        <pre className="text-xs bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 rounded-btn p-2 overflow-auto max-h-40">
                          {JSON.stringify(log.dados_depois, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
