import { Database, Plus, HardDrive } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useBackups, useCreateBackup } from '@/hooks/useAdmin'

function formatBytes(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export default function BackupPage() {
  const { data: backups = [], isLoading } = useBackups()
  const createBackup = useCreateBackup()

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-bold text-[var(--text)] flex items-center gap-2">
          <Database className="w-5 h-5" />
          Backup
        </h2>
        <Button
          className="bg-primary gap-2"
          onClick={() => createBackup.mutate()}
          disabled={createBackup.isPending}
        >
          <Plus className="w-4 h-4" />
          {createBackup.isPending ? 'Gerando...' : 'Novo Backup'}
        </Button>
      </div>

      <div className="bg-surface dark:bg-surface-dark border border-[var(--border)] rounded-card p-4 flex items-start gap-3">
        <HardDrive className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
        <div className="text-sm text-[var(--text-muted)] space-y-1">
          <p>O backup exporta todos os dados em JSON (notas fiscais, transferências, comentários, e-mails, configurações) e armazena no Cloudflare R2.</p>
          <p>Recomendado: realizar backup semanal antes de atualizações maiores.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : backups.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <Database className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum backup gerado ainda.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--border)]/30">
                {['Nome', 'Tamanho', 'Criado por', 'Data'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs uppercase tracking-wide text-[var(--text-muted)] font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {backups.map(b => (
                <tr key={b.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--border)]/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-[var(--text)]">{b.nome}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{formatBytes(b.tamanho_bytes)}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{b.profiles?.nome ?? '—'}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)] whitespace-nowrap">
                    {new Date(b.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
