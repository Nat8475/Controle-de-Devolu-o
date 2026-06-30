import { useState } from 'react'
import { Mail, Plus, CheckCircle, XCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useEmailLog } from '@/hooks/useEmail'
import { ComposeEmailDialog } from './ComposeEmailDialog'

const STATUS_BADGE: Record<string, string> = {
  'enviado': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-0',
  'agendado': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-0',
  'erro': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-0',
}

const STATUS_ICON = {
  'enviado': CheckCircle,
  'agendado': Clock,
  'erro': XCircle,
}

export default function EmailPage() {
  const { data: emails = [], isLoading } = useEmailLog()
  const [composeOpen, setComposeOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-heading text-xl font-bold text-[var(--text)] flex items-center gap-2">
          <Mail className="w-5 h-5" />
          E-mails
        </h2>
        <Button className="bg-primary gap-2" onClick={() => setComposeOpen(true)}>
          <Plus className="w-4 h-4" />Compor
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : emails.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <Mail className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum e-mail enviado ainda.</p>
          <Button variant="outline" className="mt-4" onClick={() => setComposeOpen(true)}>
            Compor primeiro e-mail
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {emails.map(email => {
            const Icon = STATUS_ICON[email.status]
            const isExpanded = expanded === email.id
            return (
              <div
                key={email.id}
                className="border border-[var(--border)] rounded-card bg-surface dark:bg-surface-dark overflow-hidden"
              >
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--border)]/20 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : email.id)}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${
                    email.status === 'enviado' ? 'text-green-600' :
                    email.status === 'erro' ? 'text-red-600' : 'text-blue-600'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text)] truncate">{email.assunto}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">
                      Para: {email.destinatarios.join(', ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge className={STATUS_BADGE[email.status]}>{email.status}</Badge>
                    <span className="text-xs text-[var(--text-muted)]">
                      {email.profiles?.nome ?? 'Sistema'}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {new Date(email.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                </button>

                {isExpanded && email.corpo_html && (
                  <div className="border-t border-[var(--border)] px-4 py-3">
                    <div
                      className="text-sm text-[var(--text)] prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: email.corpo_html }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ComposeEmailDialog open={composeOpen} onClose={() => setComposeOpen(false)} />
    </div>
  )
}
